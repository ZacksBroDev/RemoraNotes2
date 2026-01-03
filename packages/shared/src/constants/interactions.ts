// Interaction types
export const INTERACTION_TYPES = [
  'email',
  'call',
  'meeting',
  'message',
  'social',
  'other',
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];
