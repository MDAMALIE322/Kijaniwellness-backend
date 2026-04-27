import Groq from 'groq-sdk';
import { safetyFilter } from '../utils/safetyFilter';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
- Return ONLY valid JSON, no other text:

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
    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 1000,
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
  const prompt = `You are a supportive wellness coach. Write ONE short encouraging sentence (max 20 words) about how this meal relates to the user goal.

Meal: ${macros.calories} calories, ${macros.protein}g protein, ${macros.carbs}g carbs, ${macros.fat}g fat
Goal: ${goalType}

Rules:
- Positive and supportive tone
- No medical claims or disease references
- No words: healthy/unhealthy, diagnose, treat, cure, disease
- Return only the sentence, nothing else`;

  try {
    const res = await groq.chat.completions.create({
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
  const prompt = `You are a food label wellness analyst. Analyze this food product label or ingredient image.

Extract:
1. Product name
2. Nutrition per 100g: calories, protein, carbs, fat, sugar, sodium, fiber
3. Goal alignment: "good", "moderate", or "limit"
4. Wellness flags (ONLY these types): high_sugar, high_sodium, highly_processed, high_protein, good_fiber
5. For each flag provide a wellness explanation (NO medical claims)
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
    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
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

Return ONLY valid JSON:
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
    const res = await groq.chat.completions.create({
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
  preferences: { allergies: string[]; dietaryFlags: string[]; africanFoodsMode: boolean }
): Promise<object> {
  const africanNote = preferences.africanFoodsMode
    ? 'Include African dishes like jollof rice, egusi, fufu, ugali, plantain, suya, moi moi, banku, waakye, injera, nyama choma where appropriate.'
    : '';

  const prompt = `You are a wellness nutrition planner. Create a 7-day meal plan.

Goal: ${goal}
Allergies: ${preferences.allergies.join(', ') || 'none'}
Dietary: ${preferences.dietaryFlags.join(', ') || 'none'}
${africanNote}

Return ONLY valid JSON:
{
  "disclaimer": "General wellness suggestions only. Not medical advice.",
  "plan": [
    {
      "day": 1,
      "meals": {
        "breakfast": { "name": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
        "lunch": { "name": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
        "dinner": { "name": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
        "snack": { "name": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
      }
    }
  ]
}`;

  try {
    const res = await groq.chat.completions.create({
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