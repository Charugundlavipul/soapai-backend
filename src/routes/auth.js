import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  forgot,
  verifyOtp,
  resetPassword
} from '../controllers/authController.js';
import { runValidation } from '../middlewares/validate.js';

const router = Router();

const nameV  = body('name').notEmpty().withMessage('Full name is required');
const emailV = body('email').isEmail().withMessage('Valid e-mail required');
const passV  = body('password').isLength({ min: 6 })
                               .withMessage('Password ≥ 6 chars');

// Authentication
router.post('/register', [
  body('name').notEmpty().withMessage('Full name is required'),
  emailV,
  passV,
  runValidation
], register);

router.post('/login', [
  emailV,
  passV,
  runValidation
], login);

// Forgot‐Password flow
router.post(
  '/forgot-password',
  [ emailV, runValidation ],
  forgot
);

router.post(
  '/verify-otp',
  [ emailV, body('otp').isLength({ min: 6 }).withMessage('Invalid code'), runValidation ],
  verifyOtp
);

router.post(
  '/reset-password',
  [
    emailV,
    body('otp').isLength({ min: 6 }).withMessage('Invalid code'),
    passV,
    runValidation
  ],
  resetPassword
);

router.post('/logout', (_req, res) => {
  // stateless JWT → nothing to invalidate; client just deletes token
  res.json({ ok: true });
});

export default router;
