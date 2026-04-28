import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { signTokens } from "../utils/jwt";
import appleSignin from "apple-signin-auth";
import { OAuth2Client } from "google-auth-library";

export const socialAuthRouter = Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Apple Sign In ────────────────────────────────────────────────────────────
socialAuthRouter.post("/apple", async (req: Request, res: Response) => {
  const { identityToken, fullName } = req.body;
  if (!identityToken) return res.status(400).json({ error: "Identity token required." });

  try {
    const payload = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_BUNDLE_ID ?? "com.damalieinc.kijaniwellness",
      ignoreExpiration: false,
    });

    const appleId = payload.sub;
    const email = payload.email ?? `${appleId}@privaterelay.appleid.com`;

    let user = await prisma.user.findFirst({ where: { appleId } });

    if (!user) {
      // Check if email exists
      user = await prisma.user.findUnique({ where: { email } }) ?? null;
      if (user) {
        // Link Apple ID to existing account
        user = await prisma.user.update({ where: { id: user.id }, data: { appleId } });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email,
            appleId,
            displayName: fullName ? `${fullName.givenName ?? ""} ${fullName.familyName ?? ""}`.trim() : null,
          },
        });
        await prisma.userProfile.create({ data: { userId: user.id } });
      }
    }

    const tokens = signTokens(user.id, user.email);
    return res.json({ ...tokens, user: { id: user.id, email: user.email }, isNewUser: true });
  } catch (err) {
    console.error("Apple auth error:", err);
    return res.status(401).json({ error: "Apple Sign In failed. Please try again." });
  }
});

// ─── Google Sign In ───────────────────────────────────────────────────────────
socialAuthRouter.post("/google", async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: "ID token required." });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid Google token." });

    const googleId = payload.sub;
    const email = payload.email!;
    const displayName = payload.name ?? null;

    let user = await prisma.user.findFirst({ where: { googleId } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email } }) ?? null;
      if (user) {
        user = await prisma.user.update({ where: { id: user.id }, data: { googleId } });
      } else {
        user = await prisma.user.create({
          data: { email, googleId, displayName },
        });
        await prisma.userProfile.create({ data: { userId: user.id } });
      }
    }

    const tokens = signTokens(user.id, user.email);
    return res.json({ ...tokens, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(401).json({ error: "Google Sign In failed. Please try again." });
  }
});