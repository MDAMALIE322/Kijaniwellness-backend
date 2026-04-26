import { Router, Response } from 'express';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const profileRouter = Router();

profileRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Could not load profile.' });
  }
});

profileRouter.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { displayName, heightCm, weightKg, ageYears, biologicalSex, goalType, activityLevel, allergies, dietaryFlags, africanFoodsMode } = req.body;
  try {
    const profile = await prisma.userProfile.upsert({
      where: { userId: req.userId! },
      update: { displayName, heightCm, weightKg, ageYears, biologicalSex, goalType, activityLevel, allergies, dietaryFlags, africanFoodsMode },
      create: { userId: req.userId!, displayName, heightCm, weightKg, ageYears, biologicalSex, goalType, activityLevel, allergies, dietaryFlags, africanFoodsMode },
    });
    return res.json({ profile });
  } catch {
    return res.status(500).json({ error: 'Could not update profile.' });
  }
});
