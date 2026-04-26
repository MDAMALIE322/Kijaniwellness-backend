import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { signTokens, verifyRefresh } from '../utils/jwt';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    // Create default profile
    await prisma.userProfile.create({
      data: { userId: user.id },
    });

    const tokens = signTokens(user.id, user.email);
    return res.status(201).json({
      ...tokens,
      user: { id: user.id, email: user.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.deletedAt) {
      return res.status(403).json({ error: 'This account has been deactivated.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    const tokens = signTokens(user.id, user.email);
    return res.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile ? {
          displayName: user.profile.displayName,
          goalType: user.profile.goalType,
          africanFoodsMode: user.profile.africanFoodsMode,
        } : null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required.' });

  try {
    const payload = verifyRefresh(refreshToken);
    const { accessToken } = signTokens(payload.userId, payload.email);
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
});
