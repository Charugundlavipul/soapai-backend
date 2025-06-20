import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middlewares/requireAuth.js';
import { runValidation } from '../middlewares/validate.js';
import { create, list,getOne,update,remove } from '../controllers/appointmentController.js';
import { generateActivityDraft } from '../controllers/activityController.js';
import { generateActivity , updateActivity,deleteActivity} from '../controllers/activityController.js';
const router = Router();

router.get('/',  requireAuth, list);
router.post('/', requireAuth, [
  body('type').isIn(['group','individual']),
  body('dateTimeStart').isISO8601(),
  body('dateTimeEnd').isISO8601(),
  runValidation
], create);
router.get("/:id",      requireAuth, getOne);
router.patch('/:id',  requireAuth, update);
router.delete('/:id', requireAuth, remove);
router.post("/:id/activity-draft",    requireAuth, generateActivityDraft);
router.post("/:id/generate-activity", requireAuth, generateActivity);
router.patch("/:aid/activities/:actId",  requireAuth, updateActivity);
router.delete("/:aid/activities/:actId", requireAuth, deleteActivity);
export default router;
