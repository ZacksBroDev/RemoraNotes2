import type mongoose from 'mongoose';
import { Contact, type IContact, Interaction } from '../models/index.js';
import { PLAN_LIMITS, type PlanTier, IMPORTANCE_DEFAULT } from '@remoranotes/shared';
import {
  errors,
  hashEmail,
  hashPhone,
  encrypt,
  decrypt,
  getCachedUserDEK,
} from '../utils/index.js';
import type { ContactCreate, ContactUpdate, ContactQuery } from '../schemas/contact.js';
import { logAudit } from './AuditService.js';

export class ContactService {
  private userId: mongoose.Types.ObjectId;
  private encryptedDEK: string;
  private plan: PlanTier;

  constructor(userId: mongoose.Types.ObjectId, encryptedDEK: string, plan: PlanTier) {
    this.userId = userId;
    this.encryptedDEK = encryptedDEK;
    this.plan = plan;
  }

  private get baseQuery() {
    return { userId: this.userId };
  }

  // Get DEK for encryption/decryption
  private async getDEK(): Promise<Buffer> {
    return getCachedUserDEK(this.userId.toString(), this.encryptedDEK);
  }

  // Encrypt sensitive fields
  private async encryptContact(
    data: ContactCreate | ContactUpdate,
    dek: Buffer
  ): Promise<Partial<IContact>> {
    const encrypted: Partial<IContact> = { ...data } as Partial<IContact>;

    if (data.email) {
      encrypted.email = encrypt(data.email, dek);
      encrypted.emailHash = hashEmail(data.email);
    }

    if (data.phone) {
      encrypted.phone = encrypt(data.phone, dek);
      encrypted.phoneHash = hashPhone(data.phone);
    }

    return encrypted;
  }

  // Decrypt sensitive fields
  private async decryptContact(contact: IContact, dek: Buffer): Promise<IContact> {
    const decrypted = contact.toObject() as IContact;

    if (contact.email) {
      try {
        decrypted.email = decrypt(contact.email, dek);
      } catch {
        decrypted.email = '[decryption failed]';
      }
    }

    if (contact.phone) {
      try {
        decrypted.phone = decrypt(contact.phone, dek);
      } catch {
        decrypted.phone = '[decryption failed]';
      }
    }

    return decrypted;
  }

  // Get contact count for plan limit check
  async getContactCount(): Promise<number> {
    return Contact.countDocuments({ ...this.baseQuery, isArchived: false });
  }

  // Check plan limits
  async checkPlanLimits(): Promise<void> {
    const count = await this.getContactCount();
    const limit = PLAN_LIMITS[this.plan].maxContacts;

    if (count >= limit) {
      throw errors.planLimitReached(`Maximum ${limit} contacts allowed on ${this.plan} plan`);
    }
  }

  // Create contact
  async create(data: ContactCreate, ip?: string): Promise<IContact> {
    await this.checkPlanLimits();

    const dek = await this.getDEK();
    const encrypted = await this.encryptContact(data, dek);

    // Check for duplicate by email hash
    if (encrypted.emailHash) {
      const existing = await Contact.findOne({
        ...this.baseQuery,
        emailHash: encrypted.emailHash,
      });

      if (existing) {
        throw errors.alreadyExists('Contact with this email');
      }
    }

    const contact = new Contact({
      ...encrypted,
      userId: this.userId,
      importance: data.importance ?? IMPORTANCE_DEFAULT,
      source: 'manual',
      hasGoogleLink: false,
      interactionCount: 0,
      isArchived: false,
    });

    await contact.save();

    // Audit log
    logAudit({
      userId: this.userId,
      action: 'CONTACT_CREATE',
      resourceType: 'contact',
      resourceId: contact._id,
      ip,
    });

    return this.decryptContact(contact, dek);
  }

  // Get contact by ID
  async findById(id: string): Promise<IContact | null> {
    const contact = await Contact.findOne({
      ...this.baseQuery,
      _id: id,
    });

    if (!contact) return null;

    const dek = await this.getDEK();
    return this.decryptContact(contact, dek);
  }

  // Get contact by ID (throws if not found)
  async getById(id: string): Promise<IContact> {
    const contact = await this.findById(id);
    if (!contact) {
      throw errors.notFound('Contact');
    }
    return contact;
  }

  // List contacts with pagination and filtering
  async list(query: ContactQuery): Promise<{
    contacts: IContact[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const { page, limit, search, tags, priority, source, archived, sortBy, sortOrder } = query;

    // Build filter
    const filter: Record<string, unknown> = {
      ...this.baseQuery,
      isArchived: archived,
    };

    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    if (priority) {
      filter.priority = priority;
    }

    if (source) {
      filter.source = source;
    }

    // Text search on name (not encrypted)
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    // Sort
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    // Query
    const skip = (page - 1) * limit;
    const [contacts, total] = await Promise.all([
      Contact.find(filter).sort(sort).skip(skip).limit(limit),
      Contact.countDocuments(filter),
    ]);

    // Decrypt contacts
    const dek = await this.getDEK();
    const decryptedContacts = await Promise.all(contacts.map((c) => this.decryptContact(c, dek)));

    return {
      contacts: decryptedContacts,
      total,
      page,
      limit,
      hasMore: skip + contacts.length < total,
    };
  }

  // Update contact
  async update(id: string, data: ContactUpdate, ip?: string): Promise<IContact> {
    const contact = await Contact.findOne({
      ...this.baseQuery,
      _id: id,
    });

    if (!contact) {
      throw errors.notFound('Contact');
    }

    const dek = await this.getDEK();
    const encrypted = await this.encryptContact(data, dek);

    // Check for email duplicate if email is being changed
    if (encrypted.emailHash && encrypted.emailHash !== contact.emailHash) {
      const existing = await Contact.findOne({
        ...this.baseQuery,
        emailHash: encrypted.emailHash,
        _id: { $ne: id },
      });

      if (existing) {
        throw errors.alreadyExists('Contact with this email');
      }
    }

    // Update fields
    Object.assign(contact, encrypted);
    await contact.save();

    // Audit log
    logAudit({
      userId: this.userId,
      action: 'CONTACT_UPDATE',
      resourceType: 'contact',
      resourceId: contact._id,
      ip,
    });

    return this.decryptContact(contact, dek);
  }

  // Delete contact
  async delete(id: string, ip?: string): Promise<void> {
    const contact = await Contact.findOne({
      ...this.baseQuery,
      _id: id,
    });

    if (!contact) {
      throw errors.notFound('Contact');
    }

    // Delete related interactions
    await Interaction.deleteMany({
      userId: this.userId,
      contactId: id,
    });

    // Delete contact
    await contact.deleteOne();

    // Audit log
    logAudit({
      userId: this.userId,
      action: 'CONTACT_DELETE',
      resourceType: 'contact',
      resourceId: contact._id,
      ip,
    });
  }

  // Archive/unarchive contact
  async setArchived(id: string, archived: boolean): Promise<IContact> {
    return this.update(id, { isArchived: archived });
  }

  // Update lastContactedAt when interaction is logged
  async updateLastContacted(contactId: string, date: Date = new Date()): Promise<void> {
    await Contact.updateOne(
      { ...this.baseQuery, _id: contactId },
      {
        $set: { lastContactedAt: date },
        $inc: { interactionCount: 1 },
      }
    );
  }
}
