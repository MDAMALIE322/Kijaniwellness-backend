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
  } catch (err) {
    console.error('[workouts POST] failed:', err, 'body:', JSON.stringify(req.body));
    return res.status(500).json({ error: 'Could not save workout.', detail: String(err) });
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
  } catch (err) {
    console.error('[workouts GET] failed:', err);
    return res.status(500).json({ error: 'Could not load workouts.' });
  }
});
