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

app.use(errorMiddleware);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Kijani API running on port ${PORT}`));

export default app;
