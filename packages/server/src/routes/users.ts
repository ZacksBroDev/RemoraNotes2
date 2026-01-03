import { Router, type Request, type Response, type NextFunction } from 'express';
import type { ApiResponse } from '@remoranotes/shared';
import { requireAuth, validateBody } from '../middleware/index.js';
import { User } from '../models/index.js';
import { userPreferencesSchema, userModeSchema } from '../schemas/index.js';
import { logAudit } from '../services/index.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get current user
router.get('/me', (req: Request, res: Response<ApiResponse>): void => {
  res.json({
    success: true,
    data: { user: req.user!.toJSON() },
  });
});

// Update user preferences
router.patch(
  '/me/preferences',
  validateBody(userPreferencesSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;

      // Update preferences
      if (req.body.timezone !== undefined) user.timezone = req.body.timezone;
      if (req.body.digestTime !== undefined) user.digestTime = req.body.digestTime;
      if (req.body.digestEnabled !== undefined) user.digestEnabled = req.body.digestEnabled;
      if (req.body.storeEventTitles !== undefined)
        user.storeEventTitles = req.body.storeEventTitles;

      await user.save();

      // Audit log
      logAudit({
        userId: user._id,
        action: 'USER_SETTINGS_UPDATE',
        resourceType: 'user',
        resourceId: user._id,
        metadata: { updatedFields: Object.keys(req.body) },
        ip: req.ip,
      });

      res.json({
        success: true,
        data: { user: user.toJSON() },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update user mode
router.patch(
  '/me/mode',
  validateBody(userModeSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      user.mode = req.body.mode;
      await user.save();

      // Audit log
      logAudit({
        userId: user._id,
        action: 'USER_SETTINGS_UPDATE',
        resourceType: 'user',
        resourceId: user._id,
        metadata: { mode: req.body.mode },
        ip: req.ip,
      });

      res.json({
        success: true,
        data: { user: user.toJSON() },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete user account
router.delete(
  '/me',
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const userId = user._id;

      // Import models for cascade delete
      const { Contact, Interaction, ReminderRule, ReminderInstance, CalendarEvent, AuditLog } =
        await import('../models/index.js');

      // Delete all user data in parallel
      await Promise.all([
        Contact.deleteMany({ userId }),
        Interaction.deleteMany({ userId }),
        ReminderRule.deleteMany({ userId }),
        ReminderInstance.deleteMany({ userId }),
        CalendarEvent.deleteMany({ userId }),
        AuditLog.deleteMany({ userId }),
      ]);

      // Delete user
      await User.deleteOne({ _id: userId });

      // Clear auth cookie
      const { clearAuthCookie, clearDEKCache } = await import('../middleware/index.js');
      const { clearDEKCache: clearCache } = await import('../utils/index.js');
      clearCache(userId.toString());
      clearAuthCookie(res);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
