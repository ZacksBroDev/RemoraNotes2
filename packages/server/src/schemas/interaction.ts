import { z } from 'zod';
import { INTERACTION_TYPES } from '@remoranotes/shared';

// Interaction creation schema
export const interactionCreateSchema = z.object({
  contactId: z.string().length(24), // MongoDB ObjectId
  type: z.enum(INTERACTION_TYPES),
  occurredAt: z.coerce.date().optional(), // Defaults to now
  notes: z.string().max(5000).optional(),
});

// Interaction update schema
export const interactionUpdateSchema = z.object({
  type: z.enum(INTERACTION_TYPES).optional(),
  occurredAt: z.coerce.date().optional(),
  notes: z.string().max(5000).optional(),
});

// Interaction query params
export const interactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  contactId: z.string().length(24).optional(),
  type: z.enum(INTERACTION_TYPES).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type InteractionCreate = z.infer<typeof interactionCreateSchema>;
export type InteractionUpdate = z.infer<typeof interactionUpdateSchema>;
export type InteractionQuery = z.infer<typeof interactionQuerySchema>;
