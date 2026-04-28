import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { prisma } from "../db";
import { generateMealPlan } from "../services/ai";

export const mealPlanRouter = Router();

mealPlanRouter.post("/generate", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.userId! } });
    const { diet, cuisines, nutrition } = req.body;

    // Save meal plan preferences to profile so AI remembers them
    await prisma.userProfile.upsert({
      where: { userId: req.userId! },
      update: { mealPlanDiet: diet, mealPlanCuisines: JSON.stringify(cuisines), mealPlanNutrition: nutrition },
      create: { userId: req.userId!, mealPlanDiet: diet, mealPlanCuisines: JSON.stringify(cuisines), mealPlanNutrition: nutrition },
    }).catch(() => {}); // non-blocking

    const plan = await generateMealPlan(
      profile?.goalType ?? "wellness",
      {
        allergies: profile?.allergies ?? [],
        dietaryFlags: profile?.dietaryFlags ?? [],
        africanFoodsMode: profile?.africanFoodsMode ?? true,
        diet: diet ?? profile?.mealPlanDiet ?? "Omnivore",
        cuisines: cuisines ?? (profile?.mealPlanCuisines ? JSON.parse(profile.mealPlanCuisines) : ["African"]),
        nutrition: nutrition ?? profile?.mealPlanNutrition ?? "Balanced",
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
        diet: diet ?? profile?.mealPlanDiet ?? "Omnivore",
        cuisines: cuisines ?? (profile?.mealPlanCuisines ? JSON.parse(profile.mealPlanCuisines) : ["African"]),
        nutrition: nutrition ?? profile?.mealPlanNutrition ?? "Balanced",
        allergies: profile?.allergies ?? [],
      }
    );
    return res.json({ meal });
  } catch (err) {
    console.error("Swap meal error:", err);
    return res.status(500).json({ error: "Could not swap meal. Please try again." });
  }
});