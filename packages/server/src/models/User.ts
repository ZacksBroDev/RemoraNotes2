import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  USER_MODES,
  PLAN_TIERS,
  type UserMode,
  type PlanTier,
  type GoogleOptionalScope,
} from '@remoranotes/shared';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  googleId: string;
  email: string;
  emailHash: string;
  name: string;
  avatarUrl?: string;

  // Mode & plan
  mode: UserMode;
  plan: PlanTier;

  // OAuth tokens (encrypted)
  encryptedRefreshToken?: string;
  encryptedDEK: string;

  // Granted Google scopes
  grantedScopes: GoogleOptionalScope[];

  // Preferences
  timezone: string;
  digestTime: string;
  digestEnabled: boolean;
  storeEventTitles: boolean;

  // Sync state
  calendarSyncToken?: string;
  lastCalendarSyncAt?: Date;
  contactsSyncToken?: string;
  lastContactsSyncAt?: Date;

  // Onboarding
  onboardingCompleted: boolean;
  onboardingStep?: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
    },
    emailHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    avatarUrl: String,

    // Mode & plan
    mode: {
      type: String,
      enum: USER_MODES,
      default: 'both',
    },
    plan: {
      type: String,
      enum: PLAN_TIERS,
      default: 'free',
    },

    // OAuth (encrypted)
    encryptedRefreshToken: String,
    encryptedDEK: {
      type: String,
      required: true,
    },

    // Granted scopes
    grantedScopes: {
      type: [String],
      default: [],
    },

    // Preferences
    timezone: {
      type: String,
      default: 'America/New_York',
    },
    digestTime: {
      type: String,
      default: '08:00',
    },
    digestEnabled: {
      type: Boolean,
      default: true,
    },
    storeEventTitles: {
      type: Boolean,
      default: false,
    },

    // Sync state
    calendarSyncToken: String,
    lastCalendarSyncAt: Date,
    contactsSyncToken: String,
    lastContactsSyncAt: Date,

    // Onboarding
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    onboardingStep: Number,

    // Last login
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Don't return sensitive fields by default
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.encryptedRefreshToken;
    delete obj.encryptedDEK;
    delete obj.calendarSyncToken;
    delete obj.contactsSyncToken;
    delete obj.__v;
    return ret;
  },
});

export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
