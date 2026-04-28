"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialAuthRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const jwt_1 = require("../utils/jwt");
const apple_signin_auth_1 = __importDefault(require("apple-signin-auth"));
const google_auth_library_1 = require("google-auth-library");
exports.socialAuthRouter = (0, express_1.Router)();
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// ─── Apple Sign In ────────────────────────────────────────────────────────────
exports.socialAuthRouter.post("/apple", async (req, res) => {
    const { identityToken, fullName } = req.body;
    if (!identityToken)
        return res.status(400).json({ error: "Identity token required." });
    try {
        const payload = await apple_signin_auth_1.default.verifyIdToken(identityToken, {
            audience: process.env.APPLE_BUNDLE_ID ?? "com.damalieinc.kijaniwellness",
            ignoreExpiration: false,
        });
        const appleId = payload.sub;
        const email = payload.email ?? `${appleId}@privaterelay.appleid.com`;
        let user = await db_1.prisma.user.findFirst({ where: { appleId } });
        if (!user) {
            // Check if email exists
            user = await db_1.prisma.user.findUnique({ where: { email } }) ?? null;
            if (user) {
                // Link Apple ID to existing account
                user = await db_1.prisma.user.update({ where: { id: user.id }, data: { appleId } });
            }
            else {
                // Create new user
                user = await db_1.prisma.user.create({
                    data: {
                        email,
                        appleId,
                        displayName: fullName ? `${fullName.givenName ?? ""} ${fullName.familyName ?? ""}`.trim() : null,
                    },
                });
                await db_1.prisma.userProfile.create({ data: { userId: user.id } });
            }
        }
        const tokens = (0, jwt_1.signTokens)(user.id, user.email);
        return res.json({ ...tokens, user: { id: user.id, email: user.email }, isNewUser: true });
    }
    catch (err) {
        console.error("Apple auth error:", err);
        return res.status(401).json({ error: "Apple Sign In failed. Please try again." });
    }
});
// ─── Google Sign In ───────────────────────────────────────────────────────────
exports.socialAuthRouter.post("/google", async (req, res) => {
    const { idToken } = req.body;
    if (!idToken)
        return res.status(400).json({ error: "ID token required." });
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload)
            return res.status(401).json({ error: "Invalid Google token." });
        const googleId = payload.sub;
        const email = payload.email;
        const displayName = payload.name ?? null;
        let user = await db_1.prisma.user.findFirst({ where: { googleId } });
        if (!user) {
            user = await db_1.prisma.user.findUnique({ where: { email } }) ?? null;
            if (user) {
                user = await db_1.prisma.user.update({ where: { id: user.id }, data: { googleId } });
            }
            else {
                user = await db_1.prisma.user.create({
                    data: { email, googleId, displayName },
                });
                await db_1.prisma.userProfile.create({ data: { userId: user.id } });
            }
        }
        const tokens = (0, jwt_1.signTokens)(user.id, user.email);
        return res.json({ ...tokens, user: { id: user.id, email: user.email } });
    }
    catch (err) {
        console.error("Google auth error:", err);
        return res.status(401).json({ error: "Google Sign In failed. Please try again." });
    }
});
