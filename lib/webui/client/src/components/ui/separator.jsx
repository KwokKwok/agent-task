import * as React from 'react';
import { cn } from '../../lib/utils';

export const Separator = React.forwardRef(function Separator(
  { className, orientation = 'horizontal', ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'shrink-0 bg-[var(--border-subtle)]',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
});
