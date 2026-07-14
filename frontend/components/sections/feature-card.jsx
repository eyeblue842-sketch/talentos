export function FeatureCard({ icon: Icon, title, items }) {
  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-5">
      <Icon className="text-[var(--brand)]" />
      <h3 className="mt-4 font-[var(--font-display)] text-xl font-semibold">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 h-2 w-2 rounded-full bg-[var(--accent)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

