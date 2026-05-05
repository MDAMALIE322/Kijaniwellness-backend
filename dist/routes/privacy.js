"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.privacyRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.privacyRouter = (0, express_1.Router)();
exports.privacyRouter.post('/data-export/request', auth_1.authMiddleware, async (req, res) => {
    try {
        const request = await db_1.prisma.dataExportRequest.create({
            data: { userId: req.userId, status: 'pending' },
        });
        return res.json({ requestId: request.id, estimatedReady: '24 hours' });
    }
    catch {
        return res.status(500).json({ error: 'Could not process export request.' });
    }
});
exports.privacyRouter.post('/delete-account', auth_1.authMiddleware, async (req, res) => {
    const userId = req.userId;
    try {
        await db_1.prisma.$transaction(async (tx) => {
            // Wipe child records first (FK dependencies)
            await tx.mealItem.deleteMany({ where: { mealLog: { userId } } });
            await tx.mealLog.deleteMany({ where: { userId } });
            await tx.workoutSession.deleteMany({ where: { userId } });
            await tx.fastingLog.deleteMany({ where: { userId } });
            await tx.herbalLog.deleteMany({ where: { userId } });
            await tx.privacyConsent.deleteMany({ where: { userId } });
            await tx.dataExportRequest.deleteMany({ where: { userId } });
            await tx.userProfile.deleteMany({ where: { userId } });
            // Finally remove the user
            await tx.user.delete({ where: { id: userId } });
        });
        return res.json({ deleted: true, message: 'Account and all associated data have been permanently deleted.' });
    }
    catch (err) {
        console.error('[delete-account] failed:', err);
        return res.status(500).json({ error: 'Could not delete account. Please try again or contact support.' });
    }
});
exports.privacyRouter.post('/consent', auth_1.authMiddleware, async (req, res) => {
    const { consentType, accepted, version } = req.body;
    try {
        await db_1.prisma.privacyConsent.create({
            data: { userId: req.userId, consentType, accepted, acceptedAt: new Date(), version: version ?? '1.0' },
        });
        return res.json({ success: true });
    }
    catch {
        return res.status(500).json({ error: 'Could not save consent.' });
    }
});
