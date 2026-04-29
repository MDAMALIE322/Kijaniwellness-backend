import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { signTokens, verifyRefresh } from '../utils/jwt';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/email';
import crypto from 'crypto';

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

// ── Forgot Password ─────────────────────────────────────
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user || !user.passwordHash) {
      return res.json({ message: 'If an account exists, a reset code has been sent.' });
    }

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetTokenExp = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { email },
      data: { resetToken: resetCode, resetTokenExp },
    });

    await sendPasswordResetEmail(email, resetCode);
    return res.json({ message: 'If an account exists, a reset code has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Could not send reset email. Please try again.' });
  }
});

// ── Reset Password ───────────────────────────────────────
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, code, and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.resetToken || !user.resetTokenExp) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }
    if (user.resetToken !== code) {
      return res.status(400).json({ error: 'Invalid reset code.' });
    }
    if (new Date() > user.resetTokenExp) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { email },
      data: { passwordHash, resetToken: null, resetTokenExp: null },
    });

    return res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Could not reset password. Please try again.' });
  }
});
