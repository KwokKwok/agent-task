import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../../lib/utils';

export function Progress({ className, indicatorClassName, value = 0, ...props }) {
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
  return (
    <ProgressPrimitive.Root
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]', className)}
      value={normalized}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out', indicatorClassName)}
        style={{ width: `${normalized}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
