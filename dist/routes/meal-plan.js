"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealPlanRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const ai_1 = require("../services/ai");
exports.mealPlanRouter = (0, express_1.Router)();
exports.mealPlanRouter.post("/generate", auth_1.authMiddleware, async (req, res) => {
    try {
        const profile = await db_1.prisma.userProfile.findUnique({ where: { userId: req.userId } });
        const { diet, cuisines, nutrition } = req.body;
        // Save meal plan preferences to profile so AI remembers them
        await db_1.prisma.userProfile.upsert({
            where: { userId: req.userId },
            update: { mealPlanDiet: diet, mealPlanCuisines: JSON.stringify(cuisines), mealPlanNutrition: nutrition },
            create: { userId: req.userId, mealPlanDiet: diet, mealPlanCuisines: JSON.stringify(cuisines), mealPlanNutrition: nutrition },
        }).catch(() => { }); // non-blocking
        const plan = await (0, ai_1.generateMealPlan)(profile?.goalType ?? "wellness", {
            allergies: profile?.allergies ?? [],
            dietaryFlags: profile?.dietaryFlags ?? [],
            africanFoodsMode: profile?.africanFoodsMode ?? true,
            diet: diet ?? profile?.mealPlanDiet ?? "Omnivore",
            cuisines: cuisines ?? (profile?.mealPlanCuisines ? JSON.parse(profile.mealPlanCuisines) : ["African"]),
            nutrition: nutrition ?? profile?.mealPlanNutrition ?? "Balanced",
        });
        return res.json(plan);
    }
    catch (err) {
        console.error("Meal plan error:", err);
        return res.status(500).json({ error: "Could not generate meal plan. Please try again." });
    }
});
exports.mealPlanRouter.post("/swap", auth_1.authMiddleware, async (req, res) => {
    try {
        const profile = await db_1.prisma.userProfile.findUnique({ where: { userId: req.userId } });
        const { mealType, day, diet, cuisines, nutrition } = req.body;
        const { generateSingleMeal } = await Promise.resolve().then(() => __importStar(require("../services/ai")));
        const meal = await generateSingleMeal(mealType, profile?.goalType ?? "wellness", {
            diet: diet ?? profile?.mealPlanDiet ?? "Omnivore",
            cuisines: cuisines ?? (profile?.mealPlanCuisines ? JSON.parse(profile.mealPlanCuisines) : ["African"]),
            nutrition: nutrition ?? profile?.mealPlanNutrition ?? "Balanced",
            allergies: profile?.allergies ?? [],
        });
        return res.json({ meal });
    }
    catch (err) {
        console.error("Swap meal error:", err);
        return res.status(500).json({ error: "Could not swap meal. Please try again." });
    }
});
