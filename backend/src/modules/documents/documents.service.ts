import { Injectable, NotFoundException } from '@nestjs/common';
import { ListingDocument, Prisma } from '@prisma/client';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, toPage, uuidOrUndefined } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Response shape: id, firm_id, property_id, label, mime, size, created.
 * storageKey and file bytes are deliberately NEVER returned.
 */
export function mapDocument(d: ListingDocument) {
  return {
    id: d.id,
    firm_id: d.firmId,
    property_id: d.propertyId,
    label: d.label,
    mime: d.mime,
    size: d.sizeBytes,
    created: d.createdAt,
  };
}

// Explicit select so storage_key is never even loaded.
const documentSelect = {
  id: true,
  firmId: true,
  propertyId: true,
  label: true,
  mime: true,
  sizeBytes: true,
  createdAt: true,
} satisfies Prisma.ListingDocumentSelect;

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListQueryDto) {
    const id = uuidOrUndefined(q.q);
    const where: Prisma.ListingDocumentWhereInput = q.q
      ? { OR: [{ label: contains(q.q) }, { mime: contains(q.q) }, ...(id ? [{ id }, { firmId: id }, { propertyId: id }] : [])] }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.listingDocument.findMany({ where, select: documentSelect, orderBy: { createdAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.listingDocument.count({ where }),
    ]);
    return toPage(rows.map((r) => mapDocument(r as ListingDocument)), total, q);
  }

  async get(id: string) {
    const row = await this.prisma.listingDocument.findUnique({ where: { id }, select: documentSelect });
    if (!row) throw new NotFoundException('Document not found');
    return mapDocument(row as ListingDocument);
  }
}
