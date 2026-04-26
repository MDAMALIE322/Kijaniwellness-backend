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
