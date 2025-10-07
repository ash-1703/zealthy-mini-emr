'use client';
import { useEffect, useState } from 'react';

export function SubmitButton({
  children = 'Save changes',
  pendingText = 'Saving…',
  className = 'btn btn-brand',
}: {
  children?: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="submit"
      onClick={() => setPending(true)}
      disabled={pending}
      className={`${className} ${pending ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FlashBanner({
  message,
  tone = 'success',
  autoHideMs = 3500,
}: {
  message?: string;
  tone?: 'success' | 'error' | 'info';
  autoHideMs?: number;
}) {
  const [show, setShow] = useState(Boolean(message));
  useEffect(() => {
    if (!message) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), autoHideMs);
    return () => clearTimeout(id);
  }, [message, autoHideMs]);
  if (!show || !message) return null;
  const cls =
    tone === 'error'
      ? 'bg-red-50 text-red-800 border-red-200'
      : tone === 'info'
      ? 'bg-sky-50 text-sky-800 border-sky-200'
      : 'bg-emerald-50 text-emerald-800 border-emerald-200';
  return <div className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{message}</div>;
}

export function AccordionGroup({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const current = e.target as HTMLDetailsElement;
      if (current?.tagName !== 'DETAILS' || !current.hasAttribute('data-acc')) return;
      document.querySelectorAll<HTMLDetailsElement>('details[data-acc]').forEach((d) => {
        if (d !== current) d.open = false;
      });
    };
    document.addEventListener('toggle', handler, true);
    return () => document.removeEventListener('toggle', handler, true);
  }, []);
  return <div data-accordion-group>{children}</div>;
}

export function HideWhenEditing({ acc, children }: { acc: string; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const el = document.querySelector<HTMLDetailsElement>(`details[data-acc="${acc}"]`);
    if (!el) return;
    const onToggle = () => setEditing(el.open);
    el.addEventListener('toggle', onToggle);
    onToggle();
    return () => el.removeEventListener('toggle', onToggle);
  }, [acc]);
  if (editing) return null;
  return <>{children}</>;
}
