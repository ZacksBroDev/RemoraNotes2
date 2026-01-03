/**
 * TodayQueueService
 *
 * Retrieves and scores today's reminder queue per ADR-004.
 *
 * Scoring formula:
 * - Base score from reminder type (birthday=15, anniversary=12, follow_up=10, custom=8)
 * - Multiplied by priority (high=3, medium=2, low=1)
 * - Plus overdue penalty (5 points per day overdue)
 *
 * Queue caps:
 * - FREE: 10 items
 * - PRO: 25 items
 */

import mongoose, { type Types, type PipelineStage } from 'mongoose';
import { startOfDay, endOfDay } from 'date-fns';
import { ReminderInstance, type IReminderInstance } from '../models/ReminderInstance.js';
import {
  REMINDER_TYPE_SCORES,
  PRIORITY_MULTIPLIERS,
  OVERDUE_PENALTY_PER_DAY,
  type PlanTier,
} from '@remoranotes/shared';

// Plan-based queue caps
const QUEUE_CAPS: Record<PlanTier, number> = {
  free: 10,
  pro: 25,
};

// Lean document type
type LeanReminderInstance = Omit<IReminderInstance, keyof mongoose.Document> & {
  _id: Types.ObjectId;
};

export interface ScoredReminder extends LeanReminderInstance {
  score: number;
  daysOverdue: number;
}

interface TodayQueueOptions {
  userId: string | Types.ObjectId;
  plan?: PlanTier;
  limit?: number;
  includeOverdue?: boolean;
  skipScoring?: boolean;
}

interface TodayQueueResult {
  items: ScoredReminder[];
  total: number;
  capped: boolean;
  appliedCap: number;
}

/**
 * Service for computing the Today Queue with scoring
 */
class TodayQueueService {
  /**
   * Get today's reminder queue for a user, scored and capped
   */
  async getTodayQueue(options: TodayQueueOptions): Promise<TodayQueueResult> {
    const { userId, plan = 'free', limit, includeOverdue = true, skipScoring = false } = options;

    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // Build match criteria
    const matchCriteria: Record<string, unknown> = {
      userId: userObjId,
      status: 'pending',
      // Include today's items and optionally overdue
      dueDate: includeOverdue ? { $lte: todayEnd } : { $gte: todayStart, $lte: todayEnd },
      // Exclude snoozed items
      $or: [{ snoozedUntil: { $exists: false } }, { snoozedUntil: { $lte: now } }],
    };

    // Determine cap to apply
    const appliedCap = limit ?? QUEUE_CAPS[plan];

    if (skipScoring) {
      // Simple query without scoring aggregation
      const items = await ReminderInstance.find(matchCriteria)
        .sort({ dueDate: 1, priority: -1 })
        .limit(appliedCap + 1) // +1 to detect if capped
        .lean();

      const capped = items.length > appliedCap;
      const resultItems = items.slice(0, appliedCap).map((item) => ({
        ...item,
        score: 0,
        daysOverdue: this.computeDaysOverdue(item.dueDate, todayStart),
      }));

      return {
        items: resultItems as ScoredReminder[],
        total: capped ? items.length : resultItems.length,
        capped,
        appliedCap,
      };
    }

    // Aggregation pipeline with scoring
    const pipeline: PipelineStage[] = [
      { $match: matchCriteria },
      {
        $addFields: {
          // Compute days overdue (minimum 0)
          daysOverdue: {
            $max: [
              0,
              {
                $floor: {
                  $divide: [{ $subtract: [todayStart, '$dueDate'] }, 1000 * 60 * 60 * 24],
                },
              },
            ],
          },
          // Map type to base score
          typeScore: {
            $switch: {
              branches: Object.entries(REMINDER_TYPE_SCORES).map(([type, score]) => ({
                case: { $eq: ['$type', type] },
                then: score,
              })),
              default: REMINDER_TYPE_SCORES.custom,
            },
          },
          // Map priority to multiplier
          priorityMultiplier: {
            $switch: {
              branches: Object.entries(PRIORITY_MULTIPLIERS).map(([priority, mult]) => ({
                case: { $eq: ['$priority', priority] },
                then: mult,
              })),
              default: PRIORITY_MULTIPLIERS.medium,
            },
          },
        },
      },
      {
        $addFields: {
          // Final score calculation
          score: {
            $add: [
              { $multiply: ['$typeScore', '$priorityMultiplier'] },
              { $multiply: ['$daysOverdue', OVERDUE_PENALTY_PER_DAY] },
            ],
          },
        },
      },
      // Sort by score descending
      { $sort: { score: -1, dueDate: 1 } },
      // Facet to get total count and capped results
      {
        $facet: {
          items: [{ $limit: appliedCap }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await ReminderInstance.aggregate(pipeline);

    const items = (result?.items || []) as ScoredReminder[];
    const totalCount = result?.totalCount?.[0]?.count || 0;
    const capped = totalCount > appliedCap;

    return {
      items,
      total: totalCount,
      capped,
      appliedCap,
    };
  }

  /**
   * Get count of pending reminders for today (for badge/notification)
   */
  async getTodayCount(userId: string | Types.ObjectId): Promise<number> {
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const now = new Date();
    const todayEnd = endOfDay(now);

    return ReminderInstance.countDocuments({
      userId: userObjId,
      status: 'pending',
      dueDate: { $lte: todayEnd },
      $or: [{ snoozedUntil: { $exists: false } }, { snoozedUntil: { $lte: now } }],
    });
  }

  /**
   * Get upcoming reminders for the week ahead
   */
  async getUpcoming(
    userId: string | Types.ObjectId,
    days: number = 7
  ): Promise<LeanReminderInstance[]> {
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const now = new Date();
    const todayEnd = endOfDay(now);
    const futureEnd = endOfDay(new Date(now.getTime() + days * 24 * 60 * 60 * 1000));

    return ReminderInstance.find({
      userId: userObjId,
      status: 'pending',
      dueDate: { $gt: todayEnd, $lte: futureEnd },
      $or: [{ snoozedUntil: { $exists: false } }, { snoozedUntil: { $gt: now } }],
    })
      .sort({ dueDate: 1 })
      .limit(50)
      .lean() as Promise<LeanReminderInstance[]>;
  }

  /**
   * Get overdue reminders only
   */
  async getOverdue(userId: string | Types.ObjectId): Promise<LeanReminderInstance[]> {
    const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const now = new Date();
    const todayStart = startOfDay(now);

    return ReminderInstance.find({
      userId: userObjId,
      status: 'pending',
      dueDate: { $lt: todayStart },
      $or: [{ snoozedUntil: { $exists: false } }, { snoozedUntil: { $lte: now } }],
    })
      .sort({ dueDate: 1 })
      .limit(100)
      .lean() as Promise<LeanReminderInstance[]>;
  }

  /**
   * Compute days overdue helper
   */
  private computeDaysOverdue(dueDate: Date, today: Date): number {
    const diff = today.getTime() - new Date(dueDate).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  }
}

export default new TodayQueueService();
export { TodayQueueService };
