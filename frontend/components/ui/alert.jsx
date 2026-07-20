import { forwardRef } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const toneConfig = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  warning: {
    icon: TriangleAlert,
    className: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  danger: {
    icon: AlertCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-800',
  },
  info: {
    icon: Info,
    className: 'border-blue-200 bg-blue-50 text-blue-800',
  },
};

export const Alert = forwardRef(function Alert({ tone = 'info', title, children, className, ...props }, ref) {
  const config = toneConfig[tone];
  const Icon = config.icon;

  return (
    <div ref={ref} className={cn('flex gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-sm', config.className, className)} role="alert" {...props}>
      <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="grid gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
});
