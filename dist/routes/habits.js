"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.habitsRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
exports.habitsRouter = (0, express_1.Router)();
exports.habitsRouter.get('/insights', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const [meals, workouts, profile] = await Promise.all([
            db_1.prisma.mealLog.findMany({
                where: { userId, loggedAt: { gte: thirtyDaysAgo } },
                orderBy: { loggedAt: 'desc' },
            }),
            db_1.prisma.workoutSession.findMany({
                where: { userId, startedAt: { gte: thirtyDaysAgo } },
                orderBy: { startedAt: 'desc' },
            }),
            db_1.prisma.userProfile.findUnique({ where: { userId } }),
        ]);
        const insights = [];
        const avgCalories = meals.length > 0
            ? meals.reduce((s, m) => s + (m.totalCal ?? 0), 0) / meals.length
            : 0;
        const avgProtein = meals.length > 0
            ? meals.reduce((s, m) => s + (m.totalProtein ?? 0), 0) / meals.length
            : 0;
        // Protein insight
        if (meals.length >= 3) {
            const proteinGoal = profile?.goalType === 'muscle_gain' ? 150 : 100;
            const isGood = avgProtein >= proteinGoal * 0.8;
            insights.push({
                type: 'Nutrition',
                title: isGood ? 'Strong protein intake' : 'Protein could be higher',
                insight: `Your average protein over the last ${meals.length} logged meals is ${Math.round(avgProtein)}g. ${isGood ? 'Great work hitting your protein target consistently.' : 'Increasing protein can support your ' + (profile?.goalType ?? 'wellness') + ' goal.'}`,
                suggestion: isGood
                    ? 'Keep including protein-rich foods like eggs, fish, legumes, and meat in your meals.'
                    : 'Try adding protein-rich foods to each meal — eggs, chicken, fish, beans, or Greek yogurt.',
                icon: '💪',
                positive: isGood,
            });
        }
        // Calorie insight
        if (meals.length >= 3) {
            const calGoal = profile?.goalType === 'fat_loss' ? 1800 : profile?.goalType === 'muscle_gain' ? 2800 : 2200;
            const diff = avgCalories - calGoal;
            const isAligned = Math.abs(diff) < 300;
            insights.push({
                type: 'Nutrition',
                title: isAligned ? 'Calories on target' : diff > 0 ? 'Calories slightly high' : 'Calories slightly low',
                insight: `Your average daily calorie intake is ${Math.round(avgCalories)} kcal. Your target for ${profile?.goalType ?? 'wellness'} is approximately ${calGoal} kcal.`,
                suggestion: isAligned
                    ? 'You are well aligned with your calorie target. Keep it consistent.'
                    : diff > 0
                        ? 'Consider slightly reducing portion sizes or choosing lower-calorie alternatives for some meals.'
                        : 'Make sure you are eating enough to fuel your body and support your goals.',
                icon: '🍽️',
                positive: isAligned,
            });
        }
        // Workout consistency
        if (workouts.length > 0) {
            const weeklyAvg = workouts.length / 4;
            const isConsistent = weeklyAvg >= 3;
            insights.push({
                type: 'Fitness',
                title: isConsistent ? 'Strong workout consistency' : 'Building workout habit',
                insight: `You have logged ${workouts.length} workouts in the last 30 days — averaging ${weeklyAvg.toFixed(1)} sessions per week.`,
                suggestion: isConsistent
                    ? 'Great consistency! Consider tracking sets, reps, and weight to monitor strength progress.'
                    : 'Aim for 3-4 workout sessions per week for consistent progress toward your goal.',
                icon: '🏋️',
                positive: isConsistent,
            });
        }
        // Logging streak
        const streakDays = await calculateStreak(userId);
        if (streakDays >= 3) {
            insights.push({
                type: 'Consistency',
                title: `${streakDays}-day logging streak`,
                insight: `You have logged your meals for ${streakDays} consecutive days. Consistent tracking is one of the strongest predictors of reaching wellness goals.`,
                suggestion: 'Keep your streak going — aim for 7 days to build a strong logging habit.',
                icon: '🔥',
                positive: true,
            });
        }
        else if (meals.length > 0) {
            insights.push({
                type: 'Consistency',
                title: 'Build your logging habit',
                insight: 'Logging meals consistently helps your AI coach give you better insights and suggestions.',
                suggestion: 'Try to log at least one meal every day — even a quick voice log counts!',
                icon: '📊',
                positive: false,
            });
        }
        return res.json({ insights, analyzedAt: new Date().toISOString() });
    }
    catch (err) {
        console.error('Habit insights error:', err);
        return res.status(500).json({ error: 'Could not analyze habits. Please try again.' });
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
        const count = await db_1.prisma.mealLog.count({ where: { userId, loggedAt: { gte: start, lte: end } } });
        if (count > 0)
            streak++;
        else if (i > 0)
            break;
    }
    return streak;
}
