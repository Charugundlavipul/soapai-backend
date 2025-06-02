// server/src/utils/mailer.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const sendOtp = (to, otp) =>
  transporter.sendMail({
    from: `"SOAP-AI" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Your OTP code',
    html: `<p>Your reset code is <b>${otp}</b>. It expires in 10 minutes.</p>`
  });
