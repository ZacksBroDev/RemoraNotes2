import { Router, type Request, type Response, type NextFunction } from 'express';
import type { ApiResponse } from '@remoranotes/shared';
import { requireAuth, validateBody, validateQuery, validateParams } from '../middleware/index.js';
import { InteractionService } from '../services/index.js';
import {
  interactionCreateSchema,
  interactionUpdateSchema,
  interactionQuerySchema,
  objectIdParamSchema,
} from '../schemas/index.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Create interaction
router.post(
  '/',
  validateBody(interactionCreateSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new InteractionService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      const interaction = await service.create(req.body, req.ip);

      res.status(201).json({
        success: true,
        data: { interaction },
      });
    } catch (error) {
      next(error);
    }
  }
);

// List interactions
router.get(
  '/',
  validateQuery(interactionQuerySchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new InteractionService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      const result = await service.list(req.query as any);

      res.json({
        success: true,
        data: { interactions: result.interactions },
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

// Get interaction by ID
router.get(
  '/:id',
  validateParams(objectIdParamSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new InteractionService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      const interaction = await service.getById(req.params.id);

      res.json({
        success: true,
        data: { interaction },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update interaction
router.patch(
  '/:id',
  validateParams(objectIdParamSchema),
  validateBody(interactionUpdateSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new InteractionService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      const interaction = await service.update(req.params.id, req.body, req.ip);

      res.json({
        success: true,
        data: { interaction },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete interaction
router.delete(
  '/:id',
  validateParams(objectIdParamSchema),
  async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const service = new InteractionService(req.user!._id, req.user!.encryptedDEK, req.user!.plan);
      await service.delete(req.params.id, req.ip);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
