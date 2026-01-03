/**
 * Calendar Routes
 *
 * Endpoints for calendar sync and event management.
 */

import { Router, type Response, type NextFunction } from 'express';
import type { Request } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateParams, validateQuery, validateBody } from '../middleware/validation.js';
import { z } from 'zod';
import CalendarEventService from '../services/CalendarEventService.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ==================== SYNC ====================

/**
 * POST /calendar/sync
 * Trigger calendar sync for the current user
 */
const syncBodySchema = z.object({
  fullSync: z.boolean().optional(),
});

router.post(
  '/sync',
  validateBody(syncBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { fullSync } = req.body;

      const result = await CalendarEventService.syncUserCalendar(user._id, {
        fullSync,
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

// ==================== EVENTS ====================

/**
 * GET /calendar/events
 * Get calendar events for the user
 */
const eventsQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  contactId: z.string().length(24).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

router.get(
  '/events',
  validateQuery(eventsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { startDate, endDate, contactId, limit } = req.query;

      const events = await CalendarEventService.getEvents(user._id, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        contactId: contactId as string,
        limit: limit ? Number(limit) : undefined,
      });

      res.json({
        success: true,
        data: { events },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /calendar/events/today
 * Get today's calendar events
 */
router.get('/events/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const events = await CalendarEventService.getTodayEvents(user._id);

    res.json({
      success: true,
      data: { events },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /calendar/events/contact/:contactId
 * Get events for a specific contact
 */
const contactEventsParamsSchema = z.object({
  contactId: z.string().length(24),
});

const contactEventsQuerySchema = z.object({
  includeHistorical: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get(
  '/events/contact/:contactId',
  validateParams(contactEventsParamsSchema),
  validateQuery(contactEventsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const contactId = req.params.contactId!;
      const { includeHistorical, limit } = req.query;

      const events = await CalendarEventService.getContactEvents(contactId, user._id, {
        includeHistorical: includeHistorical === 'true',
        limit: limit ? Number(limit) : undefined,
      });

      res.json({
        success: true,
        data: { events },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==================== EVENT LINKING ====================

const eventIdParamsSchema = z.object({
  eventId: z.string().length(24),
});

const linkBodySchema = z.object({
  contactId: z.string().length(24),
});

/**
 * POST /calendar/events/:eventId/link
 * Link an event to a contact
 */
router.post(
  '/events/:eventId/link',
  validateParams(eventIdParamsSchema),
  validateBody(linkBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const eventId = req.params.eventId!;
      const { contactId } = req.body;

      const event = await CalendarEventService.linkEventToContact(eventId, contactId, user._id);

      if (!event) {
        res.status(404).json({
          success: false,
          error: 'Event or contact not found',
        });
        return;
      }

      res.json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /calendar/events/:eventId/link
 * Unlink an event from a contact
 */
router.delete(
  '/events/:eventId/link',
  validateParams(eventIdParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const eventId = req.params.eventId!;

      const event = await CalendarEventService.unlinkEventFromContact(eventId, user._id);

      if (!event) {
        res.status(404).json({
          success: false,
          error: 'Event not found',
        });
        return;
      }

      res.json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==================== CLEANUP ====================

/**
 * POST /calendar/prune
 * Clean up old events outside retention window
 */
router.post('/prune', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    const deletedCount = await CalendarEventService.pruneOldEvents(user._id, user.plan);

    res.json({
      success: true,
      data: { deletedCount },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
