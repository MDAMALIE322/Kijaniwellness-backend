"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.foodScanRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const ai_1 = require("../services/ai");
exports.foodScanRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
exports.foodScanRouter.post('/upload', auth_1.authMiddleware, upload.single('image'), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'No image provided.' });
    try {
        const imageBase64 = req.file.buffer.toString('base64');
        const profile = await db_1.prisma.userProfile.findUnique({ where: { userId: req.userId } });
        const result = await (0, ai_1.analyzeFoodImage)(imageBase64, profile?.goalType ?? 'wellness', profile?.africanFoodsMode ?? true);
        return res.json({ ...result, scanId: `scan_${Date.now()}` });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Scan failed. Please try again.' });
    }
});
