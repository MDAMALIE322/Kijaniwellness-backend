import OpenAI from 'openai';
import { safetyFilter } from '../utils/safetyFilter';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    ? 'This user eats African cuisine. Prioritize identifying African foods accurately: jollof rice, egusi soup, fufu, ugali, plantain, suya, moi moi, banku, kenkey, waakye, groundnut soup, okra soup, injera, nyama choma, cassava, yam, pepper soup, pounded yam, eba, tuwo, kilishi, chapati, pilau, doro wat, shiro, couscous, tagine, and similar dishes.'
    : '';

  const prompt = `You are a food nutrition assistant. Analyze this food image carefully.

${africanContext}

For each food item visible:
1. Identify the exact food name
2. Estimate realistic portion size in grams
3. Calculate: calories, protein (g), carbs (g), fat (g)
4. Provide confidence score (0.0 to 1.0)

Rules:
- Be specific with food names (e.g. "Jollof Rice" not just "rice")
- Estimate portions realistically based on plate/bowl size
- No medical claims or disease references
- If unsure, give lower confidence score

Return ONLY valid JSON, no other text:
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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: 'high',
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const text = response.choices[0]?.message?.content ?? '{"items":[]}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
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
  const prompt = `You are a supportive wellness coach. Write ONE short encouraging sentence (max 20 words) about how this meal relates to the user's goal.

Meal: ${macros.calories} calories, ${macros.protein}g protein, ${macros.carbs}g carbs, ${macros.fat}g fat
Goal: ${goalType}

Rules:
- Positive and supportive tone
- No medical claims or disease references  
- No words: healthy/unhealthy, diagnose, treat, cure, disease
- General wellness framing only
- Return only the sentence, nothing else`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
  const prompt = `You are a food label wellness analyst. Analyze this food product label or ingredient image.

Extract:
1. Product name
2. Nutrition per 100g: calories, protein, carbs, fat, sugar, sodium, fiber
3. Goal alignment: "good", "moderate", or "limit" based on these rules:
   - fat_loss goal: limit if high sugar (>15g) or high fat (>20g) or highly processed
   - muscle_gain goal: good if high protein (>15g)
   - wellness: moderate for most processed foods
4. Wellness flags (use ONLY these types): high_sugar, high_sodium, highly_processed, high_protein, good_fiber
5. For each flag provide a wellness explanation (NO medical claims, NO disease references)
6. Alternative suggestion if alignment is "limit"

User goal: ${goalType}

Return ONLY valid JSON:
{
  "productName": "string",
  "macros": { "cal": 0, "protein": 0, "carbs": 0, "fat": 0, "sugar": 0, "sodium": 0, "fiber": 0 },
  "goalAlignment": "good|moderate|limit",
  "flags": [{ "type": "string", "label": "string", "explanation": "string" }],
  "alternative": "string or null",
  "disclaimer": "This is general wellness information only. Not medical advice."
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
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