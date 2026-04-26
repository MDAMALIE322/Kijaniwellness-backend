"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.legalRouter = void 0;
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
exports.legalRouter = (0, express_1.Router)();
exports.legalRouter.get('/privacy', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../static/privacy-policy.html'));
});
exports.legalRouter.get('/terms', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../static/terms-of-use.html'));
});
exports.legalRouter.get('/support', (_req, res) => {
    res.json({
        email: 'support@kijaniwellness.com',
        app: 'Kijani Wellness',
        company: 'Damalie Inc.',
        location: 'Toronto, Ontario, Canada'
    });
});
