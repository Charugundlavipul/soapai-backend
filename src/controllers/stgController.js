/*  server/src/controllers/stgController.js  */
import mongoose from "mongoose";
import Patient  from "../models/Patient.js";
import genShortTermGoal from "../utils/genShortTermGoal.js";
import { getInterventions }  from "../utils/neoInterventions.js";

/*─────────────────────────────────────────────────────────────*/
/* small helper                                                */
/*─────────────────────────────────────────────────────────────*/
const toPlainId = (val) => {
  if (!val) return null;                       // null / undefined
  if (typeof val === "string") return val;
  if (mongoose.Types.ObjectId.isValid(val)) return String(val);
  if (typeof val === "object" && val._id) return String(val._id);
  return null;
};

/*─────────────────────────────────────────────────────────────*/
/* POST  /api/clients/:id/gen-stg                              */
/*─────────────────────────────────────────────────────────────*/
export const generateStg = async (req, res, next) => {
  try {
    const { id }            = req.params;        // patient id
    const { appointmentId } = req.body;
    if (!appointmentId)
      return res.status(400).json({ message: "appointmentId required" });

    const patient = await Patient.findById(id).lean();
    if (!patient)
      return res.status(404).json({ message: "Patient not found" });

    const visit = patient.visitHistory?.find(
      (v) => toPlainId(v.appointment) === String(appointmentId)
    );
    const noteText = visit?.note || "";

    /* 1️⃣  Evidence-based interventions */
    const interventions = await getInterventions({
      disorders: patient.pastHistory || [],
      keywords : [],
      limit    : 5,
    });

    /* 2️⃣  LLM generates one ST-goal sentence */
    const text = await genShortTermGoal({ note: noteText, interventions });

    const stgObj = {
      appointment: new mongoose.Types.ObjectId(appointmentId),
      text,
    };

    /* Replace any existing ST-goal for that appointment */
    await Patient.updateOne(
      { _id: id },
      { $pull: { stgs: { appointment: stgObj.appointment } } }
    );
    await Patient.updateOne(
      { _id: id },
      { $push: { stgs: stgObj } }
    );

    res.json(stgObj);
  } catch (err) {
    next(err);
  }
};

/*─────────────────────────────────────────────────────────────*/
/* PATCH  /api/clients/:id/stg                                 */
/*─────────────────────────────────────────────────────────────*/
/*─────────────────────────────────────────────────────────────*/
/* PATCH  /api/clients/:id/stg                                 */
/*─────────────────────────────────────────────────────────────*/
export const updateStg = async (req, res, next) => {
  try {
    const { id } = req.params;                    // patient id
    const { appointmentId, text } = req.body;

    if (!appointmentId || text == null)
      return res.status(400).json({ message: "appointmentId and text required" });

    /* verify ownership */
    const pat = await Patient.findOne({ _id: id, slp: req.user._id });
    if (!pat) return res.status(404).json({ message: "Not found" });

    /* build row */
    const row = {
      appointment: new mongoose.Types.ObjectId(appointmentId),
      text,
    };

    /* 1️⃣  remove any existing entry for that appointment */
    await Patient.updateOne(
      { _id: id },
      { $pull: { stgs: { appointment: row.appointment } } }
    );

    /* 2️⃣  push the new one */
    await Patient.updateOne(
      { _id: id },
      { $push: { stgs: row } }
    );

    /* 3️⃣  return fresh stgs array */
    const { stgs } = await Patient.findById(id, "stgs");
    res.json(stgs);
  } catch (err) {
    next(err);
  }
};
