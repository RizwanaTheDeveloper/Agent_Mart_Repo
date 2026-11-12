import type { ComponentType, ReactNode } from 'react';
import type { AdminRole, CaseStatus, ModuleKey } from '../api/types';
import type { IconName, Tone } from '../components/ui';

export type RowView = {
  title: string;
  subtitle?: string;
  meta?: string;
  badges?: { label: string; tone?: Tone; icon?: IconName }[];
  icon?: IconName;
};

export type DetailField = { label: string; value: ReactNode; mono?: boolean; hidden?: boolean };

export type ActionDef<T> = {
  action: string;
  label: string;
  icon: IconName;
  variant?: 'primary' | 'secondary' | 'danger';
  description?: string;
  visible?: (item: T) => boolean;
  note?: 'required' | 'optional';
  noteLabel?: string;
  status?: { options: { value: CaseStatus; label: string }[]; initial: (item: T) => CaseStatus };
  role?: { options: { value: AdminRole; label: string }[]; initial: (item: T) => AdminRole };
  /** Server will ask for the password again (HTTP 428). Shown as a hint only. */
  sensitive?: boolean;
  successMessage: string;
};

export type ActionOutcome<T> = { item: T };

export type FormProps<T> = { visible: boolean; item: T | null; onClose: () => void; onSaved: (item: T) => void };
export type DetailExtraProps<T> = { item: T; canWrite: boolean; onChange: (item: T) => void };

export type ResourceConfig<T extends { id: string }> = {
  module: ModuleKey;
  noun: string;
  searchPlaceholder: string;
  emptyIcon?: IconName;
  row: (item: T) => RowView;
  detailTitle: (item: T) => string;
  fields: (item: T) => DetailField[];
  actions?: ActionDef<T>[];
  /** Normalises action responses (admins return { admin }). */
  unwrapAction?: (res: unknown) => ActionOutcome<T>;
  DetailExtra?: ComponentType<DetailExtraProps<T>>;
  Form?: ComponentType<FormProps<T>>;
  createLabel?: string;
  editable?: boolean;
  /** Replaces the default "New" button with a custom create flow (imports). */
  CreateFlow?: ComponentType<{ visible: boolean; onClose: () => void; onCreated: (item: T) => void; onUpdated: (item: T) => void }>;
};
