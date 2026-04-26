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
        const caloriesGoal = profile?.goalType === 'fat_loss' ? 1800
            : profile?.goalType === 'muscle_gain' ? 2800 : 2200;
        return res.json({
            caloriesConsumed: Math.round(meals.reduce((s, m) => s + (m.totalCal ?? 0), 0)),
            caloriesGoal,
            protein: Math.round(meals.reduce((s, m) => s + (m.totalProtein ?? 0), 0)),
            carbs: Math.round(meals.reduce((s, m) => s + (m.totalCarbs ?? 0), 0)),
            fat: Math.round(meals.reduce((s, m) => s + (m.totalFat ?? 0), 0)),
            streakDays: 0,
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
