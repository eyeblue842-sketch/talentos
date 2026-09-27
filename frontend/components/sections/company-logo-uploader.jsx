'use client';

import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';

function getInitials(value) {
  return String(value || 'Careeriz')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

/**
 * Company logo box. For OWNER/ADMIN (`canEdit`) it becomes an upload control:
 * clicking it opens a file picker, posts to the same-origin /api/organisations
 * /logo proxy (which forwards to the backend with the session), then refreshes
 * so the new logo (served via /api/organisations/:id/logo) shows immediately.
 */
export function CompanyLogoUploader({ organisation, canEdit = false }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const inner = organisation?.logoUrl ? (
    <img src={organisation.logoUrl} alt={`${organisation?.name || 'Company'} logo`} className="h-full w-full object-cover object-center" />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[var(--color-primary)]">{getInitials(organisation?.name)}</span>
  );

  if (!canEdit) {
    return <div className="h-20 w-20 overflow-hidden rounded-2xl border border-white/35 bg-white shadow-sm">{inner}</div>;
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('logo', file);
      const response = await fetch('/api/organisations/logo', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Could not upload the logo.');
      }
      if (typeof window !== 'undefined') window.location.reload();
    } catch (uploadError) {
      setError(uploadError.message || 'Could not upload the logo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Upload company logo"
        title="Upload company logo"
        className="group relative h-20 w-20 overflow-hidden rounded-2xl border border-white/35 bg-white shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:rgba(79,156,249,0.35)]"
      >
        {inner}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Camera size={16} aria-hidden="true" />
          {uploading ? 'Uploading…' : 'Change'}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFile}
      />
      {error ? <p className="max-w-[9rem] text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
