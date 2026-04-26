"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exerciseRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
exports.exerciseRouter = (0, express_1.Router)();
exports.exerciseRouter.get('/', auth_1.authMiddleware, async (req, res) => {
    const { bodyPart, difficulty, goal, cultural, q, limit = '20' } = req.query;
    try {
        const exercises = await db_1.prisma.exerciseLibrary.findMany({
            where: {
                AND: [
                    bodyPart ? { bodyPart: { contains: bodyPart, mode: 'insensitive' } } : {},
                    difficulty ? { difficulty: { contains: difficulty, mode: 'insensitive' } } : {},
                    cultural === 'true' ? { isCultural: true } : {},
                    q ? {
                        OR: [
                            { name: { contains: q, mode: 'insensitive' } },
                            { bodyPart: { contains: q, mode: 'insensitive' } },
                        ],
                    } : {},
                ],
            },
            take: parseInt(limit),
            orderBy: [{ isCultural: 'desc' }, { name: 'asc' }],
        });
        return res.json({ exercises, count: exercises.length });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Could not load exercises.' });
    }
});
exports.exerciseRouter.get('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const exercise = await db_1.prisma.exerciseLibrary.findUnique({ where: { id: String(req.params.id) } });
        if (!exercise)
            return res.status(404).json({ error: 'Exercise not found.' });
        return res.json({ exercise });
    }
    catch {
        return res.status(500).json({ error: 'Could not load exercise.' });
    }
});
