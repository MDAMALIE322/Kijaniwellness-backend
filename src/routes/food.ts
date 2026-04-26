import { Router, Response } from 'express';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const foodRouter = Router();

foodRouter.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  const q = ((req.query.q as string) ?? '').toLowerCase().trim();
  const africanOnly = req.query.african === 'true';
  const limit = Math.min(parseInt((req.query.limit as string) ?? '20'), 50);

  try {
    const foods = await prisma.foodDatabase.findMany({
      where: {
        AND: [
          africanOnly ? { isAfrican: true } : {},
          q ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { nameLocal: { contains: q, mode: 'insensitive' } },
              { culturalRegion: { contains: q, mode: 'insensitive' } },
            ],
          } : {},
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
    return res.json({ foods, count: foods.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not search foods.' });
  }
});

foodRouter.get('/african', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const foods = await prisma.foodDatabase.findMany({
      where: { isAfrican: true },
      orderBy: { name: 'asc' },
      take: 100,
    });
    return res.json({ foods, count: foods.length });
  } catch {
    return res.status(500).json({ error: 'Could not load African foods.' });
  }
});