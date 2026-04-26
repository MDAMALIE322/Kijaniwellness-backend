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
    try {
        await db_1.prisma.user.update({
            where: { id: req.userId },
            data: { deletedAt: new Date() },
        });
        return res.json({ scheduled: true, message: 'Account deletion scheduled. All data will be removed within 30 days.' });
    }
    catch {
        return res.status(500).json({ error: 'Could not process deletion.' });
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
