"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../db");
const jwt_1 = require("../utils/jwt");
const email_1 = require("../services/email");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required.' });
    if (password.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    try {
        const existing = await db_1.prisma.user.findUnique({ where: { email } });
        if (existing)
            return res.status(409).json({ error: 'An account with this email already exists.' });
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await db_1.prisma.user.create({
            data: { email, passwordHash },
        });
        // Create default profile
        await db_1.prisma.userProfile.create({
            data: { userId: user.id },
        });
        const tokens = (0, jwt_1.signTokens)(user.id, user.email);
        return res.status(201).json({
            ...tokens,
            user: { id: user.id, email: user.email },
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});
exports.authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required.' });
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { email },
            include: { profile: true },
        });
        if (!user || !user.passwordHash) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        if (user.deletedAt) {
            return res.status(403).json({ error: 'This account has been deactivated.' });
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid)
            return res.status(401).json({ error: 'Invalid email or password.' });
        const tokens = (0, jwt_1.signTokens)(user.id, user.email);
        return res.json({
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                profile: user.profile ? {
                    displayName: user.profile.displayName,
                    goalType: user.profile.goalType,
                    africanFoodsMode: user.profile.africanFoodsMode,
                } : null,
            },
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});
exports.authRouter.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken)
        return res.status(400).json({ error: 'Refresh token required.' });
    try {
        const payload = (0, jwt_1.verifyRefresh)(refreshToken);
        const { accessToken } = (0, jwt_1.signTokens)(payload.userId, payload.email);
        return res.json({ accessToken });
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }
});
// ── Forgot Password ─────────────────────────────────────
exports.authRouter.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email)
        return res.status(400).json({ error: 'Email is required.' });
    try {
        const user = await db_1.prisma.user.findUnique({ where: { email } });
        // Always return success to prevent email enumeration
        if (!user || !user.passwordHash) {
            return res.json({ message: 'If an account exists, a reset code has been sent.' });
        }
        // Generate 6-digit code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetTokenExp = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await db_1.prisma.user.update({
            where: { email },
            data: { resetToken: resetCode, resetTokenExp },
        });
        await (0, email_1.sendPasswordResetEmail)(email, resetCode);
        return res.json({ message: 'If an account exists, a reset code has been sent.' });
    }
    catch (err) {
        console.error('Forgot password error:', err);
        return res.status(500).json({ error: 'Could not send reset email. Please try again.' });
    }
});
// ── Reset Password ───────────────────────────────────────
exports.authRouter.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
        return res.status(400).json({ error: 'Email, code, and new password are required.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    try {
        const user = await db_1.prisma.user.findUnique({ where: { email } });
        if (!user || !user.resetToken || !user.resetTokenExp) {
            return res.status(400).json({ error: 'Invalid or expired reset code.' });
        }
        if (user.resetToken !== code) {
            return res.status(400).json({ error: 'Invalid reset code.' });
        }
        if (new Date() > user.resetTokenExp) {
            return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        await db_1.prisma.user.update({
            where: { email },
            data: { passwordHash, resetToken: null, resetTokenExp: null },
        });
        return res.json({ message: 'Password reset successfully. You can now log in.' });
    }
    catch (err) {
        console.error('Reset password error:', err);
        return res.status(500).json({ error: 'Could not reset password. Please try again.' });
    }
});
