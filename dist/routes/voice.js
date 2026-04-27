"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const ai_1 = require("../services/ai");
exports.voiceRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
exports.voiceRouter.post("/transcribe", auth_1.authMiddleware, upload.single("audio"), async (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: "No audio provided." });
    try {
        const uint8 = new Uint8Array(req.file.buffer);
        const blob = new Blob([uint8], { type: "audio/m4a" });
        const file = new File([blob], "audio.m4a", { type: "audio/m4a" });
        const transcription = await groq.audio.transcriptions.create({
            file,
            model: "whisper-large-v3",
            language: "en",
        });
        const transcript = transcription.text;
        // Parse meal from transcript
        const mealData = await (0, ai_1.parseVoiceMeal)(transcript);
        return res.json({
            transcript,
            mealData,
        });
    }
    catch (err) {
        console.error("Voice transcription error:", err);
        return res.status(500).json({ error: "Could not transcribe audio. Please try again." });
    }
});
exports.voiceRouter.post("/log", auth_1.authMiddleware, async (req, res) => {
    const { transcript, items, mealType, totalMacros } = req.body;
    try {
        const meal = await db_1.prisma.mealLog.create({
            data: {
                userId: req.userId,
                mealType: mealType ?? "snack",
                totalCal: totalMacros?.calories ?? 0,
                totalProtein: totalMacros?.protein ?? 0,
                totalCarbs: totalMacros?.carbs ?? 0,
                totalFat: totalMacros?.fat ?? 0,
                source: "voice",
                notes: transcript,
                loggedAt: new Date(),
                items: {
                    create: (items ?? []).map((item) => ({
                        foodName: item.foodName,
                        portionGrams: item.portionGrams,
                        calories: item.calories,
                        protein: item.protein,
                        carbs: item.carbs,
                        fat: item.fat,
                        confidence: item.confidence === "exact" ? 1.0 : 0.7,
                    })),
                },
            },
            include: { items: true },
        });
        return res.status(201).json({ mealLog: meal });
    }
    catch (err) {
        console.error("Voice log error:", err);
        return res.status(500).json({ error: "Could not save meal." });
    }
});
