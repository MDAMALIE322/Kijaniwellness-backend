import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

export const exerciseRouter = Router();

exerciseRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { bodyPart, difficulty, goal, cultural, q, limit = '20' } = req.query;

  try {
    const exercises = await prisma.exerciseLibrary.findMany({
      where: {
        AND: [
          bodyPart ? { bodyPart: { contains: bodyPart as string, mode: 'insensitive' } } : {},
          difficulty ? { difficulty: { contains: difficulty as string, mode: 'insensitive' } } : {},
          cultural === 'true' ? { isCultural: true } : {},
          q ? {
            OR: [
              { name: { contains: q as string, mode: 'insensitive' } },
              { bodyPart: { contains: q as string, mode: 'insensitive' } },
            ],
          } : {},
        ],
      },
      take: parseInt(limit as string),
      orderBy: [{ isCultural: 'desc' }, { name: 'asc' }],
    });
    return res.json({ exercises, count: exercises.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not load exercises.' });
  }
});

exerciseRouter.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const exercise = await prisma.exerciseLibrary.findUnique({ where: { id: String(req.params.id) } });
    if (!exercise) return res.status(404).json({ error: 'Exercise not found.' });
    return res.json({ exercise });
  } catch {
    return res.status(500).json({ error: 'Could not load exercise.' });
  }
});