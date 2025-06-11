// server/src/routes/recommendations.js
import { Router } from "express";
import {
  createRecommendation,
  getRecommendation,
} from "../controllers/recommendationController.js";
import { generateActivity } from "../controllers/activityController.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

/* insights */
router.post(
  "/appointments/:id/recommendations",
  requireAuth,
  createRecommendation
);
router.get(
  "/appointments/:id/recommendations",
  requireAuth,
  getRecommendation
);

/* activity generator (Gemini) */
router.post(
  "/appointments/:id/generate-activity",
  requireAuth,
  generateActivity
);

export default router;
