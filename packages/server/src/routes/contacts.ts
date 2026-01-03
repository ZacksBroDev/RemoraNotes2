import { Router, type Request, type Response, type NextFunction } from 'express';
import type { ApiResponse } from '@remoranotes/shared';
import { requireAuth, validateBody, validateQuery, validateParams } from '../middleware/index.js';
import { ContactService } from '../services/index.js';
import {
  contactCreateSchema,
  contactUpdateSchema,
  contactQuerySchema,
  objectIdParamSchema,
} from '../schemas/index.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Create contact
router.post(
  '/',
  validateBody(contactCreateSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new ContactService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      const contact = await service.create(req.body, req.ip);

      res.status(201).json({
        success: true,
        data: { contact },
      });
    } catch (error) {
      next(error);
    }
  }
);

// List contacts
router.get(
  '/',
  validateQuery(contactQuerySchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new ContactService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      const result = await service.list(req.query as any);

      res.json({
        success: true,
        data: { contacts: result.contacts },
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get contact by ID
router.get(
  '/:id',
  validateParams(objectIdParamSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new ContactService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      const contact = await service.getById(req.params.id!);

      res.json({
        success: true,
        data: { contact },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update contact
router.patch(
  '/:id',
  validateParams(objectIdParamSchema),
  validateBody(contactUpdateSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new ContactService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      const contact = await service.update(req.params.id!, req.body, req.ip);

      res.json({
        success: true,
        data: { contact },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete contact
router.delete(
  '/:id',
  validateParams(objectIdParamSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new ContactService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      await service.delete(req.params.id!, req.ip);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Archive contact
router.post(
  '/:id/archive',
  validateParams(objectIdParamSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new ContactService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      const contact = await service.setArchived(req.params.id!, true);

      res.json({
        success: true,
        data: { contact },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Unarchive contact
router.post(
  '/:id/unarchive',
  validateParams(objectIdParamSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new ContactService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      const contact = await service.setArchived(req.params.id!, false);

      res.json({
        success: true,
        data: { contact },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
