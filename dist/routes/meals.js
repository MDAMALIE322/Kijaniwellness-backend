"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.mealsRouter = (0, express_1.Router)();
exports.mealsRouter.post('/', auth_1.authMiddleware, async (req, res) => {
    const { mealType, items = [], source = 'manual', loggedAt, notes } = req.body;
    try {
        const totalCal = items.reduce((s, i) => s + (i.calories ?? 0), 0);
        const totalProtein = items.reduce((s, i) => s + (i.protein ?? 0), 0);
        const totalCarbs = items.reduce((s, i) => s + (i.carbs ?? 0), 0);
        const totalFat = items.reduce((s, i) => s + (i.fat ?? 0), 0);
        const meal = await db_1.prisma.mealLog.create({
            data: {
                userId: req.userId,
                mealType,
                totalCal,
                totalProtein,
                totalCarbs,
                totalFat,
                source,
                notes,
                loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
                items: {
                    create: items.map((item) => ({
                        foodName: item.foodName,
                        portionGrams: item.portionGrams,
                        calories: item.calories,
                        protein: item.protein,
                        carbs: item.carbs,
                        fat: item.fat,
                        confidence: item.confidence,
                    })),
                },
            },
            include: { items: true },
        });
        return res.status(201).json({ mealLog: meal });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Could not save meal.' });
    }
});
exports.mealsRouter.get('/', auth_1.authMiddleware, async (req, res) => {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    try {
        const meals = await db_1.prisma.mealLog.findMany({
            where: { userId: req.userId, loggedAt: { gte: start, lte: end } },
            include: { items: true },
            orderBy: { loggedAt: 'asc' },
        });
        return res.json({ meals });
    }
    catch {
        return res.status(500).json({ error: 'Could not load meals.' });
    }
});
exports.mealsRouter.get('/daily-stats', auth_1.authMiddleware, async (req, res) => {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    try {
        const meals = await db_1.prisma.mealLog.findMany({
            where: { userId: req.userId, loggedAt: { gte: start, lte: end } },
        });
        const profile = await db_1.prisma.userProfile.findUnique({ where: { userId: req.userId } });
        // Calculate TDEE-based calorie goal using Mifflin-St Jeor
        let caloriesGoal = 2200; // default
        if (profile?.weightKg && profile?.heightCm && profile?.ageYears) {
            const w = profile.weightKg;
            const h = profile.heightCm;
            const a = profile.ageYears;
            const sex = profile.biologicalSex ?? "male";
            const bmr = sex === "female"
                ? 10 * w + 6.25 * h - 5 * a - 161
                : 10 * w + 6.25 * h - 5 * a + 5;
            const multipliers = {
                sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725, athlete: 1.9,
            };
            const tdee = Math.round(bmr * (multipliers[profile.activityLevel ?? "moderate"] ?? 1.55));
            if (profile.goalType === "fat_loss")
                caloriesGoal = Math.round(tdee - 500);
            else if (profile.goalType === "muscle_gain")
                caloriesGoal = Math.round(tdee + 300);
            else
                caloriesGoal = tdee;
        }
        else {
            // Fallback if no profile data
            caloriesGoal = profile?.goalType === "fat_loss" ? 1800
                : profile?.goalType === "muscle_gain" ? 2800 : 2200;
        }
        // Calculate streak
        const streakDays = await calculateStreak(req.userId);
        // Generate nudge
        const caloriesConsumed = Math.round(meals.reduce((s, m) => s + (m.totalCal ?? 0), 0));
        const protein = Math.round(meals.reduce((s, m) => s + (m.totalProtein ?? 0), 0));
        let nudge;
        if (caloriesConsumed === 0)
            nudge = 'Start your day by logging your first meal!';
        else if (protein < 50 && profile?.goalType === 'muscle_gain')
            nudge = 'Protein is low today — try adding a protein-rich meal.';
        else if (caloriesConsumed > caloriesGoal * 0.9)
            nudge = 'Almost at your daily goal — great consistency!';
        else if (streakDays >= 3)
            nudge = `${streakDays}-day streak! Keep it going!`;
        const totalCarbs = Math.round(meals.reduce((s, m) => s + (m.totalCarbs ?? 0), 0));
        const totalFat = Math.round(meals.reduce((s, m) => s + (m.totalFat ?? 0), 0));
        // Workouts today
        const workoutsToday = await db_1.prisma.workoutSession.count({
            where: { userId: req.userId, createdAt: { gte: start, lte: end } },
        });
        // Consistency
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentMeals = await db_1.prisma.mealLog.findMany({
            where: { userId: req.userId, loggedAt: { gte: thirtyDaysAgo } },
            select: { loggedAt: true },
        });
        const uniqueDays = new Set(recentMeals.map(m => new Date(m.loggedAt).toDateString()));
        const consistencyPct = Math.round((uniqueDays.size / 30) * 100);
        return res.json({
            // New field names
            totalCal: caloriesConsumed,
            totalProtein: protein,
            totalCarbs,
            totalFat,
            caloriesGoal,
            streak: streakDays,
            workoutsToday,
            consistencyPct,
            nudge,
            // Legacy field names for compatibility
            caloriesConsumed,
            protein,
            carbs: totalCarbs,
            fat: totalFat,
            streakDays,
        });
    }
    catch {
        return res.status(500).json({ error: 'Could not load stats.' });
    }
});
exports.mealsRouter.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        await db_1.prisma.mealLog.deleteMany({
            where: { id: String(req.params.id), userId: req.userId },
        });
        return res.json({ deleted: true });
    }
    catch {
        return res.status(500).json({ error: 'Could not delete meal.' });
    }
});
async function calculateStreak(userId) {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        const count = await db_1.prisma.mealLog.count({
            where: { userId, loggedAt: { gte: start, lte: end } },
        });
        if (count > 0)
            streak++;
        else if (i > 0)
            break;
    }
    return streak;
}
