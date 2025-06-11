// server/src/routes/patientRoutes.js
import { Router } from 'express';
import { body }   from 'express-validator';
import {
  list,
  create,
  getOne,
  getProfile,
  update,
  remove,
  updateGoals,
  addVisitHistory,
  addMaterial,
  updateGoalProgress,
  addGoalHistory,
  listMaterials
  
} from '../controllers/patientController.js';
import multer from 'multer';
import { runValidation } from '../middlewares/validate.js';
import { requireAuth }   from '../middlewares/requireAuth.js';
import { uploader }      from '../middlewares/upload.js';

const router = Router();
const upload = multer({ dest: "uploads" });

// Validation rule: name must not be empty
const nameV = body('name').notEmpty().withMessage('Name is required');

/* ─── Public patient routes ─── */
router.get('/', requireAuth, list);
router.post(
  '/',
  requireAuth,
  uploader.single('avatar'),
  [nameV, runValidation],
  create
);
router.get('/:id', requireAuth, getOne);

/* ─── Patient profile (with visitHistory populated) ─── */
router.get('/:id/profile', requireAuth, getProfile);

/* ─── Update patient fields (including avatar, group, goals, etc.) ─── */
router.put(
  '/:id',
  requireAuth,
  uploader.single('avatar'),
  [nameV, runValidation],
  update
);

/* ─── Delete patient ─── */
router.delete('/:id', requireAuth, remove);

/* ─── Replace patient.goals array ─── */
router.patch('/:id/goals', requireAuth, updateGoals);

/* ─── Add one visit entry into visitHistory ───
     ⇒ Body: { visit: { date, appointment, type, aiInsights, activities } }
*/
router.post('/:id/visit', requireAuth, addVisitHistory);

/* ─── Upload a material (PDF) for a patient visit ─── 
     ⇒ Expects FormData: { visitDate, appointment, file }
*/
router.post(
  '/:id/materials',
  requireAuth,
  uploader.single('file'),
  addMaterial
);
router.patch('/:id/goal-progress/history', requireAuth, addGoalHistory);
router.patch("/:id/goal-progress", requireAuth, updateGoalProgress);
router.get ("/:id/materials",   requireAuth,            listMaterials);
router.post("/:id/materials",   requireAuth, upload.single("file"), addMaterial);

export default router;
