import { Router, Response } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { transcribeVoice } from '../services/ai';

export const voiceRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

voiceRouter.post('/transcribe', authMiddleware, upload.single('audio'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No audio provided.' });
  try {
    const audioBase64 = req.file.buffer.toString('base64');
    const transcript = await transcribeVoice(audioBase64);
    return res.json({ transcript });
  } catch (err) {
    console.error('Voice transcription error:', err);
    return res.status(500).json({ error: 'Could not transcribe audio. Please try again.' });
  }
});