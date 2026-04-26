"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.herbalRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.herbalRouter = (0, express_1.Router)();
const DISCLAIMER = 'Herbal products can interact with medications or health conditions. This is for logging and general wellness education only. Always consult a qualified healthcare professional.';
exports.herbalRouter.post('/', auth_1.authMiddleware, async (req, res) => {
    const { herbName, form, notes } = req.body;
    try {
        const log = await db_1.prisma.herbalLog.create({
            data: { userId: req.userId, herbName, form, notes },
        });
        return res.status(201).json({ herbalLog: log, disclaimer: DISCLAIMER });
    }
    catch {
        return res.status(500).json({ error: 'Could not save herbal log.' });
    }
});
exports.herbalRouter.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const logs = await db_1.prisma.herbalLog.findMany({
            where: { userId: req.userId },
            orderBy: { loggedAt: 'desc' },
            take: 50,
        });
        return res.json({ logs, disclaimer: DISCLAIMER });
    }
    catch {
        return res.status(500).json({ error: 'Could not load herbal logs.' });
    }
});
