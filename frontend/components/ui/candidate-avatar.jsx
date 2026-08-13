function formatInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'C';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'C';
}

export function CandidateAvatar({
  src,
  name,
  alt,
  sizeClassName = 'h-24 w-24',
  className = '',
  fallbackLabel = 'Profile avatar fallback',
}) {
  return (
    <div className={`relative ${sizeClassName} overflow-hidden rounded-full border border-[var(--line)] bg-[var(--soft)] ${className}`.trim()}>
      {src ? (
        <img
          src={src}
          alt={alt || `${name || 'Candidate'} profile photo`}
          className="h-full w-full object-cover object-center"
        />
      ) : (
        <span
          aria-label={fallbackLabel}
          className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[var(--brand)]"
        >
          {formatInitials(name)}
        </span>
      )}
    </div>
  );
}
