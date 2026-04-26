"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const ai_1 = require("../services/ai");
exports.voiceRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
exports.voiceRouter.post('/transcribe', auth_1.authMiddleware, upload.single('audio'), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: 'No audio provided.' });
    try {
        const audioBase64 = req.file.buffer.toString('base64');
        const transcript = await (0, ai_1.transcribeVoice)(audioBase64);
        return res.json({ transcript });
    }
    catch (err) {
        console.error('Voice transcription error:', err);
        return res.status(500).json({ error: 'Could not transcribe audio. Please try again.' });
    }
});
