import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef(function AlertDialogOverlay({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      className={cn('fixed inset-0 z-50 bg-[rgba(26,32,44,0.14)] backdrop-blur-[2px]', className)}
      {...props}
    />
  );
});

const AlertDialogContent = React.forwardRef(function AlertDialogContent({ className, ...props }, ref) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(calc(100vw-2rem),420px)] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-[#e2e8f0] bg-[#fbfcfe] p-0 shadow-[0_18px_42px_rgba(15,23,42,0.10),0_2px_8px_rgba(15,23,42,0.04)]',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
});

function AlertDialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 px-5 pt-5', className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }) {
  return <div className={cn('flex items-center justify-end gap-2 border-t border-[#e2e8f0] px-5 py-4', className)} {...props} />;
}

const AlertDialogTitle = React.forwardRef(function AlertDialogTitle({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      className={cn('text-[1rem] font-medium text-[#1f2937]', className)}
      {...props}
    />
  );
});

const AlertDialogDescription = React.forwardRef(function AlertDialogDescription({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Description
      ref={ref}
      className={cn('text-[13px] leading-6 text-[#64748b]', className)}
      {...props}
    />
  );
});

const AlertDialogAction = React.forwardRef(function AlertDialogAction({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Action
      ref={ref}
      className={cn(
        buttonVariants({ variant: 'default' }),
        'h-9 rounded-full bg-[#1f2937] px-3.5 text-sm font-medium text-white shadow-none hover:bg-[#111827]',
        className,
      )}
      {...props}
    />
  );
});

const AlertDialogCancel = React.forwardRef(function AlertDialogCancel({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Cancel
      ref={ref}
      className={cn(
        buttonVariants({ variant: 'outline' }),
        'h-9 rounded-full border-[#d9e2ec] bg-white px-3.5 text-[#334155] shadow-none hover:bg-[#f2f6fb]',
        className,
      )}
      {...props}
    />
  );
});

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
