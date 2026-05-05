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
                        confidence: typeof item.confidence === 'number'
                            ? item.confidence
                            : item.confidence === 'exact' ? 1.0
                                : item.confidence === 'estimated' ? 0.7
                                    : item.confidence === 'low' ? 0.4
                                        : null,
                    })),
                },
            },
            include: { items: true },
        });
        return res.status(201).json({ mealLog: meal });
    }
    catch (err) {
        console.error('[meals POST] failed:', err);
        return res.status(500).json({ error: 'Could not save meal.' });
    }
});
exports.mealsRouter.get('/', auth_1.authMiddleware, async (req, res) => {
    const tzOffset = parseInt(req.query.tz ?? '0') || 0; // minutes offset from UTC
    const dateStr = req.query.date;
    let start, end;
    if (dateStr) {
        // Parse date string in user's local timezone
        const [year, month, day] = dateStr.split('-').map(Number);
        start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - tzOffset * 60000);
        end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - tzOffset * 60000);
    }
    else {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
    }
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
    const tzOffset = parseInt(req.query.tz ?? '0') || 0; // minutes offset from UTC
    const dateStr = req.query.date;
    let start, end;
    if (dateStr) {
        // Parse date string in user's local timezone
        const [year, month, day] = dateStr.split('-').map(Number);
        start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - tzOffset * 60000);
        end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - tzOffset * 60000);
    }
    else {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
    }
    try {
        const meals = await db_1.prisma.mealLog.findMany({
            where: { userId: req.userId, loggedAt: { gte: start, lte: end } },
        });
        const profile = await db_1.prisma.userProfile.findUnique({ where: { userId: req.userId } });
        // Calculate TDEE-based calorie goal using Mifflin-St Jeor
        let caloriesGoal = 2200; // default
        let goalProtein = 120;
        let goalCarbs = 250;
        let goalFat = 70;
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
            where: { userId: req.userId, startedAt: { gte: start, lte: end } },
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
            goalProtein,
            goalCarbs,
            goalFat,
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
// ── All-time stats ───────────────────────────────────────
exports.mealsRouter.get('/all-time-stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const meals = await db_1.prisma.mealLog.findMany({ where: { userId: req.userId } });
        const workouts = await db_1.prisma.workoutSession.findMany({ where: { userId: req.userId } });
        const user = await db_1.prisma.user.findUnique({ where: { id: req.userId } });
        const totalCal = meals.reduce((s, m) => s + (m.totalCal ?? 0), 0);
        const totalProtein = meals.reduce((s, m) => s + (m.totalProtein ?? 0), 0);
        // Calculate best streak from meal logs
        const dates = [...new Set(meals.map(m => new Date(m.loggedAt).toDateString()))].sort();
        let bestStreak = 0, currentStreak = 0;
        let prevDate = null;
        for (const dateStr of dates) {
            const date = new Date(dateStr);
            if (prevDate && (date.getTime() - prevDate.getTime()) === 86400000) {
                currentStreak++;
            }
            else {
                currentStreak = 1;
            }
            bestStreak = Math.max(bestStreak, currentStreak);
            prevDate = date;
        }
        return res.json({
            totalMeals: meals.length,
            totalCal: Math.round(totalCal),
            totalProtein: Math.round(totalProtein),
            totalWorkouts: workouts.length,
            bestStreak,
            memberSince: user?.createdAt ?? new Date(),
        });
    }
    catch (err) {
        console.error('All-time stats error:', err);
        return res.status(500).json({ error: 'Could not load all-time stats.' });
    }
});
// ── Weekly stats with offset ─────────────────────────────
exports.mealsRouter.get('/weekly-stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const offset = parseInt(req.query.offset ?? '0') || 0;
        const now = new Date();
        const dayOfWeek = now.getDay() || 7; // Sunday = 0, treat as 7
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek - 1) + (offset * 7));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        const meals = await db_1.prisma.mealLog.findMany({
            where: { userId: req.userId, loggedAt: { gte: monday, lte: sunday } },
        });
        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(day);
            dayEnd.setHours(23, 59, 59, 999);
            const dayMeals = meals.filter(m => {
                const d = new Date(m.loggedAt);
                return d >= dayStart && d <= dayEnd;
            });
            days.push({
                day: day.toLocaleDateString('en-US', { weekday: 'short' }),
                date: day.toISOString().split('T')[0],
                calories: Math.round(dayMeals.reduce((s, m) => s + (m.totalCal ?? 0), 0)),
                protein: Math.round(dayMeals.reduce((s, m) => s + (m.totalProtein ?? 0), 0)),
            });
        }
        return res.json({ days });
    }
    catch (err) {
        console.error('Weekly stats error:', err);
        return res.status(500).json({ error: 'Could not load weekly stats.' });
    }
});
// ── Weekly summary ───────────────────────────────────────
exports.mealsRouter.get('/weekly-summary', auth_1.authMiddleware, async (req, res) => {
    try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const meals = await db_1.prisma.mealLog.findMany({
            where: { userId: req.userId, loggedAt: { gte: weekAgo } },
        });
        const totalCal = meals.reduce((s, m) => s + (m.totalCal ?? 0), 0);
        const totalProtein = meals.reduce((s, m) => s + (m.totalProtein ?? 0), 0);
        const daysLogged = new Set(meals.map(m => new Date(m.loggedAt).toDateString())).size;
        return res.json({
            totalCal: Math.round(totalCal),
            totalProtein: Math.round(totalProtein),
            daysLogged,
            avgDailyCal: Math.round(totalCal / 7),
        });
    }
    catch {
        return res.status(500).json({ error: 'Could not load weekly summary.' });
    }
});
// ── Progress coach insight (AI) ──────────────────────────
exports.mealsRouter.get('/progress-coach', auth_1.authMiddleware, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const meals = await db_1.prisma.mealLog.findMany({
            where: { userId: req.userId, loggedAt: { gte: today } },
        });
        const totalCal = meals.reduce((s, m) => s + (m.totalCal ?? 0), 0);
        const totalProtein = meals.reduce((s, m) => s + (m.totalProtein ?? 0), 0);
        const profile = await db_1.prisma.userProfile.findUnique({ where: { userId: req.userId } });
        let insight = "Keep going! Every logged meal is a step toward your goal.";
        if (totalProtein < 50 && totalCal > 0) {
            insight = "Your protein is on the lower side today. Consider adding lean protein at your next meal.";
        }
        else if (totalCal === 0) {
            insight = "Log your first meal of the day to track your nutrition.";
        }
        else if (profile?.goalType === "muscle_gain" && totalProtein > 100) {
            insight = "Great protein intake today! You're fueling your muscle gain goals.";
        }
        return res.json({ insight });
    }
    catch {
        return res.json({ insight: "Stay consistent with your logging — small wins add up." });
    }
});
