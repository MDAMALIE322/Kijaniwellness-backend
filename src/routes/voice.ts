import { Router, Response } from "express";
import multer from "multer";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { prisma } from "../db";
import Groq from "groq-sdk";
import { parseVoiceMeal } from "../services/ai";

export const voiceRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

voiceRouter.post("/transcribe", authMiddleware, upload.single("audio"), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No audio provided." });

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
    const mealData = await parseVoiceMeal(transcript);

    return res.json({
      transcript,
      mealData,
    });
  } catch (err) {
    console.error("Voice transcription error:", err);
    return res.status(500).json({ error: "Could not transcribe audio. Please try again." });
  }
});

voiceRouter.post("/log", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { transcript, items, mealType, totalMacros } = req.body;
  try {
    const meal = await prisma.mealLog.create({
      data: {
        userId: req.userId!,
        mealType: mealType ?? "snack",
        totalCal: totalMacros?.calories ?? 0,
        totalProtein: totalMacros?.protein ?? 0,
        totalCarbs: totalMacros?.carbs ?? 0,
        totalFat: totalMacros?.fat ?? 0,
        source: "voice",
        notes: transcript,
        loggedAt: new Date(),
        items: {
          create: (items ?? []).map((item: any) => ({
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
  } catch (err) {
    console.error("Voice log error:", err);
    return res.status(500).json({ error: "Could not save meal." });
  }
});

voiceRouter.post('/describe', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { description } = req.body;
  if (!description?.trim()) return res.status(400).json({ error: 'Please describe what you ate.' });
  try {
    const { parseVoiceMeal } = await import('../services/ai');
    const result = await parseVoiceMeal(description.trim());
    return res.json(result);
  } catch (err) {
    console.error('Describe meal error:', err);
    return res.status(500).json({ error: 'Could not analyze your meal. Please try again.' });
  }
});
