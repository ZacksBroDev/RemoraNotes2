import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { INTERACTION_TYPES, type InteractionType } from '@remoranotes/shared';

export interface IInteraction extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId;

  // Interaction details
  type: InteractionType;
  occurredAt: Date;
  notes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const interactionSchema = new Schema<IInteraction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true,
    },

    // Interaction details
    type: {
      type: String,
      enum: INTERACTION_TYPES,
      required: true,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
interactionSchema.index({ userId: 1, contactId: 1, occurredAt: -1 });
interactionSchema.index({ userId: 1, occurredAt: -1 });
interactionSchema.index({ contactId: 1, occurredAt: -1 });

interactionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.__v;
    return ret;
  },
});

export const Interaction: Model<IInteraction> = mongoose.model<IInteraction>(
  'Interaction',
  interactionSchema
);
