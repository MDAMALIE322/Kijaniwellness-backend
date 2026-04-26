import { Router, Request, Response } from 'express';
import path from 'path';

export const legalRouter = Router();

legalRouter.get('/privacy', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../static/privacy-policy.html'));
});

legalRouter.get('/terms', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../static/terms-of-use.html'));
});

legalRouter.get('/support', (_req: Request, res: Response) => {
  res.json({ 
    email: 'support@kijaniwellness.com',
    app: 'Kijani Wellness',
    company: 'Damalie Inc.',
    location: 'Toronto, Ontario, Canada'
  });
});