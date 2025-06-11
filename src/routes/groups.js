// server/src/routes/groups.js
import { Router } from 'express';
import { body }   from 'express-validator';
import { list, create,getOneGroup } from '../controllers/groupController.js';
import { runValidation } from '../middlewares/validate.js';
import { requireAuth }   from '../middlewares/requireAuth.js';
import { uploader }      from '../middlewares/upload.js';
import { remove } from '../controllers/groupController.js';
import {updateGoals} from '../controllers/groupController.js';
const router = Router();

router.get('/', requireAuth, list);
router.get("/:id", requireAuth, getOneGroup);

router.post(
  '/',
  requireAuth,
  uploader.single('avatar'),
  
  create
);
router.delete('/:id', requireAuth, remove);
router.patch('/:id/goals', requireAuth, updateGoals);

export default router;
