import { Router, Response } from 'express';
import { prisma } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const privacyRouter = Router();

privacyRouter.post('/data-export/request', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.dataExportRequest.create({
      data: { userId: req.userId!, status: 'pending' },
    });
    return res.json({ requestId: request.id, estimatedReady: '24 hours' });
  } catch {
    return res.status(500).json({ error: 'Could not process export request.' });
  }
});

privacyRouter.post('/delete-account', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.userId! },
      data: { deletedAt: new Date() },
    });
    return res.json({ scheduled: true, message: 'Account deletion scheduled. All data will be removed within 30 days.' });
  } catch {
    return res.status(500).json({ error: 'Could not process deletion.' });
  }
});

privacyRouter.post('/consent', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { consentType, accepted, version } = req.body;
  try {
    await prisma.privacyConsent.create({
      data: { userId: req.userId!, consentType, accepted, acceptedAt: new Date(), version: version ?? '1.0' },
    });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Could not save consent.' });
  }
});
