"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    auth: {
        user: "mawufemordamalie@gmail.com",
        pass: "mhta psmf pbvz tolu",
    },
});
async function sendPasswordResetEmail(toEmail, resetCode) {
    await transporter.sendMail({
        from: '"Kijani Wellness" <mawufemordamalie@gmail.com>',
        to: toEmail,
        subject: "Reset your Kijani Wellness password",
        html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#050d07;color:#e8f5ee;border-radius:16px;">
        <h1 style="color:#3ECF74;font-size:28px;margin-bottom:8px;">Kijani Wellness</h1>
        <p style="color:#9ABFAA;margin-bottom:24px;">Password Reset Request</p>
        <p style="color:#e8f5ee;margin-bottom:16px;">Use this code to reset your password. It expires in <strong>15 minutes</strong>.</p>
        <div style="background:#162D22;border-radius:12px;padding:24px;text-align:center;margin:24px 0;border:1px solid #2A4A38;">
          <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#3ECF74;">${resetCode}</span>
        </div>
        <p style="color:#9ABFAA;font-size:13px;">If you did not request this, please ignore this email. Your password will not change.</p>
        <p style="color:#5C8070;font-size:12px;margin-top:24px;">Kijani Wellness · kijaniwellness.com</p>
      </div>
    `,
    });
}
