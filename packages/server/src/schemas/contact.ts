import { z } from 'zod';
import {
  CONTACT_PRIORITIES,
  CONTACT_SOURCES,
  ALLOWED_TAGS,
  IMPORTANCE_MIN,
  IMPORTANCE_MAX,
} from '@remoranotes/shared';

// Month-Day schema for birthdays/anniversaries
export const monthDaySchema = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  year: z.number().int().min(1900).max(2100).optional(),
});

// Contact creation schema
export const contactCreateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(254).optional(),
  phone: z.string().max(30).optional(),
  company: z.string().max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  tags: z.array(z.enum(ALLOWED_TAGS as unknown as [string, ...string[]])).optional(),
  priority: z.enum(CONTACT_PRIORITIES).optional(),
  importance: z.number().int().min(IMPORTANCE_MIN).max(IMPORTANCE_MAX).optional(),
  birthday: monthDaySchema.optional(),
  anniversary: monthDaySchema.optional(),
  notes: z.string().max(5000).optional(),
});

// Contact update schema
export const contactUpdateSchema = contactCreateSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

// Contact query params
export const contactQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  tags: z
    .string()
    .optional()
    .transform((val) => val?.split(',').filter(Boolean)),
  priority: z.enum(CONTACT_PRIORITIES).optional(),
  source: z.enum(CONTACT_SOURCES).optional(),
  archived: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'lastContactedAt', 'createdAt', 'importance']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type ContactCreate = z.infer<typeof contactCreateSchema>;
export type ContactUpdate = z.infer<typeof contactUpdateSchema>;
export type ContactQuery = z.infer<typeof contactQuerySchema>;
