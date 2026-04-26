"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fastingRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.fastingRouter = (0, express_1.Router)();
exports.fastingRouter.post('/start', auth_1.authMiddleware, async (req, res) => {
    const { fastType, targetHours, safetyConfirmed } = req.body;
    if (!safetyConfirmed) {
        return res.status(400).json({ error: 'Safety confirmation required.' });
    }
    try {
        const log = await db_1.prisma.fastingLog.create({
            data: {
                userId: req.userId,
                fastType,
                startedAt: new Date(),
                targetHours,
                safetyConfirmed: true,
            },
        });
        return res.status(201).json({
            fastingLog: log,
            hydrationReminder: 'Remember to stay well hydrated during your fast.',
            disclaimer: 'Stop fasting immediately if you feel unwell. Consult a healthcare professional if needed.',
        });
    }
    catch {
        return res.status(500).json({ error: 'Could not start fast.' });
    }
});
exports.fastingRouter.post('/end', auth_1.authMiddleware, async (req, res) => {
    const { fastingLogId } = req.body;
    try {
        const log = await db_1.prisma.fastingLog.update({
            where: { id: fastingLogId },
            data: { endedAt: new Date() },
        });
        const durationMs = (log.endedAt?.getTime() ?? 0) - log.startedAt.getTime();
        const durationHours = Math.round(durationMs / 3600000 * 10) / 10;
        return res.json({
            durationHours,
            message: `Well done completing your ${durationHours}-hour fast. Break your fast gently with light foods and water.`,
        });
    }
    catch {
        return res.status(500).json({ error: 'Could not end fast.' });
    }
});
