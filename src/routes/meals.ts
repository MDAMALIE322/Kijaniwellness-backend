import { Router, Response } from 'express';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const mealsRouter = Router();

mealsRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { mealType, items = [], source = 'manual', loggedAt, notes } = req.body;
  try {
    const totalCal = items.reduce((s: number, i: any) => s + (i.calories ?? 0), 0);
    const totalProtein = items.reduce((s: number, i: any) => s + (i.protein ?? 0), 0);
    const totalCarbs = items.reduce((s: number, i: any) => s + (i.carbs ?? 0), 0);
    const totalFat = items.reduce((s: number, i: any) => s + (i.fat ?? 0), 0);

    const meal = await prisma.mealLog.create({
      data: {
        userId: req.userId!,
        mealType,
        totalCal,
        totalProtein,
        totalCarbs,
        totalFat,
        source,
        notes,
        loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
        items: {
          create: items.map((item: any) => ({
            foodName: item.foodName,
            portionGrams: item.portionGrams,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            confidence: item.confidence,
          })),
        },
      },
      include: { items: true },
    });
    return res.status(201).json({ mealLog: meal });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not save meal.' });
  }
});

mealsRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const date = req.query.date ? new Date(req.query.date as string) : new Date();
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);

  try {
    const meals = await prisma.mealLog.findMany({
      where: { userId: req.userId!, loggedAt: { gte: start, lte: end } },
      include: { items: true },
      orderBy: { loggedAt: 'asc' },
    });
    return res.json({ meals });
  } catch {
    return res.status(500).json({ error: 'Could not load meals.' });
  }
});

mealsRouter.get('/daily-stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  const date = req.query.date ? new Date(req.query.date as string) : new Date();
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);

  try {
    const meals = await prisma.mealLog.findMany({
      where: { userId: req.userId!, loggedAt: { gte: start, lte: end } },
    });
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.userId! } });

    const caloriesGoal = profile?.goalType === 'fat_loss' ? 1800
      : profile?.goalType === 'muscle_gain' ? 2800 : 2200;

    return res.json({
      caloriesConsumed: Math.round(meals.reduce((s, m) => s + (m.totalCal ?? 0), 0)),
      caloriesGoal,
      protein: Math.round(meals.reduce((s, m) => s + (m.totalProtein ?? 0), 0)),
      carbs: Math.round(meals.reduce((s, m) => s + (m.totalCarbs ?? 0), 0)),
      fat: Math.round(meals.reduce((s, m) => s + (m.totalFat ?? 0), 0)),
      streakDays: 0,
    });
  } catch {
    return res.status(500).json({ error: 'Could not load stats.' });
  }
});

mealsRouter.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.mealLog.deleteMany({
      where: { id: String(req.params.id), userId: req.userId! },
    });
    return res.json({ deleted: true });
  } catch {
    return res.status(500).json({ error: 'Could not delete meal.' });
  }
});
