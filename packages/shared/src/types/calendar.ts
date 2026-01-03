export interface CalendarEvent {
  _id: string;
  userId: string;

  // Google Calendar identifiers
  googleEventId: string;
  googleCalendarId: string;

  // Event timing
  startDateTime: Date;
  endDateTime: Date;
  isAllDay: boolean;
  timezone: string;

  // Optional title (encrypted, if user enabled)
  summary?: string;

  // Linked contact (if matched)
  contactId?: string;

  // Sync tracking
  lastSyncedAt: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarEventPublic {
  _id: string;
  startDateTime: Date;
  endDateTime: Date;
  isAllDay: boolean;
  timezone: string;
  summary?: string;
  contactId?: string;
}
