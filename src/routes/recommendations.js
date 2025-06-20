// server/src/routes/recommendations.js
import { Router } from "express";
import {
  createRecommendation,
  getRecommendation,
} from "../controllers/recommendationController.js";
import { generateActivity,generateActivityDraft } from "../controllers/activityController.js";
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


export default router;
