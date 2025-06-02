import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const SlpSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  avatarUrl:      String,   
  passwordHash: { type: String, required: true },
  resetOtpHash:    String,   // bcrypt hash of the 6-digit code
  resetOtpExpires: Date,
}, { timestamps: true });

export default model('Slp', SlpSchema);
