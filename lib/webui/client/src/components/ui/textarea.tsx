import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[96px] w-full rounded-[12px] border border-[#d9e2ec] bg-white px-3.5 py-2.5 text-sm leading-7 text-[#1f2937] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#bfd0e2] focus:ring-4 focus:ring-[#eaf1f8] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});

export { Textarea };
