import bcrypt from 'bcryptjs';
import Slp from '../models/Slp.js';
import fs      from "fs"; 

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
     // remove old file if there was one
     if (req.user.avatarUrl?.startsWith('http')) {
       const local = req.user.avatarUrl.replace(`${req.protocol}://${req.get('host')}`, '.');
       if (fs.existsSync(local)) fs.unlinkSync(local);
     }
     fields.avatarUrl =
       `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
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
