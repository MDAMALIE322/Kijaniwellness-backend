import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { signTokens } from '../utils/jwt';

export const oauthRouter = Router();

oauthRouter.post('/', async (req: Request, res: Response) => {
  const { provider, idToken, accessToken, fullName } = req.body;

  if (!provider || (!idToken && !accessToken)) {
    return res.status(400).json({ error: 'Provider and token required.' });
  }

  try {
    let email: string | null = null;
    let providerId: string | null = null;

    if (provider === 'apple') {
      // Decode Apple JWT to get email and sub
      const parts = idToken.split('.');
      if (parts.length !== 3) return res.status(400).json({ error: 'Invalid Apple token.' });
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      email = payload.email;
      providerId = payload.sub;
    } else if (provider === 'google') {
      // Verify Google token
      const googleRes = await fetch(
        `https://www.googleapis.com/oauth2/v3/userinfo`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const googleData = await googleRes.json() as { email?: string; sub?: string };
      email = googleData.email ?? null;
      providerId = googleData.sub ?? null;
    }

    if (!email) return res.status(400).json({ error: 'Could not retrieve email from provider.' });

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          profile: {
            create: {
              displayName: fullName
                ? `${fullName.givenName ?? ''} ${fullName.familyName ?? ''}`.trim()
                : null,
            },
          },
        },
        include: { profile: true },
      });
    }

    if (user.deletedAt) return res.status(403).json({ error: 'Account deactivated.' });

    const tokens = signTokens(user.id, user.email);
    return res.json({
      ...tokens,
      isNewUser: !user.profile?.displayName,
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile,
      },
    });
  } catch (err) {
    console.error('OAuth error:', err);
    return res.status(500).json({ error: 'OAuth sign in failed. Please try again.' });
  }
});