'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useI18n } from '@/i18n/provider';

/** Grove text field: white card, tiny uppercase label, 15px value. */
export function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required = true,
  autoComplete,
  defaultValue,
  minLength,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  minLength?: number;
  inputMode?: 'email' | 'text';
}) {
  return (
    <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
      <span className="microlabel text-bark">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        minLength={minLength}
        inputMode={inputMode}
        dir={type === 'email' || inputMode === 'email' ? 'ltr' : undefined}
        className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint rtl:text-right"
      />
    </label>
  );
}

export function PasswordField({
  label,
  name,
  autoComplete,
  minLength = 8,
  hint,
}: {
  label: string;
  name: string;
  autoComplete?: string;
  minLength?: number;
  hint?: string;
}) {
  const { dict } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <label className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-[18px] py-3.5 transition-all focus-within:border-forest focus-within:shadow-[0_0_0_3px_rgba(23,64,43,.08)]">
      <span className="microlabel text-bark">{label}</span>
      <span className="flex items-center gap-3">
        <input
          name={name}
          type={visible ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          minLength={minLength}
          placeholder={hint}
          dir="ltr"
          className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-faint rtl:text-right"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="shrink-0 text-[12px] font-semibold text-bark hover:text-forest"
          tabIndex={-1}
        >
          {visible ? dict.auth.hide : dict.auth.show}
        </button>
      </span>
    </label>
  );
}

/** Primary pill button that reflects the pending form state. */
export function SubmitButton({
  label,
  pendingLabel,
  tone = 'forest',
}: {
  label: string;
  pendingLabel: string;
  tone?: 'forest' | 'gold' | 'cream';
}) {
  const { pending } = useFormStatus();
  const toneCls =
    tone === 'gold'
      ? 'bg-gold text-[#1D1607]'
      : tone === 'cream'
        ? 'bg-cream text-forest'
        : 'bg-forest text-cream';
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full rounded-full py-4 text-center text-[16px] font-semibold transition active:scale-[0.985] disabled:opacity-70 ${toneCls}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function FormError({ code }: { code: string }) {
  const { dict } = useI18n();
  if (!code) return null;
  const message = dict.authErrors[code as keyof typeof dict.authErrors] ?? dict.common.error;
  return (
    <p className="animate-pop rounded-2xl bg-rust-tint px-4 py-3 text-[13px] font-medium text-rust-ink" role="alert">
      {message}
    </p>
  );
}

export function FormNote({ code, tone }: { code: string; tone: 'success' | 'error' }) {
  const { dict } = useI18n();
  if (!code) return null;
  const message = dict.authErrors[code as keyof typeof dict.authErrors] ?? dict.common.error;
  return (
    <p
      className={`animate-pop rounded-2xl px-4 py-3 text-[13px] font-medium ${
        tone === 'success' ? 'bg-moss text-forest' : 'bg-rust-tint text-rust-ink'
      }`}
      role="status"
    >
      {message}
    </p>
  );
}
