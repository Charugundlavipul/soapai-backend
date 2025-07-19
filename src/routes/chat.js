// server/src/routes/chat.js
import { Router }     from "express";
import multer         from "multer";
import { requireAuth } from "../middlewares/requireAuth.js";

const router  = Router();
const upload  = multer();                       // memory storage by default
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/* POST /api/chat ────────────────────────────────────────────────
   Body (either):
     - multipart/form-data: field `messages` (stringified JSON), 0-n files
     - application/json    : { messages:[...] }
*/
router.post("/", requireAuth, upload.any(), async (req, res, next) => {
  try {
    let history = req.body.messages || [];
    if (typeof history === "string") {
      try { history = JSON.parse(history); }
      catch { history = []; }
    }

    if (!Array.isArray(history) || !history.length) {
      return res.status(400).json({ error: "Invalid or empty chat history." });
    }

    // Build Gemini conversation format
    const gemContent = [];

    // Optional: Insert system instruction
    gemContent.push({
      role: "user",
      parts: [
        {
          text: "You are a helpful AI assistant analyzing therapy session videos. Give short, thoughtful answers (1-3 sentences). Avoid repeating context and don’t ramble."
        }
      ]
    });

    // Add conversation history (user & assistant)
    for (const msg of history) {
      if (msg.role === "user" || msg.role === "assistant") {
        gemContent.push({
          role: msg.role,
          parts: [{ text: msg.content }]
        });
      }
    }

    const gemBody = {
      contents: gemContent
    };

    const gRes = await fetch(
      `${ENDPOINT}?key=${process.env.GEMINI_KEY}`,
      {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify(gemBody)
      }
    );

    if (!gRes.ok) {
      return res.status(gRes.status).json(await gRes.json());
    }

    const gData = await gRes.json();
    const reply = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    res.json({ reply });
  } catch (err) {
    next(err);
  }
});


export default router;
