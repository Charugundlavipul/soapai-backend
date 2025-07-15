import Appointment    from "../models/Appointment.js";
import Recommendation from "../models/Recommendation.js";
import Patient        from "../models/Patient.js";

export const PLACEHOLDER_VISIT_NOTE = `
this is a test visit note for the patient from controller.`;

/* ── helper that inserts ONE placeholder visit if absent ───────── */
async function ensureVisitRow(pat, appt) {
  await Patient.updateOne(
    // match the patient **only if** that appointment row is still absent
    { _id: pat._id, "visitHistory.appointment": { $ne: appt._id } },
    {
      $push: {
        visitHistory: {
          date       : new Date(),
          appointment: appt._id,
          type       : appt.type,
          note       : PLACEHOLDER_VISIT_NOTE,
          aiInsights : [],   // UI will fall back to placeholders
          activities : [],
        },
      },
    }
  );
}

/* ────────────────────────────────────────────────────────────────
   POST  /api/appointments/:id/recommendations
   • ONLY inserts placeholder visits & a Recommendation shell
   • DOES NOT touch patient.stg or Neo4j
   ──────────────────────────────────────────────────────────────── */
export const createRecommendation = async (req, res, next) => {
  try {
    const appt = await Appointment.findById(req.params.id)
      .populate("group")
      .populate("patient");
    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    /* avoid duplicates */
    const existing = await Recommendation.findOne({ appointment: appt._id });
    if (existing) return res.status(200).json(existing);

    /* 1️⃣  ensure placeholder visit rows */
    if (appt.type === "group") {
      await Promise.all(
        appt.group.patients.map(pid => ensureVisitRow({ _id: pid }, appt))
      );
    } else {
      await ensureVisitRow(appt.patient, appt);
    }

    /* 2️⃣  build RECOMMENDATION doc with dummy insights (placeholders) */
    const groupInsights = appt.type === "group"
      ? [{ time:"11:30 - 12:00", text:"Group placeholder insight", tag:"Placeholder", tagColor:"bg-gray-100 text-gray-600" }]
      : [];

    const individualInsights = appt.type === "group"
      ? appt.group.patients.map(pid => ({
          patient : pid,
          insights: [{ time:"11:30 - 12:00", text:"Patient placeholder insight", tag:"Placeholder", tagColor:"bg-gray-100 text-gray-600" }]
        }))
      : [{
          patient : appt.patient._id,
          insights: [{ time:"11:30 - 12:00", text:"Patient placeholder insight", tag:"Placeholder", tagColor:"bg-gray-100 text-gray-600" }]
        }];

    const rec = await Recommendation.create({
      appointment : appt._id,
      groupInsights,
      individualInsights,
      materials   : [],
    });

    appt.recommendation = rec._id;
    await appt.save();

    res.status(201).json(rec);
  } catch (err) { next(err); }
};

/* ────────────────────────────────────────────────────────────────
   GET /api/appointments/:id/recommendations  (unchanged)
   ──────────────────────────────────────────────────────────────── */
export const getRecommendation = async (req, res, next) => {
  try {
    const appt = await Appointment.findById(req.params.id).populate({
      path    : "recommendation",
      populate: { path:"individualInsights.patient", select:"name avatarUrl stgs" }
    });
    if (!appt || !appt.recommendation)
      return res.status(404).json({ message:"No recommendations yet" });
    res.json(appt.recommendation);
  } catch (e) { next(e); }
};
