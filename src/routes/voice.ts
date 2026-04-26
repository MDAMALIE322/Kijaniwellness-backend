import { Router, Response } from "express";
import multer from "multer";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import Groq from "groq-sdk";

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

    return res.json({ transcript: transcription.text });
  } catch (err) {
    console.error("Voice transcription error:", err);
    return res.status(500).json({ error: "Could not transcribe audio. Please try again." });
  }
});