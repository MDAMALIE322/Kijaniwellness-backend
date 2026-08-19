import Groq from 'groq-sdk';
import { safetyFilter } from '../utils/safetyFilter';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Vision model is env-configurable so a Groq deprecation is a Railway env change, not a deploy.
// Fallback is tried automatically if the primary returns 404 (model decommissioned/not found).
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-maverick-17b-128e-instruct';
const VISION_FALLBACK = process.env.GROQ_VISION_FALLBACK || 'meta-llama/llama-4-scout-17b-16e-instruct';

// Retry wrapper for Groq calls - handles rate limits (429) with backoff
async function groqChatWithRetry(params: any, maxRetries = 2): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await groq.chat.completions.create(params);
    } catch (err: any) {
      lastErr = err;
      // Model decommissioned / not found: retry once with the fallback vision model
      if (err?.status === 404 && params?.model === VISION_MODEL && VISION_FALLBACK !== VISION_MODEL) {
        console.log(`Vision model ${VISION_MODEL} returned 404, falling back to ${VISION_FALLBACK}`);
        return await groqChatWithRetry({ ...params, model: VISION_FALLBACK }, maxRetries);
      }
      if (err?.status === 429) {
        // Respect Groq's retry-after header if present, else backoff
        const retryAfter = parseFloat(err?.headers?.get?.('retry-after') ?? '3');
        const waitMs = Math.min((retryAfter + 1) * 1000, 12000);
        console.log(`Rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err; // Non-rate-limit errors fail immediately
    }
  }
  throw lastErr;
}

export interface FoodItem {
  foodName: string;
  portionGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

export interface ScanResult {
  items: FoodItem[];
  totalMacros: { calories: number; protein: number; carbs: number; fat: number };
  goalNote?: string;
  disclaimer: string;
}

export async function analyzeFoodImage(
  imageBase64: string,
  goalType: string,
  africanMode: boolean
): Promise<ScanResult> {
  const africanContext = africanMode
    ? 'This user eats African cuisine. Prioritize identifying African foods: jollof rice, egusi soup, fufu, ugali, plantain, suya, moi moi, banku, kenkey, waakye, groundnut soup, okra soup, injera, nyama choma, cassava, yam, pepper soup, pounded yam, eba, tuwo, kilishi, chapati, pilau, doro wat, shiro, couscous, tagine.'
    : '';

  const prompt = `You are a food nutrition assistant. Analyze this food image carefully.

${africanContext}

For each food item visible:
1. Identify the exact food name
2. Estimate realistic portion size in grams
3. Calculate: calories, protein (g), carbs (g), fat (g)
4. Provide confidence score (0.0 to 1.0)

Rules:
- Be specific with food names
- No medical claims or disease references
- CRITICAL: If the image does NOT contain food (e.g. clothing, objects, people, scenery, text), return {"items": [], "notFood": true}
- Only identify items you are confident are food. Do NOT guess or assume.
- If you cannot clearly identify food, return empty items array
- You MUST respond with ONLY a valid JSON object. No explanations, no text before or after. ONLY JSON:

{
  "items": [
    {
      "foodName": "string",
      "portionGrams": number,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "confidence": number
    }
  ]
}`;

  try {
    const response = await groqChatWithRetry({
      model: VISION_MODEL,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const text = response.choices[0]?.message?.content ?? '{"items":[]}';
    console.log('=== RAW VISION MODEL RESPONSE ===');
    console.log(text);
    console.log('=== END RAW RESPONSE ===');
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed: any = { items: [] };
    try {
      // Find JSON in response even if surrounded by text
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
        console.log('=== PARSED RESULT ===', JSON.stringify(parsed));
        // If AI detected non-food image
        if (parsed.notFood || !parsed.items || parsed.items.length === 0) {
          return {
            items: [],
            totalMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            disclaimer: parsed.notFood
              ? 'No food detected in this image. Please scan a meal or food item.'
              : 'Could not identify any food items. Try better lighting or a clearer angle.',
          };
        }
      } else {
        // Model returned text - no food detected
        console.log('Vision model returned non-JSON:', clean.substring(0, 100));
        parsed = { items: [] };
      }
    } catch (parseErr) {
      console.log('JSON parse failed, no food detected:', clean.substring(0, 100));
      parsed = { items: [] };
    }
    const items: FoodItem[] = parsed.items ?? [];

    const totalMacros = {
      calories: Math.round(items.reduce((s, i) => s + i.calories, 0)),
      protein: Math.round(items.reduce((s, i) => s + i.protein, 0)),
      carbs: Math.round(items.reduce((s, i) => s + i.carbs, 0)),
      fat: Math.round(items.reduce((s, i) => s + i.fat, 0)),
    };

    const goalNote = await generateGoalNote(totalMacros, goalType);

    return {
      items,
      totalMacros,
      goalNote,
      disclaimer: 'Nutritional estimates are approximate. Portion sizes and preparation methods affect actual values.',
    };
  } catch (err) {
    console.error('Food scan AI error:', err);
    return {
      items: [],
      totalMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      disclaimer: 'Could not analyze image. Please try again with better lighting.',
    };
  }
}

async function generateGoalNote(
  macros: { calories: number; protein: number; carbs: number; fat: number },
  goalType: string
): Promise<string | undefined> {
  const prompt = `You are a supportive wellness coach. Write ONE short encouraging sentence (max 20 words) about how this meal relates to the user goal.

Meal: ${macros.calories} calories, ${macros.protein}g protein, ${macros.carbs}g carbs, ${macros.fat}g fat
Goal: ${goalType}

Rules:
- Positive and supportive tone
- No medical claims or disease references
- No words: healthy/unhealthy, diagnose, treat, cure, disease
- Return only the sentence, nothing else`;

  try {
    const res = await groqChatWithRetry({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 50,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    const filtered = safetyFilter(text);
    return filtered.blocked ? undefined : filtered.safeText;
  } catch {
    return undefined;
  }
}

export async function analyzeIngredientLabel(
  imageBase64: string,
  goalType: string
): Promise<object> {
  const prompt = `You are Kijani Coach — an expert food label analyst with OCR capabilities. Your job is to carefully read and extract ALL text visible in this food product label or ingredient list image.

CRITICAL INSTRUCTIONS:
- Read every word visible in the image carefully, including small print
- This could be a nutrition facts panel, ingredient list, or product label
- Even if the image is at an angle or partially blurry, extract what you can
- If you can see ANY text related to food/nutrition, analyze it
- Do NOT return unknown/empty if there is ANY readable text in the image
- If truly unreadable, set "cannotRead": true in your response

User goal: ${goalType}

User goal: ${goalType}

Your job:
1. Identify the product name
2. Extract nutrition per 100g (estimate if not clearly visible)
3. Analyze every ingredient listed and explain what it is and what it does in the body
4. Identify wellness concerns and benefits
5. Give a goal alignment verdict
6. Give a Kijani Coach insight — practical, honest, encouraging

INGREDIENT ANALYSIS RULES:
- For each notable ingredient, explain: what it is, what it does, and whether it is beneficial or a concern
- Examples of what to flag:
  * High fructose corn syrup → "A highly processed sweetener. Consuming it frequently may contribute to excess calorie intake and blood sugar spikes."
  * Palm oil → "A saturated fat source. Fine in moderation but limit if reducing saturated fat intake."
  * Sodium benzoate → "A preservative used to extend shelf life. Generally recognized as safe in small amounts."
  * Whey protein → "A complete protein source derived from milk. Excellent for muscle recovery and growth."
  * Maltodextrin → "A processed carbohydrate with a high glycaemic index. Can cause rapid blood sugar spikes."
  * Aspartame → "An artificial sweetener with zero calories. Some people prefer to avoid artificial sweeteners."
  * Whole oats → "A whole grain high in beta-glucan fibre. Supports satiety and digestive health."
  * Potassium chloride → "A salt substitute used to reduce sodium content. Generally well tolerated."

WELLNESS FLAGS (use relevant ones):
- high_sugar: sugar > 15g per 100g
- high_sodium: sodium > 600mg per 100g  
- highly_processed: contains artificial colours, preservatives, or more than 5 additives
- high_protein: protein > 15g per 100g
- good_fiber: fiber > 5g per 100g
- high_saturated_fat: saturated fat > 5g per 100g
- artificial_sweeteners: contains aspartame, sucralose, acesulfame-K, saccharin
- whole_food: minimal processing, recognizable ingredients
- good_for_goal: specifically aligns well with stated user goal

GOAL ALIGNMENT:
- good: clearly supports the user goal
- moderate: acceptable occasionally, has some concerns
- limit: conflicts with user goal or has significant wellness concerns

You MUST respond with ONLY valid JSON. No text before or after:
{
  "productName": "string",
  "macros": { "cal": 0, "protein": 0, "carbs": 0, "fat": 0, "sugar": 0, "sodium": 0, "fiber": 0 },
  "goalAlignment": "good|moderate|limit",
  "goalAlignmentReason": "one sentence explaining why",
  "ingredientInsights": [
    { "ingredient": "ingredient name", "explanation": "what it is and what it does", "concern": true or false }
  ],
  "flags": [{ "type": "string", "label": "string", "explanation": "string" }],
  "coachInsight": "2-3 sentence Kijani Coach message about this product — practical, honest, encouraging",
  "alternative": "suggest a better alternative product or food if alignment is limit or moderate",
  "disclaimer": "This is general wellness information only. Not medical advice. Individual responses to foods vary. Consult a registered dietitian for personalised nutrition guidance."
}`;

  try {
    const response = await groqChatWithRetry({
      model: VISION_MODEL,
      max_tokens: 3500,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    console.log('=== INGREDIENT SCAN RAW RESPONSE ===');
    console.log(text);
    console.log('=== END RAW RESPONSE ===');
    const clean = text.replace(/```json|```/g, '').trim();
    try {
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(clean);
      console.log('=== INGREDIENT PARSED ===', JSON.stringify(parsed));
      // If AI flagged it cannot read
      if (parsed.cannotRead) {
        return {
          productName: "Label unclear",
          cannotRead: true,
          macros: { cal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0, fiber: 0 },
          goalAlignment: "unknown",
          flags: [],
          disclaimer: "We couldn\'t read this label clearly. Try taking a closer photo in good lighting, keeping the label flat and fully visible.",
        };
      }
      return parsed;
    } catch (parseErr) {
      console.error('=== INGREDIENT SCAN PARSE ERROR ===', parseErr);
      return {
        productName: "Unknown",
        cannotRead: true,
        macros: { cal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0, fiber: 0 },
        goalAlignment: "moderate",
        flags: [],
        disclaimer: "Could not analyze this label. Please try again with better lighting and a clearer angle.",
      };
    }
  } catch (err) {
    console.error('Ingredient scan AI error:', err);
    return {
      productName: 'Unknown Product',
      macros: { cal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0, fiber: 0 },
      goalAlignment: 'moderate',
      flags: [],
      disclaimer: 'Could not analyze this item. Please try again.',
    };
  }
}

export async function generateWeeklySummary(weekData: {
  avgCalories: number;
  avgProtein: number;
  workoutCount: number;
  consistencyPct: number;
  goal: string;
}): Promise<{ message: string; wins: string[]; areasToImprove: string[]; nextFocus: string }> {
  const prompt = `You are a warm wellness coach. Write a brief weekly summary.

Data:
- Goal: ${weekData.goal}
- Average daily calories: ${weekData.avgCalories} kcal
- Average daily protein: ${weekData.avgProtein}g
- Workouts completed: ${weekData.workoutCount}
- Consistency score: ${weekData.consistencyPct}%

You MUST respond with ONLY a valid JSON object. No explanations, no text before or after. ONLY JSON:
{
  "message": "2-3 sentence personal coach message",
  "wins": ["win 1", "win 2"],
  "areasToImprove": ["area 1"],
  "nextFocus": "one thing to focus on next week"
}

Rules:
- Warm supportive tone
- No medical claims
- No words: healthy/unhealthy, diagnose, treat, cure, disease`;

  try {
    const res = await groqChatWithRetry({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.choices[0]?.message?.content ?? '{}';
    const filtered = safetyFilter(text);
    return JSON.parse(filtered.safeText.replace(/```json|```/g, '').trim());
  } catch {
    return {
      message: 'Great week! Keep building on your consistency.',
      wins: ['Logged meals consistently'],
      areasToImprove: ['Try to hit your protein target daily'],
      nextFocus: 'Consistency with daily logging',
    };
  }
}

export async function generateMealPlan(
  goal: string,
  preferences: { allergies: string[]; dietaryFlags: string[]; africanFoodsMode: boolean; diet?: string; cuisines?: string[]; nutrition?: string; }
): Promise<object> {
  const africanNote = preferences.africanFoodsMode
    ? "Include African dishes like jollof rice, egusi, fufu, ugali, plantain, suya, moi moi, banku, waakye, injera, nyama choma where appropriate."
    : "";
  const diet = preferences.diet ?? "Omnivore";
  const cuisines = (preferences.cuisines ?? ["African"]).join(", ");
  const nutrition = preferences.nutrition ?? "Balanced";

  const prompt = `You are a wellness nutrition planner. Create a 7-day meal plan.

STRICTLY follow these requirements:
- Goal: ${goal}
- Diet type: ${diet}
  * Vegan = absolutely NO meat, NO fish, NO dairy, NO eggs
  * Pescatarian = fish and seafood allowed, NO red meat, NO poultry
  * Omnivore = all foods allowed
- Cuisine preference: ${cuisines}
  * African = prioritize jollof rice, egusi, fufu, plantain, suya, moi moi, banku, waakye, injera, nyama choma, akara, pepper soup, groundnut soup
  * Latin = prioritize rice and beans, grilled fish, tortillas, empanadas, ceviche, tamales
  * Global = mixed international meals
- Nutrition focus: ${nutrition}
  * High Protein = every meal must have 30g+ protein, prioritize chicken, fish, eggs, legumes, tofu
  * Low Carb = keep carbs under 100g per day total, avoid rice, bread, pasta, potatoes
  * Balanced = standard macro balance
- Allergies: ${preferences.allergies.join(", ") || "none"}
- Dietary restrictions: ${preferences.dietaryFlags.join(", ") || "none"}
${africanNote}

IMPORTANT: Include portion sizes for each meal (e.g. "1 cup jollof rice, 150g grilled chicken").

You MUST respond with ONLY a valid JSON object. No explanations, no text before or after. ONLY JSON:
{
  "disclaimer": "General wellness suggestions only. Not medical advice.",
  "plan": [
    {
      "day": 1,
      "meals": {
        "breakfast": { "name": "meal name with portion", "portion": "e.g. 1 cup oats, 1 banana", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
        "lunch": { "name": "meal name with portion", "portion": "e.g. 1 cup rice, 150g chicken", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
        "dinner": { "name": "meal name with portion", "portion": "e.g. 200g fish, 1 cup vegetables", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
        "snack": { "name": "meal name with portion", "portion": "e.g. 30g nuts, 1 apple", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
      }
    }
  ]
}`;

  try {
    const res = await groqChatWithRetry({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.choices[0]?.message?.content ?? '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { error: 'Could not generate meal plan. Please try again.' };
  }
}

export async function transcribeVoice(audioBase64: string): Promise<string> {
  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const transcription = await groq.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.m4a', { type: 'audio/m4a' }),
      model: 'whisper-large-v3',
      language: 'en',
    });
    return transcription.text;
  } catch (err) {
    console.error('Voice transcription error:', err);
    return '';
  }
}
export interface VoiceFoodItem {
  foodName: string;
  portionDescription: string;
  portionGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "exact" | "estimated";
}

export async function parseVoiceMeal(transcript: string): Promise<{
  items: VoiceFoodItem[];
  mealType: string;
  totalMacros: { calories: number; protein: number; carbs: number; fat: number };
  disclaimer: string;
}> {
  const prompt = `You are a nutrition assistant helping log meals from voice input.

Extract all food items from this voice note: "${transcript}"

PORTION GUIDE - use these if user does not specify:
- Rice (jollof, white, brown, fried): 1 cup = 200g = 260 cal
- Ugali/Sadza/Pap: 1 cup = 180g = 315 cal  
- Fufu/Pounded Yam/Eba: 1 cup = 220g = 390 cal
- Soup (egusi, groundnut, okra, pepper): 1 bowl = 250g = 280 cal
- Chicken breast grilled: 1 piece = 150g = 248 cal
- Chicken thigh: 1 piece = 130g = 272 cal
- Fish (tilapia, mackerel): 1 fillet = 150g = 200 cal
- Beef/Suya: 1 serving = 120g = 258 cal
- Plantain fried: 3 pieces = 150g = 270 cal
- Plantain boiled: 3 pieces = 150g = 183 cal
- Beans/Lentils cooked: 1 cup = 180g = 230 cal
- Eggs: 1 egg = 60g = 93 cal
- Bread: 2 slices = 60g = 159 cal
- Oats cooked: 1 bowl = 240g = 166 cal
- Sweet potato: 1 medium = 150g = 129 cal
- Avocado: half = 75g = 120 cal
- Banana: 1 medium = 120g = 107 cal
- Greek yogurt: 1 cup = 245g = 146 cal
- Milk: 1 cup = 244g = 149 cal

UNIT CONVERSIONS:
- 1 cup = 240ml ≈ 200-250g depending on food
- 1 tablespoon = 15g
- 1 teaspoon = 5g
- 1 handful = ~30g for nuts, ~50g for chips
- 1 plate = assume 2 cups
- 1 bowl = assume 1.5 cups
- 1 piece/slice = use standard weight above
- "a bit of" or "some" = assume half serving

MEAL TYPE DETECTION:
- breakfast: morning meal, oats, eggs, bread, tea
- lunch: midday meal
- dinner: evening meal, supper
- snack: small amount, drink, fruit, between meals

If user specifies grams or cups, use those EXACT values.
If user says "small", reduce standard by 30%. If "large", increase by 40%.

You MUST respond with ONLY valid JSON:
{
  "mealType": "breakfast|lunch|dinner|snack",
  "items": [
    {
      "foodName": "exact food name",
      "portionDescription": "human readable e.g. 1 cup (200g) or 150g",
      "portionGrams": number,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "confidence": "exact or estimated"
    }
  ]
}`;

  try {
    const res = await groqChatWithRetry({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const text = res.choices[0]?.message?.content ?? "{}";
    const clean = text.replace(/\`\`\`json|\`\`\`/g, "").trim();

    let parsed: any = { mealType: "snack", items: [] };
    try {
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Voice meal parse JSON error:", clean.substring(0, 100));
    }

    const items: VoiceFoodItem[] = parsed.items ?? [];
    const totalMacros = {
      calories: Math.round(items.reduce((s, i) => s + i.calories, 0)),
      protein: Math.round(items.reduce((s, i) => s + i.protein, 0)),
      carbs: Math.round(items.reduce((s, i) => s + i.carbs, 0)),
      fat: Math.round(items.reduce((s, i) => s + i.fat, 0)),
    };

    return {
      items,
      mealType: parsed.mealType ?? "snack",
      totalMacros,
      disclaimer: "Nutritional values are estimates. Portion sizes affect actual calories.",
    };
  } catch (err) {
    console.error("Voice meal parse error:", err);
    return {
      items: [],
      mealType: "snack",
      totalMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      disclaimer: "Could not parse meal. Please try again.",
    };
  }
}

interface CoachContext {
  todayCal: number;
  todayProtein: number;
  goalCal: number;
  goalProtein: number;
  goalType: string;
  workouts: number;
  consistency: number;
  streak: number;
}

export async function generateCoachInsight(ctx: CoachContext): Promise<string> {
  const calPct = Math.round((ctx.todayCal / ctx.goalCal) * 100);
  const proteinPct = Math.round((ctx.todayProtein / ctx.goalProtein) * 100);
  const goalLabel = ctx.goalType === "muscle_gain" ? "build muscle" : ctx.goalType === "fat_loss" ? "lose fat" : "improve wellness";

  const prompt = `You are Kijani Coach — a warm, motivating, and practical AI wellness coach.

User stats right now:
- Goal: ${goalLabel}
- Today's calories: ${ctx.todayCal} / ${ctx.goalCal} kcal (${calPct}%)
- Today's protein: ${ctx.todayProtein}g / ${ctx.goalProtein}g (${proteinPct}%)
- Workouts today: ${ctx.workouts}
- Day streak: ${ctx.streak} days
- 30-day consistency: ${ctx.consistency}%

Write a SHORT (2-3 sentences max) personalized coaching message.
Be specific about their numbers. Be encouraging but honest.
If they haven't logged anything today, motivate them to start.
If they're doing well, celebrate and give a specific tip.
If they're close to a goal, push them to finish strong.
Do not use asterisks or markdown. Just plain motivating text.
End with 1 relevant emoji only.`;

  try {
    const res = await groqChatWithRetry({
      model: "llama-3.3-70b-versatile",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    return res.choices[0]?.message?.content?.trim() ?? "Keep going — consistency is the key to your goals. 💪";
  } catch {
    return "Keep going — every logged meal and workout brings you closer to your goal. 🌿";
  }
}

export async function generateSingleMeal(
  mealType: string,
  goalType: string,
  preferences: { diet?: string; cuisines?: string[]; nutrition?: string; allergies?: string[] }
): Promise<{ name: string; portion: string; calories: number; protein: number; carbs: number; fat: number }> {
  const diet = preferences.diet ?? "Omnivore";
  const cuisines = (preferences.cuisines ?? ["African"]).join(", ");
  const nutrition = preferences.nutrition ?? "Balanced";

  const prompt = `You are a nutritionist. Suggest ONE ${mealType} meal.
Diet: ${diet}
Cuisine: ${cuisines}
Nutrition focus: ${nutrition}
Goal: ${goalType}
Allergies: ${(preferences.allergies ?? []).join(", ") || "none"}

Return ONLY valid JSON:
{ "name": "meal name", "portion": "portion sizes e.g. 1 cup rice, 150g chicken", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }`;

  try {
    const res = await groqChatWithRetry({
      model: "llama-3.3-70b-versatile",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });
    const text = res.choices[0]?.message?.content ?? "{}";
    const clean = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { name: "Grilled chicken with rice", portion: "150g chicken, 1 cup rice", calories: 480, protein: 36, carbs: 52, fat: 10 };
  } catch {
    return { name: "Grilled chicken with rice", portion: "150g chicken, 1 cup rice", calories: 480, protein: 36, carbs: 52, fat: 10 };
  }
}
