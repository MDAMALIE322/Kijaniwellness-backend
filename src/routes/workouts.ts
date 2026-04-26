import { Router, Response } from 'express';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const workoutsRouter = Router();

workoutsRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { exercises, durationMin, notes, startedAt } = req.body;
  try {
    const session = await prisma.workoutSession.create({
      data: {
        userId: req.userId!,
        exercises,
        durationMin,
        notes,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
      },
    });
    return res.status(201).json({ session });
  } catch {
    return res.status(500).json({ error: 'Could not save workout.' });
  }
});

workoutsRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.workoutSession.findMany({
      where: { userId: req.userId! },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });
    return res.json({ sessions });
  } catch {
    return res.status(500).json({ error: 'Could not load workouts.' });
  }
});
