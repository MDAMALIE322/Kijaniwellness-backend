"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const jwt_1 = require("../utils/jwt");
exports.oauthRouter = (0, express_1.Router)();
exports.oauthRouter.post('/', async (req, res) => {
    const { provider, idToken, accessToken, fullName } = req.body;
    if (!provider || (!idToken && !accessToken)) {
        return res.status(400).json({ error: 'Provider and token required.' });
    }
    try {
        let email = null;
        let providerId = null;
        if (provider === 'apple') {
            // Decode Apple JWT to get email and sub
            const parts = idToken.split('.');
            if (parts.length !== 3)
                return res.status(400).json({ error: 'Invalid Apple token.' });
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            email = payload.email;
            providerId = payload.sub;
        }
        else if (provider === 'google') {
            // Verify Google token
            const googleRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } });
            const googleData = await googleRes.json();
            email = googleData.email ?? null;
            providerId = googleData.sub ?? null;
        }
        if (!email)
            return res.status(400).json({ error: 'Could not retrieve email from provider.' });
        // Find or create user
        let user = await db_1.prisma.user.findUnique({ where: { email }, include: { profile: true } });
        if (!user) {
            user = await db_1.prisma.user.create({
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
        if (user.deletedAt)
            return res.status(403).json({ error: 'Account deactivated.' });
        const tokens = (0, jwt_1.signTokens)(user.id, user.email);
        return res.json({
            ...tokens,
            isNewUser: !user.profile?.displayName,
            user: {
                id: user.id,
                email: user.email,
                profile: user.profile,
            },
        });
    }
    catch (err) {
        console.error('OAuth error:', err);
        return res.status(500).json({ error: 'OAuth sign in failed. Please try again.' });
    }
});
