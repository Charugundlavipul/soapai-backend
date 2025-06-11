import { Router } from "express";
import { list, create, removeGoal,update, deleteCategory } from "../controllers/annualGoalController.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/",  requireAuth, list);
router.post("/", requireAuth, create);
router.delete(
  "/:catId/goals/:goalId",
  requireAuth,
  removeGoal
);
router.patch("/:id", requireAuth, update);
router.delete("/:id",          requireAuth, deleteCategory); 
export default router;
