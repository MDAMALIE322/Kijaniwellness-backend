"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.profileRouter = (0, express_1.Router)();
exports.profileRouter.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { id: req.userId },
            include: { profile: true },
        });
        if (!user)
            return res.status(404).json({ error: 'User not found.' });
        return res.json({
            user: {
                id: user.id,
                email: user.email,
                profile: user.profile,
            },
        });
    }
    catch {
        return res.status(500).json({ error: 'Could not load profile.' });
    }
});
exports.profileRouter.put('/', auth_1.authMiddleware, async (req, res) => {
    const { displayName, heightCm, weightKg, ageYears, biologicalSex, goalType, activityLevel, allergies, dietaryFlags, africanFoodsMode } = req.body;
    try {
        const profile = await db_1.prisma.userProfile.upsert({
            where: { userId: req.userId },
            update: { displayName, heightCm, weightKg, ageYears, biologicalSex, goalType, activityLevel, allergies, dietaryFlags, africanFoodsMode },
            create: { userId: req.userId, displayName, heightCm, weightKg, ageYears, biologicalSex, goalType, activityLevel, allergies, dietaryFlags, africanFoodsMode },
        });
        return res.json({ profile });
    }
    catch {
        return res.status(500).json({ error: 'Could not update profile.' });
    }
});
