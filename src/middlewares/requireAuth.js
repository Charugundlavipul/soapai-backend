import jwt from 'jsonwebtoken';
import Slp from '../models/Slp.js';

export const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await Slp.findById(payload.id).select('_id name email clients avatarUrl');
    if (!req.user) throw new Error();
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};
