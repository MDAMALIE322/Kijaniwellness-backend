"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealPlanRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const ai_1 = require("../services/ai");
exports.mealPlanRouter = (0, express_1.Router)();
exports.mealPlanRouter.post('/generate', auth_1.authMiddleware, async (req, res) => {
    try {
        const profile = await db_1.prisma.userProfile.findUnique({ where: { userId: req.userId } });
        const plan = await (0, ai_1.generateMealPlan)(profile?.goalType ?? 'wellness', {
            allergies: profile?.allergies ?? [],
            dietaryFlags: profile?.dietaryFlags ?? [],
            africanFoodsMode: profile?.africanFoodsMode ?? true,
        });
        return res.json(plan);
    }
    catch (err) {
        console.error('Meal plan error:', err);
        return res.status(500).json({ error: 'Could not generate meal plan. Please try again.' });
    }
});
