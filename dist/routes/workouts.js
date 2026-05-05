"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workoutsRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.workoutsRouter = (0, express_1.Router)();
exports.workoutsRouter.post('/', auth_1.authMiddleware, async (req, res) => {
    const { exercises, durationMin, notes, startedAt } = req.body;
    try {
        const session = await db_1.prisma.workoutSession.create({
            data: {
                userId: req.userId,
                exercises,
                durationMin,
                notes,
                startedAt: startedAt ? new Date(startedAt) : new Date(),
            },
        });
        return res.status(201).json({ session });
    }
    catch (err) {
        console.error('[workouts POST] failed:', err, 'body:', JSON.stringify(req.body));
        return res.status(500).json({ error: 'Could not save workout.', detail: String(err) });
    }
});
exports.workoutsRouter.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const sessions = await db_1.prisma.workoutSession.findMany({
            where: { userId: req.userId },
            orderBy: { startedAt: 'desc' },
            take: 30,
        });
        return res.json({ sessions });
    }
    catch (err) {
        console.error('[workouts GET] failed:', err);
        return res.status(500).json({ error: 'Could not load workouts.' });
    }
});
