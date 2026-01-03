/**
 * CalendarEventService
 *
 * Syncs Google Calendar events with a rolling window cache.
 * Privacy-first design: only stores titles if user opts in.
 *
 * Rolling window:
 * - FREE: 30 days back, 30 days forward
 * - PRO: 90 days back, 90 days forward
 */

import mongoose, { type Types } from 'mongoose';
import { google, type calendar_v3 } from 'googleapis';
import { addDays, subDays, parseISO } from 'date-fns';
import { CalendarEvent, type ICalendarEvent } from '../models/CalendarEvent.js';
import { User } from '../models/User.js';
import { Contact } from '../models/Contact.js';
import { logAudit } from './AuditService.js';
import { MATERIALIZATION_WINDOW, type PlanTier } from '@remoranotes/shared';

// Calendar window mirrors materialization window
const CALENDAR_WINDOW = MATERIALIZATION_WINDOW;

// Lean document type for query results
type LeanCalendarEvent = Omit<ICalendarEvent, keyof mongoose.Document> & {
  _id: mongoose.Types.ObjectId;
};

interface SyncResult {
  userId: string;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errors: string[];
  syncToken?: string;
}

interface CalendarEventInput {
  googleEventId: string;
  googleCalendarId: string;
  startDateTime: Date;
  endDateTime: Date;
  isAllDay: boolean;
  timezone: string;
  summary?: string;
  contactId?: Types.ObjectId;
}

interface GetEventsOptions {
  startDate?: Date;
  endDate?: Date;
  contactId?: string;
  limit?: number;
}

/**
 * Service for syncing and managing calendar events
 */
class CalendarEventService {
  /**
   * Perform a full or incremental sync of calendar events for a user
   */
  async syncUserCalendar(
    userId: string | Types.ObjectId,
    options: { fullSync?: boolean } = {}
  ): Promise<SyncResult> {
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const result: SyncResult = {
      userId: userObjId.toString(),
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: [],
    };

    // Fetch user with tokens
    const user = await User.findById(userObjId).select(
      'googleId encryptedRefreshToken calendarSyncToken plan settings'
    );

    if (!user) {
      result.errors.push('User not found');
      return result;
    }

    if (!user.encryptedRefreshToken) {
      result.errors.push('No calendar access - user needs to grant calendar permission');
      return result;
    }

    // Setup OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Decrypt and set refresh token
    // TODO: Implement KMS decryption for refresh token
    // For now, we'll assume it's available in plaintext during dev
    const refreshToken = user.encryptedRefreshToken; // Would decrypt in production

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Determine window
    const plan: PlanTier = user.plan || 'free';
    const windowDays = CALENDAR_WINDOW[plan];
    const now = new Date();
    const timeMin = subDays(now, windowDays).toISOString();
    const timeMax = addDays(now, windowDays).toISOString();

    try {
      // Use incremental sync if we have a sync token and not forcing full sync
      const useSyncToken = !options.fullSync && user.calendarSyncToken;

      let pageToken: string | undefined;
      const processedEventIds = new Set<string>();

      do {
        const listParams: calendar_v3.Params$Resource$Events$List = {
          calendarId: 'primary',
          maxResults: 250,
          singleEvents: true,
          orderBy: 'startTime',
        };

        if (useSyncToken) {
          listParams.syncToken = user.calendarSyncToken;
        } else {
          listParams.timeMin = timeMin;
          listParams.timeMax = timeMax;
        }

        if (pageToken) {
          listParams.pageToken = pageToken;
        }

        const response = await calendar.events.list(listParams);
        const events = response.data.items || [];

        for (const event of events) {
          if (!event.id) continue;

          processedEventIds.add(event.id);

          // Handle deleted events
          if (event.status === 'cancelled') {
            const deleteResult = await CalendarEvent.deleteOne({
              userId: userObjId,
              googleEventId: event.id,
            });
            if (deleteResult.deletedCount > 0) {
              result.eventsDeleted++;
            }
            continue;
          }

          // Parse event timing
          const eventData = this.parseGoogleEvent(event, userObjId, user.storeEventTitles);

          if (!eventData) {
            continue; // Skip events we can't parse
          }

          // Try to match with a contact based on attendees
          if (event.attendees && event.attendees.length > 0) {
            const contactId = await this.findContactForEvent(userObjId, event.attendees);
            if (contactId) {
              eventData.contactId = contactId;
            }
          }

          // Upsert the event
          const updateResult = await CalendarEvent.updateOne(
            {
              userId: userObjId,
              googleEventId: event.id,
            },
            {
              $set: {
                ...eventData,
                lastSyncedAt: now,
                updatedAt: now,
              },
              $setOnInsert: {
                createdAt: now,
              },
            },
            { upsert: true }
          );

          if (updateResult.upsertedCount > 0) {
            result.eventsCreated++;
          } else if (updateResult.modifiedCount > 0) {
            result.eventsUpdated++;
          }
        }

        // Store sync token for next incremental sync
        if (response.data.nextSyncToken) {
          result.syncToken = response.data.nextSyncToken;
          await User.updateOne(
            { _id: userObjId },
            { $set: { calendarSyncToken: response.data.nextSyncToken } }
          );
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      // For full sync, delete events not in the response
      if (!useSyncToken) {
        const deleteResult = await CalendarEvent.deleteMany({
          userId: userObjId,
          googleEventId: { $nin: Array.from(processedEventIds) },
          startDateTime: { $gte: new Date(timeMin), $lte: new Date(timeMax) },
        });
        result.eventsDeleted += deleteResult.deletedCount || 0;
      }

      // Audit log
      logAudit({
        userId: userObjId.toString(),
        action: 'CALENDAR_SYNC',
        resourceType: 'calendar_event',
        metadata: {
          created: result.eventsCreated,
          updated: result.eventsUpdated,
          deleted: result.eventsDeleted,
          fullSync: options.fullSync || false,
        },
      });
    } catch (err) {
      const error = err as Error & { code?: number };

      // Handle token expiration or invalid grant
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        result.errors.push('Calendar access expired - user needs to re-authorize');
        // Clear the sync token to force full sync on next attempt
        await User.updateOne({ _id: userObjId }, { $unset: { calendarSyncToken: '' } });
      } else if (error.code === 410) {
        // Sync token expired, need full sync
        result.errors.push('Sync token expired - performing full sync');
        await User.updateOne({ _id: userObjId }, { $unset: { calendarSyncToken: '' } });
        // Retry with full sync
        return this.syncUserCalendar(userId, { fullSync: true });
      } else {
        result.errors.push(error.message || 'Unknown error during sync');
      }
    }

    return result;
  }

  /**
   * Parse a Google Calendar event into our format
   */
  private parseGoogleEvent(
    event: calendar_v3.Schema$Event,
    _userId: Types.ObjectId,
    storeTitles: boolean = false
  ): CalendarEventInput | null {
    if (!event.id || !event.start || !event.end) {
      return null;
    }

    let startDateTime: Date;
    let endDateTime: Date;
    let isAllDay = false;
    let timezone = 'UTC';

    if (event.start.date) {
      // All-day event
      isAllDay = true;
      startDateTime = parseISO(event.start.date);
      endDateTime = event.end.date ? parseISO(event.end.date) : startDateTime;
      timezone = event.start.timeZone || 'UTC';
    } else if (event.start.dateTime) {
      // Timed event
      startDateTime = new Date(event.start.dateTime);
      endDateTime = event.end.dateTime ? new Date(event.end.dateTime) : startDateTime;
      timezone = event.start.timeZone || 'UTC';
    } else {
      return null;
    }

    const eventData: CalendarEventInput = {
      googleEventId: event.id,
      googleCalendarId: 'primary',
      startDateTime,
      endDateTime,
      isAllDay,
      timezone,
    };

    // Only store title if user has opted in
    if (storeTitles && event.summary) {
      eventData.summary = event.summary;
    }

    return eventData;
  }

  /**
   * Try to match event attendees with a contact
   */
  private async findContactForEvent(
    userId: Types.ObjectId,
    attendees: calendar_v3.Schema$EventAttendee[]
  ): Promise<Types.ObjectId | null> {
    // Get emails from attendees (exclude self)
    const attendeeEmails = attendees
      .filter((a) => a.email && !a.self)
      .map((a) => a.email!.toLowerCase());

    if (attendeeEmails.length === 0) {
      return null;
    }

    // Find a contact with matching email
    // Note: In production, we'd use the emailHash for privacy
    const contact = await Contact.findOne({
      userId,
      'emails.value': { $in: attendeeEmails },
    }).select('_id');

    return contact?._id || null;
  }

  /**
   * Get calendar events for a user within a date range
   */
  async getEvents(
    userId: string | Types.ObjectId,
    options: GetEventsOptions = {}
  ): Promise<LeanCalendarEvent[]> {
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const query: Record<string, unknown> = { userId: userObjId };

    if (options.startDate) {
      query.startDateTime = { $gte: options.startDate };
    }

    if (options.endDate) {
      query.endDateTime = { ...(query.endDateTime as object), $lte: options.endDate };
    }

    if (options.contactId) {
      query.contactId = new mongoose.Types.ObjectId(options.contactId);
    }

    return CalendarEvent.find(query)
      .sort({ startDateTime: 1 })
      .limit(options.limit || 100)
      .lean() as Promise<LeanCalendarEvent[]>;
  }

  /**
   * Get upcoming events for a contact
   */
  async getContactEvents(
    contactId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    options: { limit?: number; includeHistorical?: boolean } = {}
  ): Promise<LeanCalendarEvent[]> {
    const contactObjId =
      typeof contactId === 'string' ? new mongoose.Types.ObjectId(contactId) : contactId;
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const query: Record<string, unknown> = {
      userId: userObjId,
      contactId: contactObjId,
    };

    if (!options.includeHistorical) {
      query.startDateTime = { $gte: new Date() };
    }

    return CalendarEvent.find(query)
      .sort({ startDateTime: options.includeHistorical ? -1 : 1 })
      .limit(options.limit || 20)
      .lean() as Promise<LeanCalendarEvent[]>;
  }

  /**
   * Get today's calendar events for a user
   */
  async getTodayEvents(userId: string | Types.ObjectId): Promise<LeanCalendarEvent[]> {
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    return CalendarEvent.find({
      userId: userObjId,
      $or: [
        // Events that start today
        { startDateTime: { $gte: todayStart, $lte: todayEnd } },
        // All-day events that span today
        {
          isAllDay: true,
          startDateTime: { $lte: todayEnd },
          endDateTime: { $gte: todayStart },
        },
      ],
    })
      .sort({ startDateTime: 1 })
      .lean() as Promise<LeanCalendarEvent[]>;
  }

  /**
   * Clean up events outside the retention window
   */
  async pruneOldEvents(userId: string | Types.ObjectId, plan: PlanTier = 'free'): Promise<number> {
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const windowDays = CALENDAR_WINDOW[plan];
    const cutoffDate = subDays(new Date(), windowDays);

    const result = await CalendarEvent.deleteMany({
      userId: userObjId,
      endDateTime: { $lt: cutoffDate },
    });

    return result.deletedCount || 0;
  }

  /**
   * Link an event to a contact manually
   */
  async linkEventToContact(
    eventId: string | Types.ObjectId,
    contactId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<ICalendarEvent | null> {
    const eventObjId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    const contactObjId =
      typeof contactId === 'string' ? new mongoose.Types.ObjectId(contactId) : contactId;
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Verify contact belongs to user
    const contact = await Contact.findOne({
      _id: contactObjId,
      userId: userObjId,
    });

    if (!contact) {
      return null;
    }

    return CalendarEvent.findOneAndUpdate(
      { _id: eventObjId, userId: userObjId },
      { $set: { contactId: contactObjId } },
      { new: true }
    );
  }

  /**
   * Unlink an event from a contact
   */
  async unlinkEventFromContact(
    eventId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<ICalendarEvent | null> {
    const eventObjId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    return CalendarEvent.findOneAndUpdate(
      { _id: eventObjId, userId: userObjId },
      { $unset: { contactId: '' } },
      { new: true }
    );
  }
}

export default new CalendarEventService();
export { CalendarEventService };
