import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef(function TooltipContent(
  { className, sideOffset = 6, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
  ref: React.ElementRef<typeof TooltipPrimitive.Content>,
) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-md border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-xs text-[var(--tooltip-text)] shadow-[var(--tooltip-shadow)]',
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      >
        {props.children}
        <TooltipPrimitive.Arrow className="fill-[var(--tooltip-bg)]" width={11} height={5} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
