import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, Prisma } from '@prisma/client';
import { AdminContext } from '../../common/auth/admin-context';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, ensureAction, requireField, toPage, uuidOrUndefined } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const CASE_ACTIONS = ['set_status', 'add_note'] as const;

const caseInclude = { property: { select: { title: true } } } satisfies Prisma.ReportCaseInclude;
type CaseRow = Prisma.ReportCaseGetPayload<{ include: typeof caseInclude }>;

/** Response shape: id, property_id, category, description, report, status, staff_note, created, updated */
export function mapCase(c: CaseRow) {
  return {
    id: c.id,
    property_id: c.propertyId,
    property_title: c.property.title,
    reporter_id: c.reporterId,
    category: c.category,
    description: c.description,
    report: c.report,
    status: c.status,
    staff_note: c.staffNote,
    created: c.createdAt,
    updated: c.updatedAt,
  };
}

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListQueryDto) {
    const id = uuidOrUndefined(q.q);
    const statusMatch = Object.values(CaseStatus).find((s) => s === q.q);
    const where: Prisma.ReportCaseWhereInput = q.q
      ? {
          OR: [
            { category: contains(q.q) },
            { description: contains(q.q) },
            ...(statusMatch ? [{ status: statusMatch }] : []),
            ...(id ? [{ id }, { propertyId: id }] : []),
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.reportCase.findMany({ where, include: caseInclude, orderBy: { createdAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.reportCase.count({ where }),
    ]);
    return toPage(rows.map(mapCase), total, q);
  }

  async get(id: string) {
    const row = await this.prisma.reportCase.findUnique({ where: { id }, include: caseInclude });
    if (!row) throw new NotFoundException('Case not found');
    return mapCase(row);
  }

  async act(id: string, dto: ActionDto, actor: AdminContext) {
    const action = ensureAction(dto.action, CASE_ACTIONS);
    let status: CaseStatus | undefined;
    if (action === 'set_status') {
      const s = requireField(dto.status, 'status');
      if (!Object.values(CaseStatus).includes(s as CaseStatus)) {
        throw new BadRequestException(`status must be one of: ${Object.values(CaseStatus).join(', ')}`);
      }
      status = s as CaseStatus;
    }
    const note = action === 'add_note' ? requireField(dto.note, 'note').trim() : undefined;

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.reportCase.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Case not found');
      // Internal notes are appended (never overwritten) so history is preserved.
      const staffNote = note
        ? [before.staffNote, `[${new Date().toISOString()} ${actor.email}] ${note}`].filter(Boolean).join('\n')
        : undefined;
      const after = await tx.reportCase.update({ where: { id }, data: { status, staffNote }, include: caseInclude });
      await this.audit.record(tx, actor, {
        module: 'cases',
        action: `cases.${action}`,
        targetId: id,
        reason: dto.reason,
        metadata: { before: { status: before.status }, after: { status: after.status } },
      });
      return mapCase(after);
    });
  }
}
