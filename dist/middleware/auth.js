"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jwt_1 = require("../utils/jwt");
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    try {
        const payload = (0, jwt_1.verifyAccess)(header.slice(7));
        req.userId = payload.userId;
        req.userEmail = payload.email;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}
