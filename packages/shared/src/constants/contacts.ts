// Contact priorities
export const CONTACT_PRIORITIES = ['high', 'medium', 'low'] as const;
export type ContactPriority = (typeof CONTACT_PRIORITIES)[number];

// Contact importance scale (1-10)
export const IMPORTANCE_MIN = 1;
export const IMPORTANCE_MAX = 10;
export const IMPORTANCE_DEFAULT = 5;

// Contact sources
export const CONTACT_SOURCES = ['manual', 'google'] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

// Default tags by mode
export const DEFAULT_TAGS_BUSINESS = [
  'client',
  'lead',
  'prospect',
  'partner',
  'vendor',
  'investor',
  'colleague',
] as const;

export const DEFAULT_TAGS_PERSONAL = ['family', 'friend', 'acquaintance', 'neighbor'] as const;

// All allowed tags (merged)
export const ALLOWED_TAGS = [...DEFAULT_TAGS_BUSINESS, ...DEFAULT_TAGS_PERSONAL] as const;

export type ContactTag = (typeof ALLOWED_TAGS)[number];
