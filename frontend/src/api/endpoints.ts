import { get, post, request } from './client';
import type {
  AdminMutationResult,
  Announcement,
  Audience,
  AdminRole,
  ElevationResponse,
  ImportBatch,
  ImportCommitResult,
  LoginResponse,
  MeResponse,
  Overview,
  Page,
  Plan,
  PlatformSettings,
  Report,
  Subscription,
} from './types';

const P = '/platform';

export type ListParams = { q?: string; offset?: number; limit?: number };
export type ActionBody = { action: string; reason: string; note?: string; status?: string; role?: string };

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>(`${P}/auth/login`, { method: 'POST', body: { email, password }, noElevation: true }),
    me: () => get<MeResponse>(`${P}/auth/me`),
    elevate: (password: string) =>
      request<ElevationResponse>(`${P}/auth/elevate`, { method: 'POST', body: { password }, noElevation: true }),
    logout: () => post<{ ok: true }>(`${P}/auth/logout`),
  },

  list: <T>(module: string, params: ListParams, signal?: AbortSignal) => get<Page<T>>(`${P}/${module}`, params, signal),
  detail: <T>(module: string, id: string) => get<T>(`${P}/${module}/${encodeURIComponent(id)}`),
  action: <T>(module: string, id: string, body: ActionBody) =>
    post<T>(`${P}/${module}/${encodeURIComponent(id)}/action`, body),

  overview: () => get<Overview>(`${P}/overview`),
  reports: (days: number) => get<Report>(`${P}/reports`, { days }),
  reportsCsv: (days: number) => request<string>(`${P}/reports`, { query: { days, format: 'csv' }, text: true }),

  savePlan: (body: { id?: string; name: string; max_staff: number; max_listings: number; price_inr: number; active: boolean; reason: string }) =>
    post<Plan>(`${P}/plans/save`, body),
  assignPlan: (firm_id: string, plan_id: string, reason: string) =>
    post<Subscription>(`${P}/subscriptions/assign`, { firm_id, plan_id, reason }),
  saveAnnouncement: (body: { id?: string; title: string; body: string; audience: Audience; active: boolean; reason: string }) =>
    post<Announcement>(`${P}/announcements/save`, body),

  settings: () => get<PlatformSettings>(`${P}/settings`),
  saveSettings: (body: Partial<Record<'publication_enabled' | 'registration_enabled' | 'ai_generation_enabled', boolean>> & { reason: string }) =>
    post<PlatformSettings>(`${P}/settings`, body),

  saveAdmin: (body: { id?: string; name: string; email?: string; role: AdminRole; password?: string; reason: string }) =>
    post<AdminMutationResult>(`${P}/admins/save`, body),

  previewImport: (filename: string, features: unknown[]) =>
    post<ImportBatch>(`${P}/imports/preview`, { filename, features }),
  commitImport: (id: string, reason: string) => post<ImportCommitResult>(`${P}/imports/${encodeURIComponent(id)}/commit`, { reason }),
};
