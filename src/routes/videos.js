// server/src/routes/videos.js
import { Router }             from "express";
import { create, uploadMulter, getOne } from "../controllers/videoController.js";
import { requireAuth }        from "../middlewares/requireAuth.js";
import Video from "../models/Video.js";
import { updateGoals } from "../controllers/videoController.js"; // Import the updateGoals function

const router = Router();

router.post(
  "/appointments/:id/video",   // 1) upload (one-off)
  requireAuth,
  uploadMulter,
  create                       // ← create() now rejects if appt.video already exists
);

router.get(
  "/videos/:id",               // 2) fetch to “View Video”
  requireAuth,
  getOne
);

router.get(
  "/videos/:id/transcript",
  requireAuth,
  async (req, res, next) => {
    try {
      const vid = await Video.findOne(
        { _id: req.params.id, slp: req.user._id },
        "transcript"      // only select transcript
      );
      if (!vid) return res.status(404).json({ message: "Not found" });
      res.json(vid.transcript || []);
    } catch (e) { next(e); }
  }
);

router.patch('/:id/goals', requireAuth, updateGoals);

export default router;
