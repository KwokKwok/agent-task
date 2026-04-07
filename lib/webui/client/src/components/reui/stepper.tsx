import * as React from 'react';
import { cn } from '@/lib/utils';

type StepperIndicators = {
  completed?: React.ReactNode;
  loading?: React.ReactNode;
};

type StepperContextValue = {
  value: number;
  orientation: 'horizontal' | 'vertical';
  indicators: StepperIndicators;
};

type StepperItemState =
  | 'completed'
  | 'loading'
  | 'active'
  | 'inactive'
  | 'error';

type StepperItemContextValue = {
  step: number;
  state: StepperItemState;
};

const StepperContext = React.createContext<StepperContextValue | null>(null);
const StepperItemContext = React.createContext<StepperItemContextValue | null>(null);

function useStepperContext(component: string) {
  const context = React.useContext(StepperContext);
  if (!context) {
    throw new Error(`${component} must be used within <Stepper>.`);
  }
  return context;
}

function useStepperItemContext(component: string) {
  const context = React.useContext(StepperItemContext);
  if (!context) {
    throw new Error(`${component} must be used within <StepperItem>.`);
  }
  return context;
}

type StepperProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
  defaultValue?: number;
  orientation?: 'horizontal' | 'vertical';
  indicators?: StepperIndicators;
};

function resolveItemState(
  explicitState: StepperItemState | undefined,
  step: number,
  value: number,
): StepperItemState {
  if (explicitState) return explicitState;
  if (step < value) return 'completed';
  if (step === value) return 'active';
  return 'inactive';
}

function Stepper({
  className,
  value,
  defaultValue = 1,
  orientation = 'horizontal',
  indicators = {},
  ...props
}: StepperProps) {
  const resolvedValue = value ?? defaultValue;

  return (
    <StepperContext.Provider
      value={{
        value: resolvedValue,
        orientation,
        indicators,
      }}
    >
      <div
        data-slot="stepper"
        data-orientation={orientation}
        className={cn('group/stepper flex', className)}
        {...props}
      />
    </StepperContext.Provider>
  );
}

const StepperNav = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function StepperNav({ className, ...props }, ref) {
    const { orientation } = useStepperContext('StepperNav');
    return (
      <div
        ref={ref}
        data-slot="stepper-nav"
        data-orientation={orientation}
        className={cn(
          'group/stepper-nav flex',
          orientation === 'vertical' ? 'flex-col' : 'flex-row items-center',
          className,
        )}
        {...props}
      />
    );
  },
);

type StepperItemProps = React.HTMLAttributes<HTMLDivElement> & {
  step: number;
  state?: StepperItemState;
};

const StepperItem = React.forwardRef<HTMLDivElement, StepperItemProps>(function StepperItem(
  { className, step, state, ...props },
  ref,
) {
  const { orientation, value } = useStepperContext('StepperItem');
  const resolvedState = resolveItemState(state, step, value);

  return (
    <StepperItemContext.Provider value={{ step, state: resolvedState }}>
      <div
        ref={ref}
        data-slot="stepper-item"
        data-step={step}
        data-state={resolvedState}
        data-orientation={orientation}
        className={cn('group/step', className)}
        {...props}
      />
    </StepperItemContext.Provider>
  );
});

const StepperTrigger = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function StepperTrigger({ className, ...props }, ref) {
    const { state } = useStepperItemContext('StepperTrigger');
    return (
      <div
        ref={ref}
        data-slot="stepper-trigger"
        data-state={state}
        className={cn('flex', className)}
        {...props}
      />
    );
  },
);

const StepperIndicator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function StepperIndicator({ className, children, ...props }, ref) {
  const { indicators } = useStepperContext('StepperIndicator');
  const { state, step } = useStepperItemContext('StepperIndicator');

  const content = (() => {
    if (state === 'completed' && indicators.completed) return indicators.completed;
    if (state === 'loading' && indicators.loading) return indicators.loading;
    return children ?? step;
  })();

  return (
    <div
      ref={ref}
      data-slot="stepper-indicator"
      data-state={state}
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium transition-colors',
        className,
      )}
      {...props}
    >
      {content}
    </div>
  );
});

const StepperTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function StepperTitle({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="stepper-title"
        className={cn('font-medium', className)}
        {...props}
      />
    );
  },
);

const StepperSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function StepperSeparator({ className, ...props }, ref) {
  const { state } = useStepperItemContext('StepperSeparator');
  return (
    <div
      ref={ref}
      data-slot="stepper-separator"
      data-state={state}
      className={cn('bg-[var(--border-subtle)]', className)}
      {...props}
    />
  );
});

const StepperPanel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function StepperPanel({ className, ...props }, ref) {
    return <div ref={ref} data-slot="stepper-panel" className={cn(className)} {...props} />;
  },
);

type StepperContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: number;
};

const StepperContent = React.forwardRef<HTMLDivElement, StepperContentProps>(
  function StepperContent({ className, value, ...props }, ref) {
    const { value: currentValue } = useStepperContext('StepperContent');
    if (value !== currentValue) return null;
    return <div ref={ref} data-slot="stepper-content" className={cn(className)} {...props} />;
  },
);

export {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
};
