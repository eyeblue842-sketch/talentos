import clsx from 'clsx';

export function Card({ children, className }) {
  return (
    <div className={clsx('rounded-[24px] border border-[var(--line)] bg-white p-5 shadow-[0_12px_40px_rgba(16,36,24,0.06)]', className)}>
      {children}
    </div>
  );
}

