// utils/genShortTermGoal.js
import fetch from "node-fetch";

/** Return ONE short-term goal (20-25 words).
 *  @param {Object} p  { note, interventions }
 */
export default async function genShortTermGoal({ note = "", interventions = [] }) {
  /* ---------- build prompt ---------- */
  const prompt = `
You are a paediatric speech-language pathologist.

TASK: Write ONE short-term therapy goal for the *next* session,
based on the student's visit note and (optionally) the list of
research-based interventions I found.

STRICT FORMAT:
• Exactly one sentence.
• 20 to 25 words.
• Begin with an action verb (e.g. “Increase …”, “Improve …”).
• Do **NOT** include any rationale, references, bullet points or label – only the goal sentence.
• Do **NOT** use any quotation marks or other punctuation at the end.
• Make sure the final sentence is a well constructed sentence.

[VISIT NOTE]
${note || "No note recorded."}

[INTERVENTION STUDIES]
${interventions.length ? JSON.stringify(interventions, null, 2) : "— none —"}
`.trim();

  const body = { contents: [{ parts: [{ text: prompt }] }] };
  // console.log(prompt);
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent" +
    `?key=${process.env.GEMINI_KEY}`;

  const resp = await fetch(url, {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify(body),
  }).then(r => r.json());


  let out = resp?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

  /* ---------- safety-net: clamp to ≤25 words ---------- */
  const MAX = 25;
  const words = out.split(/\s+/);
  if (words.length > MAX) {
    out = words.slice(0, MAX).join(" ").replace(/[.,;!?]*$/, ".");
  }
  if (!out) out = "— AI goal unavailable —";

  return out;
}
