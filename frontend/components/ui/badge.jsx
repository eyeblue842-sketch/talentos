import clsx from 'clsx';

const styles = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  neutral: 'bg-slate-100 text-slate-700',
  danger: 'bg-rose-100 text-rose-700',
  brand: 'bg-green-100 text-green-700',
};

export function Badge({ children, tone = 'neutral' }) {
  return (
    <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-semibold', styles[tone])}>
      {children}
    </span>
  );
}

