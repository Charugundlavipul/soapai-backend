// server/src/routes/annualGoals.js
import { Router } from "express";
import {
  list,
  create,
  removeGoal,
  update,
  deleteCategory,
} from "../controllers/annualGoalController.js";

const router = Router();

router.get   ("/",                       list);
router.post  ("/",                       create);
router.patch ("/:id",                    update);
router.delete("/:catId/goals/:goalId",   removeGoal);
router.delete("/:id",                    deleteCategory);

export default router;
