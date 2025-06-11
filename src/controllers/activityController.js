// server/src/controllers/activityController.js
import dotenv from "dotenv";
dotenv.config();

import Appointment    from "../models/Appointment.js";
import Recommendation from "../models/Recommendation.js";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 *  POST  /api/appointments/:id/generate-activity
 *  body = { memberIds:[string], goals:[string], duration:"30 Minutes" }
 */
export const generateActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { memberIds = [], goals = [], duration = "" } = req.body;

    // 1️⃣ Load appointment + populate recommendation→individualInsights.patient
    const appt = await Appointment.findById(id)
      .populate("group",   "patients name")
      .populate("patient", "name")
      .populate({
        path: "recommendation",
        populate: {
          path: "individualInsights.patient",
          select: "name",
        },
      });

    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // 2️⃣ Build a placeholder in case there are no insights
    const PLACEHOLDER_NOTE =
      "• Therapist-note: session still awaiting AI notes.";

    // Assemble a map: patientId → [insightText…]
    const recMap = new Map();
    if (appt.recommendation?.individualInsights) {
      appt.recommendation.individualInsights.forEach((ii) => {
        const pid = String(ii.patient._id);
        const lines = (ii.insights || []).map((x) => `• [${x.time}] ${x.text}`);
        recMap.set(pid, lines.length > 0 ? lines : [PLACEHOLDER_NOTE]);
      });
    }

    // Helper: get list of all participants with { _id, name }
    let allMembers = [];
    if (appt.type === "group" && appt.group?.patients) {
      allMembers = appt.group.patients.map((p) =>
        typeof p === "object" ? { _id: p._id, name: p.name } : { _id: p, name: "" }
      );
    } else if (appt.type === "individual" && appt.patient) {
      allMembers = [
        typeof appt.patient === "object"
          ? { _id: appt.patient._id, name: appt.patient.name }
          : { _id: appt.patient, name: "" },
      ];
    }

    // Build the VISIT NOTES block for each requested memberId
    const noteChunks = memberIds.map((pid) => {
      const member = allMembers.find((m) => String(m._id) === String(pid));
      const name = member?.name || pid;
      const insights = recMap.get(String(pid)) || [PLACEHOLDER_NOTE];
      const notes = insights.join("\n");
      return notes;
    });

    // If no memberIds or noteChunks are empty, at least send a placeholder
    const safeNotes =
      noteChunks.length > 0
        ? noteChunks.join("\n\n")
        : `### No specific members selected\n${PLACEHOLDER_NOTE}`;

    // 3️⃣ Build Gemini prompt
    const promptText = `
You are a speech-language therapist assistant.
Design ONE engaging therapy activity (game / exercise) for these group members.

• Duration: ${duration || "30 Minutes"}
• Target goals: ${goals.length ? goals.join(", ") : "general communication"}

--- VISIT NOTES ---
${safeNotes}
---------------------

Return the plan in plain text, max ~250 words, with clear, numbered steps. do not give any text like "here is the thing etc" or "here is the plan" or "here is the activity" etc.
I need activity name, ativity requirements, and step-by-step instructions.

`.trim();

    // 4️⃣ Call Gemini REST endpoint directly
    const gemBody = {
      contents: [{ parts: [{ text: promptText }] }],
    };

    const gRes = await fetch(`${GEMINI_ENDPOINT}?key=${process.env.GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gemBody),
    });

    if (!gRes.ok) {
      // If Gemini returns an error, forward it
      const errJson = await gRes.json();
      return res.status(gRes.status).json(errJson);
    }

    const gData = await gRes.json();
    const plan =
      gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "No plan returned from Gemini.";

    return res.json({ plan });
  } catch (err) {
    next(err);
  }
};
