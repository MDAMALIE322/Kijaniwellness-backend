import { Router, Response } from 'express';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const herbalRouter = Router();

const DISCLAIMER = 'Herbal products can interact with medications or health conditions. This is for logging and general wellness education only. Always consult a qualified healthcare professional.';

herbalRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { herbName, form, notes } = req.body;
  try {
    const log = await prisma.herbalLog.create({
      data: { userId: req.userId!, herbName, form, notes },
    });
    return res.status(201).json({ herbalLog: log, disclaimer: DISCLAIMER });
  } catch {
    return res.status(500).json({ error: 'Could not save herbal log.' });
  }
});

herbalRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.herbalLog.findMany({
      where: { userId: req.userId! },
      orderBy: { loggedAt: 'desc' },
      take: 50,
    });
    return res.json({ logs, disclaimer: DISCLAIMER });
  } catch {
    return res.status(500).json({ error: 'Could not load herbal logs.' });
  }
});
