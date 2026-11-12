import { ConflictException, Injectable, NotFoundException, PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImportBatch, Prisma } from '@prisma/client';
import { AdminContext } from '../../common/auth/admin-context';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { sha256 } from '../../common/security/tokens';
import { contains, toPage, uuidOrUndefined } from '../../common/utils/query.utils';
import { EnvVars } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ImportPreviewDto } from './dto/import.dto';
import { ParcelRow, RowError, validateFeatures } from './parcel-validator';

const MAX_PAYLOAD_BYTES = 750 * 1024;

export function mapImport(b: ImportBatch, withRows = false) {
  return {
    id: b.id,
    filename: b.filename,
    status: b.status,
    features: b.featureCount,
    valid: b.validCount,
    invalid: b.errorCount,
    created: b.createdAt,
    committed: b.committedAt,
    ...(withRows ? { errors: b.errors as unknown as RowError[], rows: b.rows as unknown as ParcelRow[] } : {}),
  };
}

@Injectable()
export class ImportsService {
  private readonly plotCodeRegex: RegExp;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService<EnvVars, true>,
  ) {
    this.plotCodeRegex = new RegExp(config.get('PLOT_CODE_REGEX', { infer: true }));
  }

  async list(q: ListQueryDto) {
    const id = uuidOrUndefined(q.q);
    const where: Prisma.ImportBatchWhereInput = q.q ? { OR: [{ filename: contains(q.q) }, ...(id ? [{ id }] : [])] } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.importBatch.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.importBatch.count({ where }),
    ]);
    return toPage(rows.map((r) => mapImport(r)), total, q);
  }

  async get(id: string) {
    const row = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Import not found');
    return mapImport(row, true);
  }

  /** Stage + validate. Nothing is written to parcel_references until commit. */
  async preview(dto: ImportPreviewDto, actor: AdminContext) {
    const payload = JSON.stringify(dto.features);
    if (Buffer.byteLength(payload) > MAX_PAYLOAD_BYTES) throw new PayloadTooLargeException('Import payload must be under 750 KB');

    const { rows, errors } = validateFeatures(dto.features, this.plotCodeRegex);
    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.importBatch.create({
        data: {
          filename: dto.filename ?? null,
          status: errors.length ? 'failed' : 'validated',
          featureCount: dto.features.length,
          validCount: rows.length,
          errorCount: dto.features.length - rows.length,
          errors: errors as unknown as Prisma.InputJsonValue,
          rows: rows as unknown as Prisma.InputJsonValue,
          payloadSha256: sha256(payload),
          createdById: actor.id,
        },
      });
      await this.audit.record(tx, actor, {
        module: 'imports',
        action: 'imports.preview',
        targetId: created.id,
        metadata: { features: created.featureCount, valid: created.validCount, invalid: created.errorCount },
      });
      return created;
    });
    return mapImport(batch, true);
  }

  /**
   * Idempotent commit: the status flip validated -> committed is a conditional update inside the
   * same transaction as the upserts, so a repeat or concurrent commit gets 409 and writes nothing.
   */
  async commit(id: string, reason: string, actor: AdminContext) {
    return this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const flipped = await tx.importBatch.updateMany({
          where: { id, status: 'validated' },
          data: { status: 'committed', committedAt: now, committedById: actor.id },
        });
        if (flipped.count === 0) {
          const existing = await tx.importBatch.findUnique({ where: { id } });
          if (!existing) throw new NotFoundException('Import not found');
          if (existing.status === 'committed') throw new ConflictException('Import has already been committed');
          throw new UnprocessableEntityException('Import has validation errors and cannot be committed');
        }
        const batch = await tx.importBatch.findUniqueOrThrow({ where: { id } });
        const rows = batch.rows as unknown as ParcelRow[];

        let created = 0;
        let updated = 0;
        for (const r of rows) {
          const data = {
            plotNo: r.plot_no,
            luDesc: r.lu_desc,
            extnSqyrd: r.extn_sqyrd,
            areaSqm: r.area_sqm,
            rdWidthM: r.rd_width_m,
            district: r.district,
            mandal: r.mandal,
            village: r.village,
            rsNo: r.rs_no,
            zoning: r.zoning,
            latitude: r.latitude,
            longitude: r.longitude,
            importBatchId: id,
          };
          const exists = await tx.parcelReference.findUnique({ where: { plotCode: r.plot_code }, select: { id: true } });
          await tx.parcelReference.upsert({ where: { plotCode: r.plot_code }, create: { plotCode: r.plot_code, ...data }, update: data });
          if (exists) updated++;
          else created++;
        }

        await this.audit.record(tx, actor, {
          module: 'imports',
          action: 'imports.commit',
          targetId: id,
          reason,
          metadata: { created, updated },
        });
        return { id, status: 'committed' as const, created, updated, committed: now };
      },
      { timeout: 30_000 },
    );
  }
}
