import type { InteractionType } from '../constants/index.js';

export interface Interaction {
  _id: string;
  userId: string;
  contactId: string;

  // Interaction details
  type: InteractionType;
  occurredAt: Date;
  notes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface InteractionCreate {
  contactId: string;
  type: InteractionType;
  occurredAt?: Date; // Defaults to now
  notes?: string;
}

export interface InteractionUpdate {
  type?: InteractionType;
  occurredAt?: Date;
  notes?: string;
}
