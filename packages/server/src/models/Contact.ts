import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  CONTACT_PRIORITIES,
  CONTACT_SOURCES,
  ALLOWED_TAGS,
  IMPORTANCE_DEFAULT,
  type ContactPriority,
  type ContactSource,
  type ContactTag,
  type MonthDay,
} from '@remoranotes/shared';

export interface ILocalOverrides {
  name?: string;
  phone?: string;
  notes?: string;
  company?: string;
  jobTitle?: string;
}

export interface IContact extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  // Identity
  name: string;
  email?: string; // Encrypted
  emailHash?: string;
  phone?: string; // Encrypted
  phoneHash?: string;

  // Work info
  company?: string;
  jobTitle?: string;

  // Categorization
  tags: ContactTag[];
  priority: ContactPriority;
  importance: number;

  // Dates
  birthday?: MonthDay;
  anniversary?: MonthDay;

  // Notes
  notes?: string;

  // Source tracking
  source: ContactSource;
  googleResourceName?: string;
  hasGoogleLink: boolean;
  localOverrides?: ILocalOverrides;
  lastSyncedAt?: Date;

  // Interaction tracking
  lastContactedAt?: Date;
  interactionCount: number;

  // Status
  isArchived: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const monthDaySchema = new Schema<MonthDay>(
  {
    month: { type: Number, min: 1, max: 12, required: true },
    day: { type: Number, min: 1, max: 31, required: true },
    year: { type: Number },
  },
  { _id: false }
);

const localOverridesSchema = new Schema<ILocalOverrides>(
  {
    name: String,
    phone: String,
    notes: String,
    company: String,
    jobTitle: String,
  },
  { _id: false }
);

const contactSchema = new Schema<IContact>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Identity
    name: {
      type: String,
      required: true,
      index: 'text',
    },
    email: String, // Encrypted
    emailHash: String,
    phone: String, // Encrypted
    phoneHash: String,

    // Work info
    company: String,
    jobTitle: String,

    // Categorization
    tags: {
      type: [{ type: String, enum: ALLOWED_TAGS }],
      default: [],
      index: true,
    },
    priority: {
      type: String,
      enum: CONTACT_PRIORITIES,
      default: 'medium',
    },
    importance: {
      type: Number,
      min: 1,
      max: 10,
      default: IMPORTANCE_DEFAULT,
    },

    // Dates
    birthday: monthDaySchema,
    anniversary: monthDaySchema,

    // Notes
    notes: String,

    // Source tracking
    source: {
      type: String,
      enum: CONTACT_SOURCES,
      default: 'manual',
    },
    googleResourceName: {
      type: String,
      sparse: true,
    },
    hasGoogleLink: {
      type: Boolean,
      default: false,
    },
    localOverrides: localOverridesSchema,
    lastSyncedAt: Date,

    // Interaction tracking
    lastContactedAt: Date,
    interactionCount: {
      type: Number,
      default: 0,
    },

    // Status
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
contactSchema.index({ userId: 1, emailHash: 1 }, { unique: true, sparse: true });
contactSchema.index({ userId: 1, phoneHash: 1 }, { sparse: true });
contactSchema.index({ userId: 1, googleResourceName: 1 }, { sparse: true });
contactSchema.index({ userId: 1, isArchived: 1 });
contactSchema.index({ userId: 1, lastContactedAt: -1 });
contactSchema.index({ userId: 1, 'birthday.month': 1, 'birthday.day': 1 });
contactSchema.index({ userId: 1, 'anniversary.month': 1, 'anniversary.day': 1 });

// Hide internal fields
contactSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.emailHash;
    delete ret.phoneHash;
    delete ret.localOverrides;
    delete ret.__v;
    return ret;
  },
});

export const Contact: Model<IContact> = mongoose.model<IContact>('Contact', contactSchema);
