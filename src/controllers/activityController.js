/* ─── activityController.js (drop-in) ───────────────────────── */
import dotenv from "dotenv";
dotenv.config();
import Group from "../models/Group.js"; 

import Appointment from "../models/Appointment.js";
import Patient     from "../models/Patient.js";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const PLACEHOLDER_NOTE =
  "• Therapist-note: session still awaiting AI notes.";

/* ------------------------------------------------------------------
   helpers
------------------------------------------------------------------- */
const buildVisitNotes = (appt, ids = []) => {
  const recMap = new Map();
  if (appt.recommendation?.individualInsights?.length) {
    appt.recommendation.individualInsights.forEach((ii) => {
      const pid   = String(ii.patient._id);
      const lines = (ii.insights || []).map(
        (x) => `• [${x.time}] ${x.text}`
      );
      recMap.set(pid, lines.length ? lines : [PLACEHOLDER_NOTE]);
    });
  }

  const chunks = ids.map((pid) => {
    const notes = recMap.get(String(pid)) || [PLACEHOLDER_NOTE];
    return notes.join("\n");
  });

  return chunks.length
    ? chunks.join("\n\n")
    : `### No specific members selected\n${PLACEHOLDER_NOTE}`;
};

const getPatientIds = async (appt) => {
  if (appt.type === "group") {
    if (appt.group?.patients) return appt.group.patients;
    const g = await Group.findById(appt.group, "patients");
    return g ? g.patients : [];
  }
  return [appt.patient];
};

/* add / replace one activity-id in every patient’s visit row */
const addActRefToPatients = async (appt, actId) => {
  const pids = await getPatientIds(appt);

  for (const pid of pids) {
    const base = {
      _id: pid,
      "visitHistory.appointment": appt._id,      // enables the $ positional
    };

    /* 1️⃣  yank any previous copy (if it exists) */
    await Patient.updateOne(base, {
      $pull: { "visitHistory.$.activities": actId },
    });

    /* 2️⃣  push the fresh copy back in (dedup naturally) */
    await Patient.updateOne(
      base,
      { $addToSet: { "visitHistory.$.activities": actId } }
    );
  }
};

/* remove ref everywhere */
const removeActRefFromPatients = async (appt, actId) => {
  const pids = await getPatientIds(appt);
  await Patient.updateMany(
    { _id: { $in: pids } },
    { $pull: { "visitHistory.$[].activities": actId } }
  );
};

/**
 * Insert / replace a single activity inside each patient’s
 * visitHistory row that matches the appointment.
 */
/* ------------------------------------------------------------------
   helper – replace / insert one Activity reference inside each
   patient’s visitHistory row that matches the appointment
------------------------------------------------------------------- */
const syncAddToPatients = async (appt, activity) => {
  const actCopy = {
    ...activity,
    members: Array.isArray(activity?.members)
      ? activity.members.map(String)
      : [],
    _id: activity._id, // make sure _id is kept
  };

  const patientIds = await getPatientIds(appt);

  for (const pid of patientIds) {
    const baseQuery = {
      _id: pid,
      "visitHistory.appointment": appt._id, // → ensures the positional $
    };

    /* 1. yank any older copy (if it exists) ------------------- */
    await Patient.updateOne(baseQuery, {
      $pull: { "visitHistory.$.activities": { _id: activity._id } },
    });

    /* 2. push the fresh copy back in (dedup by _id) ----------- */
    await Patient.updateOne(baseQuery, {
      $addToSet: { "visitHistory.$.activities": actCopy },
    });
  }
};


/**
 * Remove an activity everywhere (patients + appointment already handled).
 */
const syncRemoveFromPatients = async (appt, activityId) => {
  const patientIds = await getPatientIds(appt);

  await Promise.all(
    patientIds.map((pid) =>
      Patient.updateOne(
        { _id: pid },
        { $pull: { "visitHistory.$[].activities": { _id: activityId } } }
      )
    )
  );
};


/* remove activity from all patient profiles */


/* ------------------------------------------------------------------
   1.  POST /api/appointments/:id/activity-draft
------------------------------------------------------------------- */
export const generateActivityDraft = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { memberIds = [], goals = [], duration = "", idea = "" } = req.body;

    const appt = await Appointment.findById(id)
      .populate("group", "patients name")
      .populate("patient", "name")
      .populate({
        path: "recommendation",
        populate: { path: "individualInsights.patient", select: "name" },
      });

    if (!appt)
      return res.status(404).json({ message: "Appointment not found" });

    const safeNotes = buildVisitNotes(appt, memberIds);

    const prompt = `
You are a speech-language therapy assistant.
Design ONE age-appropriate activity (game / exercise).

Optional therapist idea: ${idea || "—"}

• Duration: ${duration || "30 Minutes"}
• Target goals: ${goals.length ? goals.join(", ") : "general communication"}

--- VISIT NOTES ---
${safeNotes}
--------------------

Return ONLY valid JSON with exactly these keys:

{
  "name":        "Catchy title, ≤10 words",
  "description": "Plain-text overview, ≤150 words",
  "materials":   ["item one", … up to 10]
}
`.trim();

    const gemBody = { contents: [{ parts: [{ text: prompt }] }] };
    const gRes = await fetch(
      `${GEMINI_ENDPOINT}?key=${process.env.GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gemBody),
      }
    );

    const j = await gRes.json();
    if (!gRes.ok) return res.status(gRes.status).json(j);

    const raw = (j.candidates?.[0]?.content?.parts?.[0]?.text || "")
      .trim()
      .replace(/```json|```/g, "");
    const draft = JSON.parse(raw); // { name, description, materials }
    res.json(draft);
  } catch (err) {
    next(err);
  }
};

/* ------------------------------------------------------------------
   2.  POST /api/appointments/:id/generate-activity
------------------------------------------------------------------- */
/* ---------------------------------------------------------------
   DROP-IN  —  replace the whole generateActivity() function
--------------------------------------------------------------- */
import Activity from "../models/Activity.js";   // ← add at the top of file

export const generateActivity = async (req, res, next) => {
  try {
    /* ---------- request values ---------- */
    const { id: apptId } = req.params;
    const {
      memberIds   = [],
      goals       = [],
      duration    = "",
      idea        = "",
      materials   = [],
      activityName = ""
    } = req.body;

    /* ---------- load appointment ---------- */
    const appt = await Appointment.findById(apptId)
      .populate("group",   "patients")
      .populate("patient", "name");
    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    /* ---------- build Gemini prompt ---------- */
    const safeNotes = buildVisitNotes(appt, memberIds);
    const heading   = activityName ? `### ${activityName}\n` : "";

    const promptText = `
You are a speech-language therapy assistant.

${heading}<!-- KEEP this heading unchanged -->

Using the information below, craft **one** complete activity.

${idea ? `Therapist’s idea / focus: ${idea}` : ""}

• Duration: ${duration || "30 Minutes"}
• Target goals: ${goals.length ? goals.join(", ") : "general communication"}
${materials.length ? `• Use ONLY these materials: ${materials.join(", ")}` : ""}

--- VISIT NOTES ---
${safeNotes}
---------------------

Return the plan in **Markdown**:

### Activity Name
<should be “${activityName}”>

### Requirements
- <each material>

### Instructions
1. …
`.trim();

    /* ---------- call Gemini ---------- */
    const gemBody = { contents: [{ parts: [{ text: promptText }] }] };
    const gRes = await fetch(
      `${GEMINI_ENDPOINT}?key=${process.env.GEMINI_KEY}`,
      { method: "POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(gemBody) }
    );

    const gJson = await gRes.json();
    if (!gRes.ok) return res.status(gRes.status).json(gJson);

    const plan = gJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    /* ---------- create Activity doc ---------- */
    const activity = await Activity.create({
      slp:   appt.slp,
      name:  activityName || "Generated Activity",
      description: plan,
      materials,
      members: memberIds,
      goals
    });

    /* ---------- reference it ---------- */
    await Appointment.updateOne(
      { _id: apptId },
      { $addToSet: { activities: activity._id } }
    );
    await addActRefToPatients(appt, activity._id);   // helper from earlier

    /* ---------- respond ---------- */
    res.json({ plan, activity });
  } catch (err) {
    next(err);
  }
};


/* ------------------------------------------------------------------
   3.  PATCH /api/appointments/:aid/activities/:actId
------------------------------------------------------------------- */
export const updateActivity = async (req, res, next) => {
  try {
    const { aid, actId }     = req.params;
    const { name, description, materials, members, goals } = req.body;

    /* 1) update the Activity doc */
    const activity = await Activity.findByIdAndUpdate(
      actId,
      { name, description, materials, members, goals },
      { new:true }
    );
    if (!activity) return res.status(404).json({ message:"Activity not found" });

    /* 2) nothing else to do – patients store only the id */
    res.json(activity);
  } catch (e) { next(e); }
};


/* ------------------------------------------------------------------
   4.  DELETE /api/appointments/:aid/activities/:actId
------------------------------------------------------------------- */
export const deleteActivity = async (req, res, next) => {
  try {
    const { aid, actId } = req.params;

    const appt = await Appointment.findByIdAndUpdate(
      aid,
      { $pull: { activities: actId } },
      { new:true }
    );
    if (!appt) return res.status(404).json({ message:"Appointment not found" });

    await Activity.findByIdAndDelete(actId);
    await removeActRefFromPatients(appt, actId);

    res.json({ ok:true });
  } catch (e) { next(e); }
};

