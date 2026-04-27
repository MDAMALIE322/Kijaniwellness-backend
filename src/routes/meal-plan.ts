import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { prisma } from "../db";
import { generateMealPlan } from "../services/ai";

export const mealPlanRouter = Router();

mealPlanRouter.post("/generate", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.userId! } });
    const { diet, cuisines, nutrition } = req.body;

    const plan = await generateMealPlan(
      profile?.goalType ?? "wellness",
      {
        allergies: profile?.allergies ?? [],
        dietaryFlags: profile?.dietaryFlags ?? [],
        africanFoodsMode: profile?.africanFoodsMode ?? true,
        diet: diet ?? "Omnivore",
        cuisines: cuisines ?? ["African"],
        nutrition: nutrition ?? "Balanced",
      }
    );
    return res.json(plan);
  } catch (err) {
    console.error("Meal plan error:", err);
    return res.status(500).json({ error: "Could not generate meal plan. Please try again." });
  }
});

mealPlanRouter.post("/swap", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.userId! } });
    const { mealType, day, diet, cuisines, nutrition } = req.body;

    const { generateSingleMeal } = await import("../services/ai");
    const meal = await generateSingleMeal(
      mealType,
      profile?.goalType ?? "wellness",
      {
        diet: diet ?? "Omnivore",
        cuisines: cuisines ?? ["African"],
        nutrition: nutrition ?? "Balanced",
        allergies: profile?.allergies ?? [],
      }
    );
    return res.json({ meal });
  } catch (err) {
    console.error("Swap meal error:", err);
    return res.status(500).json({ error: "Could not swap meal. Please try again." });
  }
});