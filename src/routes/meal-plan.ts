import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';
import { generateMealPlan } from '../services/ai';

export const mealPlanRouter = Router();

mealPlanRouter.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.userId! } });
    const plan = await generateMealPlan(
      profile?.goalType ?? 'wellness',
      {
        allergies: profile?.allergies ?? [],
        dietaryFlags: profile?.dietaryFlags ?? [],
        africanFoodsMode: profile?.africanFoodsMode ?? true,
      }
    );
    return res.json(plan);
  } catch (err) {
    console.error('Meal plan error:', err);
    return res.status(500).json({ error: 'Could not generate meal plan. Please try again.' });
  }
});