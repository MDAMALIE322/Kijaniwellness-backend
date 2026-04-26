"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signTokens = signTokens;
exports.verifyAccess = verifyAccess;
exports.verifyRefresh = verifyRefresh;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret';
function signTokens(userId, email) {
    const accessToken = jsonwebtoken_1.default.sign({ userId, email }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ userId, email }, JWT_REFRESH, { expiresIn: '30d' });
    return { accessToken, refreshToken };
}
function verifyAccess(token) {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
}
function verifyRefresh(token) {
    return jsonwebtoken_1.default.verify(token, JWT_REFRESH);
}
