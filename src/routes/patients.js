import { Router } from 'express';
import { body }   from 'express-validator';
import { list, create,getOne,update,remove } from '../controllers/patientController.js';
import { runValidation } from '../middlewares/validate.js';
import { requireAuth }   from '../middlewares/requireAuth.js';
import { uploader }      from '../middlewares/upload.js';

const router = Router();
const nameV = body('name').notEmpty();

router.get('/',  requireAuth, list);
router.post(
  '/',
  requireAuth,
  uploader.single('avatar'),
  [nameV, runValidation],
  create
);
router.delete('/:id', requireAuth, remove);

router.get('/:id', requireAuth, getOne);
router.patch(
  '/:id',
  requireAuth,
  uploader.single('avatar'),
  [nameV, runValidation],
  update
);

router.delete('/:id', requireAuth, remove);


export default router;
