import React from 'react';
import { MIN_REASON_LENGTH } from '../config';
import { Field } from './ui';

export const reasonValid = (r: string) => r.trim().length >= MIN_REASON_LENGTH;
export const REASON_ERROR = `Give a reason of at least ${MIN_REASON_LENGTH} characters. It is stored in the audit log.`;

export function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field
      label="Reason for audit log"
      value={value}
      onChangeText={onChange}
      multiline
      maxLength={500}
      placeholder="Why are you making this change?"
      hint={`At least ${MIN_REASON_LENGTH} characters. Recorded with your name and the time.`}
    />
  );
}
