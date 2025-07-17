// routes/stgRoutes.js
import express from "express";
import { generateStg,updateStg } from "../controllers/stgController.js";
import { requireAuth } from '../middlewares/requireAuth.js';    // or whatever file exports your JWT-auth middleware

const router = express.Router();

/* POST /api/clients/:id/gen-stg */
router.post("/clients/:id/gen-stg", requireAuth, generateStg);
router.patch("/clients/:id/stg", requireAuth, updateStg);
export default router;
