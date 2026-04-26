import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import { authRouter } from './routes/auth';
import { profileRouter } from './routes/profile';
import { mealsRouter } from './routes/meals';
import { workoutsRouter } from './routes/workouts';
import { fastingRouter } from './routes/fasting';
import { herbalRouter } from './routes/herbal';
import { privacyRouter } from './routes/privacy';
import { oauthRouter } from './routes/oauth';
import { foodRouter } from './routes/food';
import { voiceRouter } from './routes/voice';
import { legalRouter } from './routes/legal';
import { mealPlanRouter } from './routes/meal-plan';
import { habitsRouter } from './routes/habits';
import { exerciseRouter } from './routes/exercises';
import { foodScanRouter } from './routes/food-scan';
import { ingredientScanRouter } from './routes/ingredient-scan';
import { errorMiddleware } from './middleware/error';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/v1', limiter);

app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'kijani-api' }));

app.use('/v1/auth', authRouter);
app.use('/v1/profile', profileRouter);
app.use('/v1/meals', mealsRouter);
app.use('/v1/workouts', workoutsRouter);
app.use('/v1/fasting', fastingRouter);
app.use('/v1/herbal', herbalRouter);
app.use('/v1/privacy', privacyRouter);
app.use('/v1/auth/oauth', oauthRouter);
app.use('/v1/food', foodRouter);
app.use('/v1/voice', voiceRouter);
app.use('/', legalRouter);
app.use(express.static('static'));
app.use('/v1/meal-plan', mealPlanRouter);
app.use('/v1/habits', habitsRouter);
app.use('/v1/exercises', exerciseRouter);
app.use('/v1/food-scan', foodScanRouter);
app.use('/v1/ingredient-scan', ingredientScanRouter);

app.use(errorMiddleware);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Kijani API running on port ${PORT}`));

export default app;
