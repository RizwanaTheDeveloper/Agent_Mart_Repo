import { Injectable, NotFoundException } from '@nestjs/common';
import { ModerationStatus, Prisma } from '@prisma/client';
import { AdminContext } from '../../common/auth/admin-context';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, ensureAction, requireField, toPage, uuidOrUndefined } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const LISTING_ACTIONS = ['block', 'mark_reviewed', 'request_info'] as const;

const listingInclude = { firm: { select: { name: true } } } satisfies Prisma.ListingInclude;
type ListingRow = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

/** Response shape: id, title, firm_id, type, city, price, version, latitude, longitude, sellerPublished, moderation, updated */
export function mapListing(l: ListingRow) {
  return {
    id: l.id,
    title: l.title,
    firm_id: l.firmId,
    firm_name: l.firm?.name ?? null,
    type: l.type,
    city: l.city,
    price: Number(l.priceInr),
    version: l.version,
    latitude: l.latitude,
    longitude: l.longitude,
    sellerPublished: l.sellerPublished,
    moderation: l.moderation,
    moderation_note: l.moderationNote,
    created: l.createdAt,
    updated: l.updatedAt,
  };
}

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListQueryDto) {
    const id = uuidOrUndefined(q.q);
    const where: Prisma.ListingWhereInput = q.q
      ? { OR: [{ title: contains(q.q) }, { city: contains(q.q) }, { type: contains(q.q) }, ...(id ? [{ id }, { firmId: id }] : [])] }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({ where, include: listingInclude, orderBy: { updatedAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.listing.count({ where }),
    ]);
    return toPage(rows.map(mapListing), total, q);
  }

  async get(id: string) {
    const row = await this.prisma.listing.findUnique({ where: { id }, include: listingInclude });
    if (!row) throw new NotFoundException('Listing not found');
    return mapListing(row);
  }

  async act(id: string, dto: ActionDto, actor: AdminContext) {
    const action = ensureAction(dto.action, LISTING_ACTIONS);
    const next: Record<typeof action, ModerationStatus> = {
      block: 'blocked',
      mark_reviewed: 'reviewed',
      request_info: 'info_requested',
    };
    const note = action === 'request_info' ? requireField(dto.note, 'note') : undefined;

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.listing.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Listing not found');
      const after = await tx.listing.update({
        where: { id },
        data: {
          moderation: next[action],
          moderationNote: note ?? (action === 'mark_reviewed' ? null : before.moderationNote),
          reviewedAt: new Date(),
        },
        include: listingInclude,
      });
      await this.audit.record(tx, actor, {
        module: 'listings',
        action: `listings.${action}`,
        targetId: id,
        reason: dto.reason,
        metadata: { before: { moderation: before.moderation }, after: { moderation: after.moderation }, note: note ?? null },
      });
      return mapListing(after);
    });
  }
}
