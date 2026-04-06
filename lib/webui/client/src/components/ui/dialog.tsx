import * as React from 'react';
import { X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn('fixed inset-0 z-50 bg-[var(--overlay-strong)]/70 backdrop-blur-[3px]', className)}
      {...props}
    />
  );
});

function isToastInteraction(target) {
  return target instanceof Element
    && Boolean(target.closest('[data-sonner-toaster], [data-sonner-toast]'));
}

const DialogContent = React.forwardRef(function DialogContent(
  {
    className,
    children,
    onInteractOutside,
    onPointerDownOutside,
    ...props
  },
  ref,
) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[min(90vh,840px)] min-h-0 w-[min(calc(100vw-3rem),1040px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[16px] border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--panel-bg-strong)_94%,transparent)] shadow-[var(--panel-shadow)]',
          className,
        )}
        onInteractOutside={(event) => {
          if (isToastInteraction(event.target)) {
            event.preventDefault();
            return;
          }
          onInteractOutside?.(event);
        }}
        onPointerDownOutside={(event) => {
          if (isToastInteraction(event.target)) {
            event.preventDefault();
            return;
          }
          onPointerDownOutside?.(event);
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

function DialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1.5 px-6 py-5', className)} {...props} />;
}

function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg font-semibold leading-none tracking-tight text-[var(--text-main)]', className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-[var(--text-soft)]', className)}
      {...props}
    />
  );
}

function DialogBody({ className, ...props }) {
  return <div className={cn('flex min-h-0 flex-1 flex-col overflow-auto', className)} {...props} />;
}

function DialogIconClose({ className, ...props }) {
  return (
    <DialogClose
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        className,
      )}
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </DialogClose>
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogIconClose,
  DialogTitle,
  DialogTrigger,
};
