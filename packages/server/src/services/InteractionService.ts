import type mongoose from 'mongoose';
import { Interaction, type IInteraction, Contact } from '../models/index.js';
import { errors } from '../utils/index.js';
import type {
  InteractionCreate,
  InteractionUpdate,
  InteractionQuery,
} from '../schemas/interaction.js';
import { logAudit } from './AuditService.js';
import { ContactService } from './ContactService.js';
import type { PlanTier } from '@remoranotes/shared';

export class InteractionService {
  private userId: mongoose.Types.ObjectId;
  private encryptedDEK: string;
  private plan: PlanTier;
  private contactService: ContactService;

  constructor(userId: mongoose.Types.ObjectId, encryptedDEK: string, plan: PlanTier) {
    this.userId = userId;
    this.encryptedDEK = encryptedDEK;
    this.plan = plan;
    this.contactService = new ContactService(userId, encryptedDEK, plan);
  }

  private get baseQuery() {
    return { userId: this.userId };
  }

  // Create interaction
  async create(data: InteractionCreate, ip?: string): Promise<IInteraction> {
    // Verify contact exists and belongs to user
    const contact = await Contact.findOne({
      _id: data.contactId,
      userId: this.userId,
    });

    if (!contact) {
      throw errors.notFound('Contact');
    }

    const interaction = new Interaction({
      userId: this.userId,
      contactId: data.contactId,
      type: data.type,
      occurredAt: data.occurredAt ?? new Date(),
      notes: data.notes,
    });

    await interaction.save();

    // Update contact's lastContactedAt
    await this.contactService.updateLastContacted(data.contactId, interaction.occurredAt);

    // Audit log
    logAudit({
      userId: this.userId,
      action: 'INTERACTION_CREATE',
      resourceType: 'interaction',
      resourceId: interaction._id,
      metadata: { contactId: data.contactId, type: data.type },
      ip,
    });

    return interaction;
  }

  // Get interaction by ID
  async findById(id: string): Promise<IInteraction | null> {
    return Interaction.findOne({
      ...this.baseQuery,
      _id: id,
    });
  }

  // Get interaction by ID (throws if not found)
  async getById(id: string): Promise<IInteraction> {
    const interaction = await this.findById(id);
    if (!interaction) {
      throw errors.notFound('Interaction');
    }
    return interaction;
  }

  // List interactions with pagination and filtering
  async list(query: InteractionQuery): Promise<{
    interactions: IInteraction[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const { page, limit, contactId, type, startDate, endDate } = query;

    // Build filter
    const filter: Record<string, unknown> = {
      ...this.baseQuery,
    };

    if (contactId) {
      filter.contactId = contactId;
    }

    if (type) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.occurredAt = {};
      if (startDate) {
        (filter.occurredAt as Record<string, Date>).$gte = startDate;
      }
      if (endDate) {
        (filter.occurredAt as Record<string, Date>).$lte = endDate;
      }
    }

    // Query with pagination
    const skip = (page - 1) * limit;
    const [interactions, total] = await Promise.all([
      Interaction.find(filter).sort({ occurredAt: -1 }).skip(skip).limit(limit),
      Interaction.countDocuments(filter),
    ]);

    return {
      interactions,
      total,
      page,
      limit,
      hasMore: skip + interactions.length < total,
    };
  }

  // Get interactions for a specific contact
  async listByContact(
    contactId: string,
    page = 1,
    limit = 20
  ): Promise<{
    interactions: IInteraction[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    return this.list({ contactId, page, limit });
  }

  // Update interaction
  async update(id: string, data: InteractionUpdate, ip?: string): Promise<IInteraction> {
    const interaction = await Interaction.findOne({
      ...this.baseQuery,
      _id: id,
    });

    if (!interaction) {
      throw errors.notFound('Interaction');
    }

    // Update fields
    if (data.type !== undefined) interaction.type = data.type;
    if (data.occurredAt !== undefined) interaction.occurredAt = data.occurredAt;
    if (data.notes !== undefined) interaction.notes = data.notes;

    await interaction.save();

    // If occurredAt changed, might need to recalculate lastContactedAt on contact
    // For simplicity, we'll trigger a recalculation
    const latestInteraction = await Interaction.findOne({
      userId: this.userId,
      contactId: interaction.contactId,
    }).sort({ occurredAt: -1 });

    if (latestInteraction) {
      await Contact.updateOne(
        { _id: interaction.contactId, userId: this.userId },
        { $set: { lastContactedAt: latestInteraction.occurredAt } }
      );
    }

    // Audit log
    logAudit({
      userId: this.userId,
      action: 'INTERACTION_UPDATE',
      resourceType: 'interaction',
      resourceId: interaction._id,
      ip,
    });

    return interaction;
  }

  // Delete interaction
  async delete(id: string, ip?: string): Promise<void> {
    const interaction = await Interaction.findOne({
      ...this.baseQuery,
      _id: id,
    });

    if (!interaction) {
      throw errors.notFound('Interaction');
    }

    const contactId = interaction.contactId;
    await interaction.deleteOne();

    // Recalculate lastContactedAt and interactionCount on contact
    const [latestInteraction, count] = await Promise.all([
      Interaction.findOne({ userId: this.userId, contactId }).sort({ occurredAt: -1 }),
      Interaction.countDocuments({ userId: this.userId, contactId }),
    ]);

    await Contact.updateOne(
      { _id: contactId, userId: this.userId },
      {
        $set: {
          lastContactedAt: latestInteraction?.occurredAt ?? null,
          interactionCount: count,
        },
      }
    );

    // Audit log
    logAudit({
      userId: this.userId,
      action: 'INTERACTION_DELETE',
      resourceType: 'interaction',
      resourceId: interaction._id,
      ip,
    });
  }
}
