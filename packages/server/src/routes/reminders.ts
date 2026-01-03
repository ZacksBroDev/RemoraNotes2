/**
 * Reminder Routes
 *
 * Endpoints for reminder rules, instances, and the Today Queue.
 */

import { Router, type Response, type NextFunction } from 'express';
import type { Request } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import {
  reminderRuleCreateSchema,
  reminderRuleUpdateSchema,
  snoozeSchema,
} from '../schemas/reminder.js';
import { z } from 'zod';
import ReminderService from '../services/ReminderService.js';
import TodayQueueService from '../services/TodayQueueService.js';
import ReminderMaterializerService from '../services/ReminderMaterializerService.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ==================== TODAY QUEUE ====================

/**
 * GET /reminders/today
 * Get today's reminder queue with scoring
 */
router.get(
  '/today',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const includeOverdue = req.query.includeOverdue !== 'false';

      const result = await TodayQueueService.getTodayQueue({
        userId: user._id,
        plan: user.plan,
        includeOverdue,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /reminders/today/count
 * Get count of pending reminders for today (for badge/notifications)
 */
router.get(
  '/today/count',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const count = await TodayQueueService.getTodayCount(user._id);

      res.json({
        success: true,
        data: { count },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /reminders/upcoming
 * Get upcoming reminders for the next N days
 */
const upcomingQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).optional(),
});

router.get(
  '/upcoming',
  validateQuery(upcomingQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const days = Number(req.query.days) || 7;

      const items = await TodayQueueService.getUpcoming(user._id, days);

      res.json({
        success: true,
        data: { items },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /reminders/overdue
 * Get overdue reminders
 */
router.get(
  '/overdue',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const items = await TodayQueueService.getOverdue(user._id);

      res.json({
        success: true,
        data: { items },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==================== INSTANCE ACTIONS ====================

const instanceIdParamsSchema = z.object({
  instanceId: z.string().length(24),
});

/**
 * POST /reminders/instances/:instanceId/done
 * Mark a reminder instance as completed
 */
router.post(
  '/instances/:instanceId/done',
  validateParams(instanceIdParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const instanceId = req.params.instanceId!;

      const instance = await ReminderService.markDone(instanceId, user._id);

      if (!instance) {
        res.status(404).json({
          success: false,
          error: 'Reminder instance not found or already completed',
        });
        return;
      }

      res.json({
        success: true,
        data: instance,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /reminders/instances/:instanceId/snooze
 * Snooze a reminder instance
 */
router.post(
  '/instances/:instanceId/snooze',
  validateParams(instanceIdParamsSchema),
  validateBody(snoozeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const instanceId = req.params.instanceId!;
      const { snoozeDays } = req.body;

      const instance = await ReminderService.snooze(instanceId, user._id, {
        days: snoozeDays,
      });

      if (!instance) {
        res.status(404).json({
          success: false,
          error: 'Reminder instance not found or not pending',
        });
        return;
      }

      res.json({
        success: true,
        data: instance,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /reminders/instances/:instanceId/unsnooze
 * Unsnooze a reminder instance
 */
router.post(
  '/instances/:instanceId/unsnooze',
  validateParams(instanceIdParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const instanceId = req.params.instanceId!;

      const instance = await ReminderService.unsnooze(instanceId, user._id);

      if (!instance) {
        res.status(404).json({
          success: false,
          error: 'Reminder instance not found or not snoozed',
        });
        return;
      }

      res.json({
        success: true,
        data: instance,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /reminders/instances/:instanceId/skip
 * Skip a reminder instance
 */
router.post(
  '/instances/:instanceId/skip',
  validateParams(instanceIdParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const instanceId = req.params.instanceId!;

      const instance = await ReminderService.skip(instanceId, user._id);

      if (!instance) {
        res.status(404).json({
          success: false,
          error: 'Reminder instance not found or already processed',
        });
        return;
      }

      res.json({
        success: true,
        data: instance,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /reminders/instances/:instanceId
 * Get a specific reminder instance
 */
router.get(
  '/instances/:instanceId',
  validateParams(instanceIdParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const instanceId = req.params.instanceId!;

      const instance = await ReminderService.getInstance(instanceId, user._id);

      if (!instance) {
        res.status(404).json({
          success: false,
          error: 'Reminder instance not found',
        });
        return;
      }

      res.json({
        success: true,
        data: instance,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==================== RULE OPERATIONS ====================

/**
 * GET /reminders/rules
 * List all reminder rules for the user
 */
const listRulesQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
  contactId: z.string().length(24).optional(),
});

router.get(
  '/rules',
  validateQuery(listRulesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { isActive, contactId } = req.query;

      const options: { isActive?: boolean; contactId?: string } = {};
      if (isActive === 'true') options.isActive = true;
      if (isActive === 'false') options.isActive = false;
      if (contactId) options.contactId = contactId as string;

      const rules = await ReminderService.getUserRules(user._id, options);

      res.json({
        success: true,
        data: { rules },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /reminders/rules
 * Create a new reminder rule
 */
router.post(
  '/rules',
  validateBody(reminderRuleCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;

      const rule = await ReminderService.createRule(
        {
          userId: user._id,
          ...req.body,
        },
        user.plan
      );

      res.status(201).json({
        success: true,
        data: rule,
      });
    } catch (err) {
      next(err);
    }
  }
);

const ruleIdParamsSchema = z.object({
  ruleId: z.string().length(24),
});

/**
 * GET /reminders/rules/:ruleId
 * Get a specific reminder rule
 */
router.get(
  '/rules/:ruleId',
  validateParams(ruleIdParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const ruleId = req.params.ruleId!;

      const rule = await ReminderService.getRule(ruleId, user._id);

      if (!rule) {
        res.status(404).json({
          success: false,
          error: 'Reminder rule not found',
        });
        return;
      }

      res.json({
        success: true,
        data: rule,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /reminders/rules/:ruleId
 * Update a reminder rule
 */
router.patch(
  '/rules/:ruleId',
  validateParams(ruleIdParamsSchema),
  validateBody(reminderRuleUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const ruleId = req.params.ruleId!;

      const rule = await ReminderService.updateRule(
        ruleId,
        user._id,
        req.body,
        user.plan
      );

      if (!rule) {
        res.status(404).json({
          success: false,
          error: 'Reminder rule not found',
        });
        return;
      }

      res.json({
        success: true,
        data: rule,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /reminders/rules/:ruleId
 * Delete a reminder rule
 */
router.delete(
  '/rules/:ruleId',
  validateParams(ruleIdParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const ruleId = req.params.ruleId!;

      const deleted = await ReminderService.deleteRule(ruleId, user._id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Reminder rule not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Rule deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==================== MATERIALIZATION ====================

/**
 * POST /reminders/materialize
 * Trigger materialization for the current user (admin/debug endpoint)
 */
router.post(
  '/materialize',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;

      const result = await ReminderMaterializerService.materializeUser(
        user._id,
        user.plan
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
