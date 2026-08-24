import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function relativeTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function percentage(marks: number, total: number): number {
  if (!total || total === 0) return 0;
  return Math.round((marks / total) * 100 * 100) / 100;
}

export function gradeFromPercentage(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

export function initials(name: string): string {
  return name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';
}

const PUBLIC_APP_URL = 'https://edlebridge-schoolman-cg21.bolt.host';

/**
 * Returns a stable, shareable app origin for invitation links.
 *
 * Bolt preview runs on internal hostnames like
 * `*.local-credentialless.webcontainer-api.io` that are not reachable
 * outside the preview iframe, so links generated from `window.location.origin`
 * break when opened in a real browser or email client. When the current origin
 * is one of those internal hosts, fall back to the public app URL instead.
 */
export function getAppOrigin(): string {
  if (typeof window === 'undefined') return PUBLIC_APP_URL;
  const origin = window.location.origin;
  if (
    origin.includes('webcontainer-api.io') ||
    origin.includes('webcontainer.io') ||
    origin.includes('.bolt.new') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  ) {
    return PUBLIC_APP_URL;
  }
  return origin;
}

import { supabase } from '@/lib/supabase';

export async function uploadFile(bucket: string, path: string, file: File): Promise<string | null> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
