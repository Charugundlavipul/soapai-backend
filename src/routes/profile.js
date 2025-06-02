import { Router } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middlewares/requireAuth.js';
import { runValidation } from '../middlewares/validate.js';
import { uploader } from '../middlewares/upload.js';
import { getProfile, updateProfile, changePassword } from '../controllers/profileController.js';

const router = Router();

router.get('/', requireAuth, getProfile);

router.patch(
  '/',
  requireAuth,
  uploader.single('avatar'),
  runValidation,
  updateProfile
);

router.patch(
  '/password',
  requireAuth,
  [
    body('oldPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
    runValidation
  ],
  changePassword
);

export default router;
