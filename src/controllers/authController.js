import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Slp from '../models/Slp.js';
import cryptoRS from 'crypto-random-string';
import { sendOtp } from '../utils/mailer.js';

const SALT_ROUNDS = 12;

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Duplicate e-mail check
    if (await Slp.findOne({ email }))
      return res
        .status(409)
        .json({ message: 'Email is already taken. Please enter another email.' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const slp = await Slp.create({ name, email, passwordHash });

    const token = jwt.sign({ id: slp._id, role: 'slp' },
                           process.env.JWT_SECRET,
                           { expiresIn: process.env.JWT_EXPIRES });

    res.status(201).json({
      token,
      slp: { id: slp._id, name: slp.name, email: slp.email }
    });
  } catch (err) { next(err); }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const slp = await Slp.findOne({ email });
    if (!slp) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, slp.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: slp._id, role: 'slp' },
                           process.env.JWT_SECRET,
                           { expiresIn: process.env.JWT_EXPIRES });

    res.json({ token, slp: { id: slp._id, name: slp.name, email: slp.email } });
  } catch (err) { next(err); }
};

export const forgot = async (req, res, next) => {
  try {
    const { email } = req.body;
    const slp = await Slp.findOne({ email });
    if (!slp) return res.status(200).json({ ok: true }); // don’t leak accounts

    // gen 6-digit numeric code
    const otpPlain = cryptoRS({ length: 6, type: 'numeric' });
    slp.resetOtpHash    = await bcrypt.hash(otpPlain, SALT_ROUNDS);
    slp.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 min
    await slp.save();

    await sendOtp(email, otpPlain);
    res.json({ ok: true });
  } catch (e) { next(e); }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const slp = await Slp.findOne({ email });
    if (!slp) return res.status(400).json({ message: 'Invalid code' });
    if (Date.now() > slp.resetOtpExpires)   return res.status(400).json({ message: 'Code expired' });

    const ok = await bcrypt.compare(otp, slp.resetOtpHash);
    if (!ok) return res.status(400).json({ message: 'Invalid code' });

    res.json({ ok: true });                // front-end can now show new-password screen
  } catch (e) { next(e); }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;
    const slp = await Slp.findOne({ email });
    if (!slp) return res.status(400).json({ message: 'Invalid code' });
    if (Date.now() > slp.resetOtpExpires)   return res.status(400).json({ message: 'Code expired' });

    const ok = await bcrypt.compare(otp, slp.resetOtpHash);
    if (!ok) return res.status(400).json({ message: 'Invalid code' });

    slp.passwordHash   = await bcrypt.hash(password, SALT_ROUNDS);
    slp.resetOtpHash   = undefined;
    slp.resetOtpExpires= undefined;
    await slp.save();

    res.json({ ok: true });
  } catch (e) { next(e); }
};