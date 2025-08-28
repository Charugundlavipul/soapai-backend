import bcrypt from 'bcryptjs';
import Slp from '../models/Slp.js';
import { deleteFromMinio, uploadToMinio, BUCKETS } from '../config/minio.js';

export const getProfile = (req, res) => {
  res.json({
    name:  req.user.name,
    email: req.user.email,
    avatarUrl: req.user.avatarUrl || null
  });
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const fields = {};
    if (name)  fields.name  = name;
    if (email) fields.email = email;
      if (req.file) {
      // Delete old avatar from MinIO if it exists
      if (req.user.avatarUrl) {
        try {
          const oldObjectName = req.user.avatarUrl.split('/').pop();
          await deleteFromMinio(BUCKETS.AVATARS, oldObjectName);
        } catch (err) {
          console.error('Error deleting old avatar:', err);
        }
      }

      // Upload new avatar and get its URL
      const timestamp = Date.now();
      const fileExtension = req.file.originalname.split('.').pop();
      const objectName = `avatar_${timestamp}_${Math.random().toString(36).substring(2)}.${fileExtension}`;
      
      await uploadToMinio(BUCKETS.AVATARS, objectName, req.file.buffer, req.file.mimetype);
      fields.avatarUrl = getPublicUrl(BUCKETS.AVATARS, objectName);
   }

    const user = await Slp.findByIdAndUpdate(req.user._id, fields, { new: true });
    res.json({ ok: true, user });
  } catch (e) { next(e); }
};

export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await Slp.findById(req.user._id).select('passwordHash');
    const match = await bcrypt.compare(oldPassword, user.passwordHash);

    if (!match) return res.status(400).json({ message: 'Old password wrong' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (e) { next(e); }
};
