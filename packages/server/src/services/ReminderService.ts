/**
 * ReminderService
 *
 * CRUD operations for reminder rules and instances.
 * Includes done/snooze actions for instances.
 */

import mongoose, { type Types } from 'mongoose';
import { addDays } from 'date-fns';
import { ReminderRule, type IReminderRule } from '../models/ReminderRule.js';
import {
  ReminderInstance,
  type IReminderInstance,
} from '../models/ReminderInstance.js';
import { Contact } from '../models/Contact.js';
import ReminderMaterializerService from './ReminderMaterializerService.js';
import { logAudit } from './AuditService.js';
import type { PlanTier, ReminderType, ReminderPriority, MonthDay } from '@remoranotes/shared';

interface CreateRuleInput {
  userId: string | Types.ObjectId;
  contactId: string | Types.ObjectId;
  type: ReminderType;
  fixedDate?: MonthDay;
  intervalDays?: number;
  intervalAnchor?: 'last_contact' | 'creation' | 'custom_date';
  customAnchorDate?: Date;
  priority?: ReminderPriority;
  notifyDaysBefore?: number[];
  customTitle?: string;
  customNotes?: string;
}

interface UpdateRuleInput {
  type?: ReminderType;
  fixedDate?: MonthDay;
  intervalDays?: number;
  intervalAnchor?: 'last_contact' | 'creation' | 'custom_date';
  customAnchorDate?: Date;
  priority?: ReminderPriority;
  isActive?: boolean;
  notifyDaysBefore?: number[];
  customTitle?: string;
  customNotes?: string;
}

interface SnoozeInput {
  days?: number;
  until?: Date;
}

const DEFAULT_SNOOZE_DAYS = 1;

class ReminderService {
  // ==================== RULE OPERATIONS ====================

  /**
   * Create a new reminder rule and materialize instances
   */
  async createRule(
    input: CreateRuleInput,
    plan: PlanTier = 'free'
  ): Promise<IReminderRule> {
    const {
      userId,
      contactId,
      type,
      fixedDate,
      intervalDays,
      intervalAnchor,
      customAnchorDate,
      priority = 'medium',
      notifyDaysBefore,
      customTitle,
      customNotes,
    } = input;

    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const contactObjId =
      typeof contactId === 'string'
        ? new mongoose.Types.ObjectId(contactId)
        : contactId;

    // Verify contact belongs to user
    const contact = await Contact.findOne({
      _id: contactObjId,
      userId: userObjId,
    });
    if (!contact) {
      throw new Error('Contact not found');
    }

    // Validate rule configuration
    if (type === 'birthday' || type === 'anniversary') {
      if (!fixedDate) {
        throw new Error(`${type} reminders require a fixed date`);
      }
    }

    if (type === 'follow_up') {
      if (!intervalDays) {
        throw new Error('Follow-up reminders require an interval');
      }
    }

    const rule = new ReminderRule({
      userId: userObjId,
      contactId: contactObjId,
      type,
      fixedDate,
      intervalDays,
      intervalAnchor: intervalAnchor || 'last_contact',
      customAnchorDate,
      priority,
      notifyDaysBefore,
      customTitle,
      customNotes,
      isActive: true,
    });

    await rule.save();

    // Materialize instances for this rule
    await ReminderMaterializerService.materializeRule(rule._id, plan);

    // Audit log
    await logAudit({
      userId: userObjId.toString(),
      action: 'REMINDER_RULE_CREATE',
      resourceType: 'reminder_rule',
      resourceId: rule._id.toString(),
      metadata: { type, contactId: contactObjId.toString() },
    });

    return rule;
  }

  /**
   * Get a rule by ID
   */
  async getRule(
    ruleId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IReminderRule | null> {
    const ruleObjId =
      typeof ruleId === 'string' ? new mongoose.Types.ObjectId(ruleId) : ruleId;
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    return ReminderRule.findOne({ _id: ruleObjId, userId: userObjId });
  }

  /**
   * Get all rules for a user
   */
  async getUserRules(
    userId: string | Types.ObjectId,
    options: { isActive?: boolean; contactId?: string } = {}
  ): Promise<IReminderRule[]> {
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const query: Record<string, unknown> = { userId: userObjId };

    if (typeof options.isActive === 'boolean') {
      query.isActive = options.isActive;
    }

    if (options.contactId) {
      query.contactId = new mongoose.Types.ObjectId(options.contactId);
    }

    return ReminderRule.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get rules for a specific contact
   */
  async getContactRules(
    contactId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IReminderRule[]> {
    const contactObjId =
      typeof contactId === 'string'
        ? new mongoose.Types.ObjectId(contactId)
        : contactId;
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    return ReminderRule.find({
      contactId: contactObjId,
      userId: userObjId,
    }).sort({ type: 1, createdAt: -1 });
  }

  /**
   * Update a rule
   */
  async updateRule(
    ruleId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    updates: UpdateRuleInput,
    plan: PlanTier = 'free'
  ): Promise<IReminderRule | null> {
    const ruleObjId =
      typeof ruleId === 'string' ? new mongoose.Types.ObjectId(ruleId) : ruleId;
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const rule = await ReminderRule.findOneAndUpdate(
      { _id: ruleObjId, userId: userObjId },
      { $set: updates },
      { new: true }
    );

    if (rule) {
      // Re-materialize instances for updated rule
      await ReminderMaterializerService.materializeRule(rule._id, plan);

      await logAudit({
        userId: userObjId.toString(),
        action: 'REMINDER_RULE_UPDATE',
        resourceType: 'reminder_rule',
        resourceId: rule._id.toString(),
        metadata: { updates: Object.keys(updates) },
      });
    }

    return rule;
  }

  /**
   * Delete a rule and its instances
   */
  async deleteRule(
    ruleId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<boolean> {
    const ruleObjId =
      typeof ruleId === 'string' ? new mongoose.Types.ObjectId(ruleId) : ruleId;
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const rule = await ReminderRule.findOneAndDelete({
      _id: ruleObjId,
      userId: userObjId,
    });

    if (rule) {
      // Delete all instances for this rule
      await ReminderInstance.deleteMany({ ruleId: ruleObjId });

      await logAudit({
        userId: userObjId.toString(),
        action: 'REMINDER_RULE_DELETE',
        resourceType: 'reminder_rule',
        resourceId: ruleObjId.toString(),
      });

      return true;
    }

    return false;
  }

  // ==================== INSTANCE OPERATIONS ====================

  /**
   * Get an instance by ID
   */
  async getInstance(
    instanceId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IReminderInstance | null> {
    const instanceObjId =
      typeof instanceId === 'string'
        ? new mongoose.Types.ObjectId(instanceId)
        : instanceId;
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    return ReminderInstance.findOne({ _id: instanceObjId, userId: userObjId });
  }

  /**
   * Mark a reminder instance as done
   */
  async markDone(
    instanceId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IReminderInstance | null> {
    const instanceObjId =
      typeof instanceId === 'string'
        ? new mongoose.Types.ObjectId(instanceId)
        : instanceId;
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const instance = await ReminderInstance.findOneAndUpdate(
      {
        _id: instanceObjId,
        userId: userObjId,
        status: { $in: ['pending', 'snoozed'] },
      },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
        },
        $unset: {
          snoozedUntil: '',
        },
      },
      { new: true }
    );

    if (instance) {
      await logAudit({
        userId: userObjId.toString(),
        action: 'REMINDER_COMPLETE',
        resourceType: 'reminder_instance',
        resourceId: instanceObjId.toString(),
        metadata: { ruleId: instance.ruleId.toString() },
      });
    }

    return instance;
  }

  /**
   * Snooze a reminder instance
   */
  async snooze(
    instanceId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    options: SnoozeInput = {}
  ): Promise<IReminderInstance | null> {
    const instanceObjId =
      typeof instanceId === 'string'
        ? new mongoose.Types.ObjectId(instanceId)
        : instanceId;
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    let snoozedUntil: Date;

    if (options.until) {
      snoozedUntil = options.until;
    } else {
      const days = options.days ?? DEFAULT_SNOOZE_DAYS;
      snoozedUntil = addDays(new Date(), days);
    }

    const instance = await ReminderInstance.findOneAndUpdate(
      {
        _id: instanceObjId,
        userId: userObjId,
        status: 'pending',
      },
      {
        $set: {
          status: 'snoozed',
          snoozedUntil,
        },
      },
      { new: true }
    );

    if (instance) {
      await logAudit({
        userId: userObjId.toString(),
        action: 'REMINDER_SNOOZE',
        resourceType: 'reminder_instance',
        resourceId: instanceObjId.toString(),
        metadata: { snoozedUntil: snoozedUntil.toISOString() },
      });
    }

    return instance;
  }

  /**
   * Unsnooze a reminder (set back to pending)
   */
  async unsnooze(
    instanceId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IReminderInstance | null> {
    const instanceObjId =
      typeof instanceId === 'string'
        ? new mongoose.Types.ObjectId(instanceId)
        : instanceId;
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const instance = await ReminderInstance.findOneAndUpdate(
      {
        _id: instanceObjId,
        userId: userObjId,
        status: 'snoozed',
      },
      {
        $set: {
          status: 'pending',
        },
        $unset: {
          snoozedUntil: '',
        },
      },
      { new: true }
    );

    if (instance) {
      await logAudit({
        userId: userObjId.toString(),
        action: 'REMINDER_COMPLETE',
        resourceType: 'reminder_instance',
        resourceId: instanceObjId.toString(),
      });
    }

    return instance;
  }

  /**
   * Skip a reminder instance
   */
  async skip(
    instanceId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IReminderInstance | null> {
    const instanceObjId =
      typeof instanceId === 'string'
        ? new mongoose.Types.ObjectId(instanceId)
        : instanceId;
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const instance = await ReminderInstance.findOneAndUpdate(
      {
        _id: instanceObjId,
        userId: userObjId,
        status: { $in: ['pending', 'snoozed'] },
      },
      {
        $set: {
          status: 'skipped',
          skippedAt: new Date(),
        },
        $unset: {
          snoozedUntil: '',
        },
      },
      { new: true }
    );

    if (instance) {
      await logAudit({
        userId: userObjId.toString(),
        action: 'REMINDER_SKIP',
        resourceType: 'reminder_instance',
        resourceId: instanceObjId.toString(),
      });
    }

    return instance;
  }

  /**
   * Get instance history for a contact (completed/skipped)
   */
  async getContactHistory(
    contactId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    limit: number = 20
  ): Promise<IReminderInstance[]> {
    const contactObjId =
      typeof contactId === 'string'
        ? new mongoose.Types.ObjectId(contactId)
        : contactId;
    const userObjId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    return ReminderInstance.find({
      contactId: contactObjId,
      userId: userObjId,
      status: { $in: ['completed', 'skipped'] },
    })
      .sort({ completedAt: -1, skippedAt: -1 })
      .limit(limit);
  }
}

export default new ReminderService();
export { ReminderService };
