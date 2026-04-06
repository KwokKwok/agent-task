import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn('inline-flex h-9 items-center gap-0.5 rounded-lg p-0.5', className)}
      {...props}
    />
  );
});

const TabsTrigger = React.forwardRef(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-semibold tracking-[0.04em] text-[var(--text-muted)] transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] hover:text-[var(--text-soft)] data-[state=active]:bg-[var(--accent-soft)] data-[state=active]:text-[var(--accent-text)]',
        className,
      )}
      {...props}
    />
  );
});

const TabsContent = React.forwardRef(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn('mt-4 outline-none', className)}
      {...props}
    />
  );
});

export { Tabs, TabsList, TabsTrigger, TabsContent };
