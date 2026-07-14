import { Card } from '@/components/ui/card';

export function StatCard({ label, value, helper }) {
  return (
    <Card className="bg-[var(--surface)] backdrop-blur">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-3 font-[var(--font-display)] text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">{helper}</p>
    </Card>
  );
}

