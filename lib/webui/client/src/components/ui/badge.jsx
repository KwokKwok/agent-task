import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
  {
    variants: {
      tone: {
        default: 'border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--text-soft)]',
        active: 'border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[var(--status-active-text)]',
        done: 'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  },
);

export function Badge({ className, tone, ...props }) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
