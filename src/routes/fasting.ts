import { Router, Response } from 'express';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const fastingRouter = Router();

fastingRouter.post('/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { fastType, targetHours, safetyConfirmed } = req.body;
  if (!safetyConfirmed) {
    return res.status(400).json({ error: 'Safety confirmation required.' });
  }
  try {
    const log = await prisma.fastingLog.create({
      data: {
        userId: req.userId!,
        fastType,
        startedAt: new Date(),
        targetHours,
        safetyConfirmed: true,
      },
    });
    return res.status(201).json({
      fastingLog: log,
      hydrationReminder: 'Remember to stay well hydrated during your fast.',
      disclaimer: 'Stop fasting immediately if you feel unwell. Consult a healthcare professional if needed.',
    });
  } catch {
    return res.status(500).json({ error: 'Could not start fast.' });
  }
});

fastingRouter.post('/end', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { fastingLogId } = req.body;
  try {
    const log = await prisma.fastingLog.update({
      where: { id: fastingLogId },
      data: { endedAt: new Date() },
    });
    const durationMs = (log.endedAt?.getTime() ?? 0) - log.startedAt.getTime();
    const durationHours = Math.round(durationMs / 3600000 * 10) / 10;
    return res.json({
      durationHours,
      message: `Well done completing your ${durationHours}-hour fast. Break your fast gently with light foods and water.`,
    });
  } catch {
    return res.status(500).json({ error: 'Could not end fast.' });
  }
});
