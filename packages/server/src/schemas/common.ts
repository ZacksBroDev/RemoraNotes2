import { z } from 'zod';

// MongoDB ObjectId param
export const objectIdParamSchema = z.object({
  id: z.string().length(24),
});

export type ObjectIdParam = z.infer<typeof objectIdParamSchema>;
