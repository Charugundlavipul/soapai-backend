// server/src/controllers/stgController.js
import mongoose from "mongoose";
import Patient  from "../models/Patient.js";
import genShortTermGoal from "../utils/genShortTermGoal.js";
import { getInterventions }  from "../utils/neoInterventions.js";

export const generateStg = async (req, res, next) => {
  try {
    const { id }            = req.params;        // patient id
    const { appointmentId } = req.body;          // must be sent by the client
    if (!appointmentId)
      return res.status(400).json({ message: "appointmentId required" });

    const patient = await Patient.findById(id).lean();
    if (!patient) return res.status(404).json({ message:"Patient not found" });

    const visit = patient.visitHistory?.find(
      v => String(v.appointment) === String(appointmentId)
    );
    const noteText = visit?.note || "";

    /* 1️⃣  pull 4-5 evidence-based interventions from Neo4j ------------ */
    const interventions = await getInterventions({
      disorders: patient.pastHistory || [],   // treat diagnoses as “disorders”
      keywords : [],                          // can refine later
      limit    : 5
    });

    /* 2️⃣  ask Gemini for ONE sentence (20-25 words) ------------------- */
    const text = await genShortTermGoal({ note: noteText, interventions });

    /* build the stg object we’ll store */
    const stgObj = {
      appointment: new mongoose.Types.ObjectId(appointmentId),
      text       :text
    };

    /* 2️⃣  REMOVE any older ST-G for this appointment */
    await Patient.updateOne(
      { _id: id },
      { $pull: { stgs: { appointment: stgObj.appointment } } }
    );

    /* 3️⃣  PUSH the fresh ST-G */
    await Patient.updateOne(
      { _id: id },
      { $push: { stgs: stgObj } }
    );

    /* 4️⃣  send just the new goal back */
    res.json(stgObj);
  } catch (err) {
    next(err);
  }
};
