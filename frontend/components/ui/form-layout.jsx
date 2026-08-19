import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, PasswordField } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function FormSection({ id, title, description, className, children }) {
  return (
    <section id={id} className={cn('grid gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-sm)]', className)}>
      {(title || description) ? (
        <div>
          {title ? <h2 className="text-xl font-semibold text-[var(--color-text)]">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FormActions({ children, className }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {children}
    </div>
  );
}

export function InlineValidationMessage({ children, tone = 'danger' }) {
  return (
    <p className={cn('text-sm', tone === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]')}>
      {children}
    </p>
  );
}

export function SearchInput(props) {
  return <Input leadingIcon={Search} {...props} />;
}

export function VerificationCodeInput({ length = 6, name = 'verificationCode' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length }, (_, index) => (
        <Input
          key={index}
          name={name}
          aria-label={`Verification code digit ${index + 1}`}
          maxLength={1}
          inputMode="numeric"
          pattern="[0-9]*"
          className="w-12"
        />
      ))}
    </div>
  );
}

export { PasswordField, Button };
