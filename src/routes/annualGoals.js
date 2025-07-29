// server/src/routes/annualGoals.js
import { Router } from "express";
import { body }  from "express-validator";
import { requireAuth } from "../middlewares/requireAuth.js";
import { runValidation } from "../middlewares/validate.js";

import {
  list,
  create,
  removeGoal,
  update,
  deleteCategory,
} from "../controllers/annualGoalController.js";

const router = Router();


router.get("/", requireAuth, list);               // 🔒 private list
// router.get("/", list);                         // 🌐 public list (uncomment if needed)

/* everything below here requires auth */
router.post(
  "/",
  requireAuth,
  [
    body("name").notEmpty().withMessage("Name required"),
    runValidation,
  ],
  create
);

router.patch(
  "/:id",
  requireAuth,
  [
    body("name").optional().notEmpty(),
    runValidation,
  ],
  update
);

router.delete("/:catId/goals/:goalId", requireAuth, removeGoal);
router.delete("/:id",                  requireAuth, deleteCategory);

export default router;
