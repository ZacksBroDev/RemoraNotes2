import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ICalendarEvent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  // Google Calendar identifiers
  googleEventId: string;
  googleCalendarId: string;

  // Event timing
  startDateTime: Date;
  endDateTime: Date;
  isAllDay: boolean;
  timezone: string;

  // Optional title (encrypted)
  summary?: string;

  // Linked contact
  contactId?: mongoose.Types.ObjectId;

  // Sync tracking
  lastSyncedAt: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const calendarEventSchema = new Schema<ICalendarEvent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Google identifiers
    googleEventId: {
      type: String,
      required: true,
    },
    googleCalendarId: {
      type: String,
      required: true,
    },

    // Timing
    startDateTime: {
      type: Date,
      required: true,
      index: true,
    },
    endDateTime: {
      type: Date,
      required: true,
    },
    isAllDay: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      required: true,
    },

    // Optional encrypted title
    summary: String,

    // Linked contact
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      sparse: true,
    },

    // Sync tracking
    lastSyncedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
calendarEventSchema.index({ userId: 1, googleEventId: 1 }, { unique: true });
calendarEventSchema.index({ userId: 1, startDateTime: 1, endDateTime: 1 });
calendarEventSchema.index({ userId: 1, contactId: 1 }, { sparse: true });

// TTL index for auto-cleanup (events older than retention window)
// This will be managed by a scheduled job instead for variable window per plan
// But we add a safety TTL of 120 days
calendarEventSchema.index({ endDateTime: 1 }, { expireAfterSeconds: 120 * 24 * 60 * 60 });

calendarEventSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const CalendarEvent: Model<ICalendarEvent> = mongoose.model<ICalendarEvent>(
  'CalendarEvent',
  calendarEventSchema
);
