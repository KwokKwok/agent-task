import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-1 text-sm text-[#2d2d2d] shadow-xs transition-colors placeholder:text-[#b4b4b4] outline-none focus:border-[#999] focus:ring-1 focus:ring-black/10 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});

export { Input };
