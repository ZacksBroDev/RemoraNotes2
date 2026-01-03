/**
 * ReminderMaterializerService
 *
 * Converts ReminderRule records into ReminderInstance records for a user.
 * Uses instanceKey-based upserts for idempotency.
 *
 * Key concepts:
 * - instanceKey = `${ruleId}:${YYYY-MM-DD}` ensures idempotent materialization
 * - Rolling window based on plan (FREE=30 days, PRO=90 days)
 * - Supports fixed-date (birthday, anniversary) and interval-based (follow_up) rules
 * - Generates instances for each notifyDaysBefore offset
 */

import mongoose, { type Types } from 'mongoose';
import {
  format,
  addDays,
  startOfDay,
  isBefore,
  isAfter,
  setYear,
  setMonth,
  setDate,
  differenceInDays,
} from 'date-fns';
import { ReminderRule } from '../models/ReminderRule.js';
import { ReminderInstance } from '../models/ReminderInstance.js';
import { Contact } from '../models/Contact.js';
import type {
  PlanTier,
  ReminderType,
  ReminderPriority,
  IntervalAnchor,
  MonthDay,
} from '@remoranotes/shared';
import { MATERIALIZATION_WINDOW } from '@remoranotes/shared';

// Lean rule type for query results
interface LeanReminderRule {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  contactId: Types.ObjectId;
  type: ReminderType;
  fixedDate?: MonthDay;
  intervalDays?: number;
  intervalAnchor?: IntervalAnchor;
  customAnchorDate?: Date;
  priority: ReminderPriority;
  isActive: boolean;
  notifyDaysBefore: number[];
  customTitle?: string;
  createdAt: Date;
}

interface MaterializationResult {
  userId: string;
  rulesProcessed: number;
  instancesCreated: number;
  instancesUpdated: number;
  errors: Array<{ ruleId: string; error: string }>;
}

interface LastContactInfo {
  contactId: string;
  lastContactedAt: Date | null;
}

/**
 * Service responsible for materializing reminder rules into instances
 */
class ReminderMaterializerService {
  /**
   * Materialize all active rules for a user within the specified window
   * @param userId - The user's ID
   * @param plan - User's plan tier (determines window size)
   * @returns Materialization result with counts and any errors
   */
  async materializeUser(
    userId: string | Types.ObjectId,
    plan: PlanTier = 'free'
  ): Promise<MaterializationResult> {
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const windowDays = MATERIALIZATION_WINDOW[plan];

    const result: MaterializationResult = {
      userId: userObjId.toString(),
      rulesProcessed: 0,
      instancesCreated: 0,
      instancesUpdated: 0,
      errors: [],
    };

    // Fetch all active rules for the user
    const rules = await ReminderRule.find({
      userId: userObjId,
      isActive: true,
    }).lean();

    if (rules.length === 0) {
      return result;
    }

    // Fetch contact info for lastContactedAt dates (for follow_up rules)
    const contactIds = [
      ...new Set(rules.map((r: { contactId: { toString(): string } }) => r.contactId.toString())),
    ];
    const contacts = await Contact.find({
      _id: { $in: contactIds },
      userId: userObjId,
    })
      .select('_id name lastContactedAt')
      .lean();

    const contactMap = new Map<string, (typeof contacts)[number]>();
    for (const contact of contacts) {
      contactMap.set(contact._id.toString(), contact);
    }

    // Build all instances to upsert
    const bulkOps: mongoose.AnyBulkWriteOperation<typeof ReminderInstance>[] = [];

    const windowStart = startOfDay(new Date());
    const windowEnd = addDays(windowStart, windowDays);

    for (const rule of rules) {
      try {
        result.rulesProcessed++;

        const contact = contactMap.get(rule.contactId.toString());
        if (!contact) {
          result.errors.push({
            ruleId: rule._id.toString(),
            error: 'Contact not found',
          });
          continue;
        }

        const dueDates = this.computeDueDates(rule, windowStart, windowEnd, {
          contactId: contact._id.toString(),
          lastContactedAt: contact.lastContactedAt || null,
        });

        for (const dueDate of dueDates) {
          const instanceKey = this.generateInstanceKey(rule._id.toString(), dueDate);

          bulkOps.push({
            updateOne: {
              filter: { instanceKey },
              update: {
                $setOnInsert: {
                  ruleId: rule._id,
                  userId: userObjId,
                  contactId: rule.contactId,
                  instanceKey,
                  dueDate,
                  status: 'pending',
                  type: rule.type,
                  priority: rule.priority,
                  contactName: contact.name,
                  customTitle: rule.customTitle,
                  createdAt: new Date(),
                },
                $set: {
                  updatedAt: new Date(),
                },
              },
              upsert: true,
            },
          });
        }
      } catch (err) {
        result.errors.push({
          ruleId: rule._id.toString(),
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Execute bulk upsert
    if (bulkOps.length > 0) {
      const bulkResult = await ReminderInstance.bulkWrite(bulkOps, {
        ordered: false,
      });

      result.instancesCreated = bulkResult.upsertedCount || 0;
      result.instancesUpdated = bulkResult.modifiedCount || 0;
    }

    return result;
  }

  /**
   * Materialize instances for a single rule (used when a rule is created/updated)
   */
  async materializeRule(
    ruleId: string | Types.ObjectId,
    plan: PlanTier = 'free'
  ): Promise<MaterializationResult> {
    const ruleObjId = typeof ruleId === 'string' ? new mongoose.Types.ObjectId(ruleId) : ruleId;

    const rule = await ReminderRule.findById(ruleObjId).lean();
    if (!rule) {
      return {
        userId: '',
        rulesProcessed: 0,
        instancesCreated: 0,
        instancesUpdated: 0,
        errors: [{ ruleId: ruleObjId.toString(), error: 'Rule not found' }],
      };
    }

    const contact = await Contact.findById(rule.contactId)
      .select('_id displayName lastContactedAt')
      .lean();

    if (!contact) {
      return {
        userId: rule.userId.toString(),
        rulesProcessed: 1,
        instancesCreated: 0,
        instancesUpdated: 0,
        errors: [{ ruleId: ruleObjId.toString(), error: 'Contact not found' }],
      };
    }

    const windowDays = MATERIALIZATION_WINDOW[plan];
    const windowStart = startOfDay(new Date());
    const windowEnd = addDays(windowStart, windowDays);

    const dueDates = this.computeDueDates(rule, windowStart, windowEnd, {
      contactId: contact._id.toString(),
      lastContactedAt: contact.lastContactedAt || null,
    });

    const bulkOps: mongoose.AnyBulkWriteOperation<typeof ReminderInstance>[] = [];

    for (const dueDate of dueDates) {
      const instanceKey = this.generateInstanceKey(rule._id.toString(), dueDate);

      bulkOps.push({
        updateOne: {
          filter: { instanceKey },
          update: {
            $setOnInsert: {
              ruleId: rule._id,
              userId: rule.userId,
              contactId: rule.contactId,
              instanceKey,
              dueDate,
              status: 'pending',
              type: rule.type,
              priority: rule.priority,
              contactName: contact.name,
              customTitle: rule.customTitle,
              createdAt: new Date(),
            },
            $set: {
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    let instancesCreated = 0;
    let instancesUpdated = 0;

    if (bulkOps.length > 0) {
      const bulkResult = await ReminderInstance.bulkWrite(bulkOps, {
        ordered: false,
      });
      instancesCreated = bulkResult.upsertedCount || 0;
      instancesUpdated = bulkResult.modifiedCount || 0;
    }

    return {
      userId: rule.userId.toString(),
      rulesProcessed: 1,
      instancesCreated,
      instancesUpdated,
      errors: [],
    };
  }

  /**
   * Rematerialize a contact's follow_up rules after an interaction
   * Called when a new interaction is logged to recompute due dates
   */
  async rematerializeForContact(
    contactId: string | Types.ObjectId,
    plan: PlanTier = 'free'
  ): Promise<MaterializationResult> {
    const contactObjId =
      typeof contactId === 'string' ? new mongoose.Types.ObjectId(contactId) : contactId;

    const contact = await Contact.findById(contactObjId)
      .select('_id userId displayName lastContactedAt')
      .lean();

    if (!contact) {
      return {
        userId: '',
        rulesProcessed: 0,
        instancesCreated: 0,
        instancesUpdated: 0,
        errors: [{ ruleId: contactObjId.toString(), error: 'Contact not found' }],
      };
    }

    // Find follow_up rules for this contact
    const rules = await ReminderRule.find({
      contactId: contactObjId,
      type: 'follow_up',
      isActive: true,
    }).lean();

    const windowDays = MATERIALIZATION_WINDOW[plan];
    const windowStart = startOfDay(new Date());
    const windowEnd = addDays(windowStart, windowDays);

    const bulkOps: mongoose.AnyBulkWriteOperation<typeof ReminderInstance>[] = [];

    let rulesProcessed = 0;
    const errors: Array<{ ruleId: string; error: string }> = [];

    for (const rule of rules) {
      try {
        rulesProcessed++;

        const dueDates = this.computeDueDates(rule, windowStart, windowEnd, {
          contactId: contact._id.toString(),
          lastContactedAt: contact.lastContactedAt || null,
        });

        for (const dueDate of dueDates) {
          const instanceKey = this.generateInstanceKey(rule._id.toString(), dueDate);

          bulkOps.push({
            updateOne: {
              filter: { instanceKey },
              update: {
                $setOnInsert: {
                  ruleId: rule._id,
                  userId: rule.userId,
                  contactId: rule.contactId,
                  instanceKey,
                  dueDate,
                  status: 'pending',
                  type: rule.type,
                  priority: rule.priority,
                  contactName: contact.name,
                  customTitle: rule.customTitle,
                  createdAt: new Date(),
                },
                $set: {
                  updatedAt: new Date(),
                },
              },
              upsert: true,
            },
          });
        }
      } catch (err) {
        errors.push({
          ruleId: rule._id.toString(),
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    let instancesCreated = 0;
    let instancesUpdated = 0;

    if (bulkOps.length > 0) {
      const bulkResult = await ReminderInstance.bulkWrite(bulkOps, {
        ordered: false,
      });
      instancesCreated = bulkResult.upsertedCount || 0;
      instancesUpdated = bulkResult.modifiedCount || 0;
    }

    return {
      userId: contact.userId.toString(),
      rulesProcessed,
      instancesCreated,
      instancesUpdated,
      errors,
    };
  }

  /**
   * Generate unique instance key for idempotency
   */
  private generateInstanceKey(ruleId: string, dueDate: Date): string {
    const dateStr = format(dueDate, 'yyyy-MM-dd');
    return `${ruleId}:${dateStr}`;
  }

  /**
   * Compute all due dates for a rule within the given window
   */
  private computeDueDates(
    rule: LeanReminderRule,
    windowStart: Date,
    windowEnd: Date,
    contactInfo: LastContactInfo
  ): Date[] {
    const dueDates: Date[] = [];

    switch (rule.type) {
      case 'birthday':
      case 'anniversary':
        dueDates.push(...this.computeFixedDateDues(rule, windowStart, windowEnd));
        break;

      case 'follow_up':
        dueDates.push(...this.computeFollowUpDues(rule, windowStart, windowEnd, contactInfo));
        break;

      case 'custom':
        if (rule.fixedDate) {
          dueDates.push(...this.computeFixedDateDues(rule, windowStart, windowEnd));
        } else if (rule.intervalDays) {
          dueDates.push(...this.computeFollowUpDues(rule, windowStart, windowEnd, contactInfo));
        }
        break;
    }

    return dueDates;
  }

  /**
   * Compute due dates for fixed-date reminders (birthday, anniversary)
   * Returns dates for current and next year if within window
   */
  private computeFixedDateDues(rule: LeanReminderRule, windowStart: Date, windowEnd: Date): Date[] {
    if (!rule.fixedDate) return [];

    const dueDates: Date[] = [];
    const { month, day } = rule.fixedDate;
    const notifyOffsets = rule.notifyDaysBefore || [0];

    // Check current year and next year
    const currentYear = windowStart.getFullYear();

    for (const year of [currentYear, currentYear + 1]) {
      // Create the anniversary date for this year
      let eventDate = setYear(windowStart, year);
      eventDate = setMonth(eventDate, month - 1); // months are 0-indexed
      eventDate = setDate(eventDate, day);
      eventDate = startOfDay(eventDate);

      // Generate instances for each notification offset
      for (const offset of notifyOffsets) {
        const notifyDate = addDays(eventDate, -offset);

        if (!isBefore(notifyDate, windowStart) && !isAfter(notifyDate, windowEnd)) {
          dueDates.push(notifyDate);
        }
      }
    }

    return dueDates;
  }

  /**
   * Compute due dates for interval-based reminders (follow_up)
   * Anchors to lastContactedAt, creation date, or custom date
   */
  private computeFollowUpDues(
    rule: LeanReminderRule,
    windowStart: Date,
    windowEnd: Date,
    contactInfo: LastContactInfo
  ): Date[] {
    if (!rule.intervalDays) return [];

    const dueDates: Date[] = [];
    const notifyOffsets = rule.notifyDaysBefore || [0];

    // Determine anchor date
    let anchorDate: Date;
    switch (rule.intervalAnchor) {
      case 'last_contact':
        if (!contactInfo.lastContactedAt) {
          // If no contact yet, anchor to rule creation
          anchorDate = rule.createdAt;
        } else {
          anchorDate = contactInfo.lastContactedAt;
        }
        break;

      case 'custom_date':
        anchorDate = rule.customAnchorDate || rule.createdAt;
        break;

      case 'creation':
      default:
        anchorDate = rule.createdAt;
        break;
    }

    anchorDate = startOfDay(anchorDate);

    // Find the first due date at or after windowStart
    const daysSinceAnchor = differenceInDays(windowStart, anchorDate);
    const intervalsPassed = Math.floor(daysSinceAnchor / rule.intervalDays);
    let nextDueDate = addDays(anchorDate, (intervalsPassed + 1) * rule.intervalDays);

    // If the next due is before window start, advance one interval
    while (isBefore(nextDueDate, windowStart)) {
      nextDueDate = addDays(nextDueDate, rule.intervalDays);
    }

    // Generate all due dates within the window
    while (!isAfter(nextDueDate, windowEnd)) {
      for (const offset of notifyOffsets) {
        const notifyDate = addDays(nextDueDate, -offset);

        if (!isBefore(notifyDate, windowStart) && !isAfter(notifyDate, windowEnd)) {
          dueDates.push(notifyDate);
        }
      }
      nextDueDate = addDays(nextDueDate, rule.intervalDays);
    }

    return dueDates;
  }

  /**
   * Delete stale instances outside the materialization window
   * Called periodically to clean up old instances
   */
  async pruneStaleInstances(userId: string | Types.ObjectId): Promise<number> {
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Delete instances that are:
    // - Older than 30 days and status is completed/skipped
    // - Older than 90 days regardless of status
    const thirtyDaysAgo = addDays(new Date(), -30);
    const ninetyDaysAgo = addDays(new Date(), -90);

    const result = await ReminderInstance.deleteMany({
      userId: userObjId,
      $or: [
        {
          dueDate: { $lt: thirtyDaysAgo },
          status: { $in: ['completed', 'skipped'] },
        },
        { dueDate: { $lt: ninetyDaysAgo } },
      ],
    });

    return result.deletedCount || 0;
  }
}

export default new ReminderMaterializerService();
export { ReminderMaterializerService };
