"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const auth_1 = require("./routes/auth");
const profile_1 = require("./routes/profile");
const meals_1 = require("./routes/meals");
const workouts_1 = require("./routes/workouts");
const fasting_1 = require("./routes/fasting");
const herbal_1 = require("./routes/herbal");
const privacy_1 = require("./routes/privacy");
const oauth_1 = require("./routes/oauth");
const food_1 = require("./routes/food");
const voice_1 = require("./routes/voice");
const meal_plan_1 = require("./routes/meal-plan");
const food_scan_1 = require("./routes/food-scan");
const ingredient_scan_1 = require("./routes/ingredient-scan");
const error_1 = require("./middleware/error");
const app = (0, express_1.default)();
app.set('trust proxy', 1);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
const limiter = (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/v1', limiter);
app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'kijani-api' }));
app.use('/v1/auth', auth_1.authRouter);
app.use('/v1/profile', profile_1.profileRouter);
app.use('/v1/meals', meals_1.mealsRouter);
app.use('/v1/workouts', workouts_1.workoutsRouter);
app.use('/v1/fasting', fasting_1.fastingRouter);
app.use('/v1/herbal', herbal_1.herbalRouter);
app.use('/v1/privacy', privacy_1.privacyRouter);
app.use('/v1/auth/oauth', oauth_1.oauthRouter);
app.use('/v1/food', food_1.foodRouter);
app.use('/v1/voice', voice_1.voiceRouter);
app.use('/v1/meal-plan', meal_plan_1.mealPlanRouter);
app.use('/v1/food-scan', food_scan_1.foodScanRouter);
app.use('/v1/ingredient-scan', ingredient_scan_1.ingredientScanRouter);
app.use(error_1.errorMiddleware);
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Kijani API running on port ${PORT}`));
exports.default = app;
