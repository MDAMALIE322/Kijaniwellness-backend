"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.foodRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.foodRouter = (0, express_1.Router)();
exports.foodRouter.get('/search', auth_1.authMiddleware, async (req, res) => {
    const q = (req.query.q ?? '').toLowerCase().trim();
    const africanOnly = req.query.african === 'true';
    const limit = Math.min(parseInt(req.query.limit ?? '20'), 50);
    try {
        const foods = await db_1.prisma.foodDatabase.findMany({
            where: {
                AND: [
                    africanOnly ? { isAfrican: true } : {},
                    q ? {
                        OR: [
                            { name: { contains: q, mode: 'insensitive' } },
                            { nameLocal: { contains: q, mode: 'insensitive' } },
                            { culturalRegion: { contains: q, mode: 'insensitive' } },
                        ],
                    } : {},
                ],
            },
            take: limit,
            orderBy: { name: 'asc' },
        });
        return res.json({ foods, count: foods.length });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Could not search foods.' });
    }
});
exports.foodRouter.get('/african', auth_1.authMiddleware, async (_req, res) => {
    try {
        const foods = await db_1.prisma.foodDatabase.findMany({
            where: { isAfrican: true },
            orderBy: { name: 'asc' },
            take: 100,
        });
        return res.json({ foods, count: foods.length });
    }
    catch {
        return res.status(500).json({ error: 'Could not load African foods.' });
    }
});
