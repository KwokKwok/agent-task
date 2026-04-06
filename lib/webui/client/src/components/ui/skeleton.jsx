import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'theme-skeleton animate-pulse rounded-md',
        className,
      )}
      {...props}
    />
  );
}
