import { Router, Response } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { analyzeIngredientLabel } from '../services/ai';

export const ingredientScanRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

ingredientScanRouter.post('/upload', authMiddleware, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided.' });

  try {
    const imageBase64 = req.file.buffer.toString('base64');
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.userId! } });

    const result = await analyzeIngredientLabel(
      imageBase64,
      profile?.goalType ?? 'wellness'
    );

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Scan failed. Please try again.' });
  }
});