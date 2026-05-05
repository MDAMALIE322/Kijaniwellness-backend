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
  const userId = req.userId!;
  try {
    await prisma.$transaction(async (tx) => {
      // Wipe child records first (FK dependencies)
      await tx.mealItem.deleteMany({ where: { mealLog: { userId } } });
      await tx.mealLog.deleteMany({ where: { userId } });
      await tx.workoutSession.deleteMany({ where: { userId } });
      await tx.fastingLog.deleteMany({ where: { userId } });
      await tx.herbalLog.deleteMany({ where: { userId } });
      await tx.privacyConsent.deleteMany({ where: { userId } });
      await tx.dataExportRequest.deleteMany({ where: { userId } });
      await tx.userProfile.deleteMany({ where: { userId } });
      // Finally remove the user
      await tx.user.delete({ where: { id: userId } });
    });
    return res.json({ deleted: true, message: 'Account and all associated data have been permanently deleted.' });
  } catch (err) {
    console.error('[delete-account] failed:', err);
    return res.status(500).json({ error: 'Could not delete account. Please try again or contact support.' });
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
