import {
  Check,
  Dot,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogIconClose,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/reui/stepper';

function getStepAppearance(status) {
  if (status === 'completed') {
    return {
      nodeClass:
        'border-transparent bg-[var(--text-main)] text-[var(--panel-bg-strong)] shadow-[0_8px_18px_rgba(15,23,42,0.12)]',
      lineClass:
        'bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--text-main)_18%,transparent),color-mix(in_srgb,var(--border-subtle)_58%,transparent))]',
      badgeTone: 'done',
      badgeClass: 'border-transparent shadow-none',
      titleClass: 'text-[var(--text-main)]',
      descriptionClass: 'text-[var(--text-soft)]',
    };
  }

  if (status === 'running') {
    return {
      nodeClass:
        'border-transparent bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel-bg-strong))] text-[var(--accent)] shadow-[0_10px_24px_color-mix(in_srgb,var(--accent)_10%,transparent)]',
      lineClass:
        'bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--accent)_26%,transparent),color-mix(in_srgb,var(--border-subtle)_58%,transparent))]',
      badgeTone: 'active',
      badgeClass: 'border-transparent shadow-none',
      titleClass: 'text-[var(--text-main)]',
      descriptionClass: 'text-[var(--text-soft)]',
    };
  }

  if (status === 'error') {
    return {
      nodeClass:
        'border-transparent bg-[color-mix(in_srgb,var(--danger-strong)_12%,var(--panel-bg-strong))] text-[var(--danger-strong)] shadow-[0_10px_24px_color-mix(in_srgb,var(--danger-strong)_8%,transparent)]',
      lineClass:
        'bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--danger-strong)_24%,transparent),color-mix(in_srgb,var(--border-subtle)_58%,transparent))]',
      badgeTone: 'default',
      badgeClass:
        'border-transparent bg-[color-mix(in_srgb,var(--danger-strong)_10%,transparent)] text-[var(--danger-strong)] shadow-none',
      titleClass: 'text-[var(--text-main)]',
      descriptionClass: 'text-[var(--danger-strong)]',
    };
  }

  return {
    nodeClass:
      'border-transparent bg-[color-mix(in_srgb,var(--text-main)_4%,var(--panel-bg-strong))] text-[var(--text-muted)] shadow-none',
    lineClass:
      'bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--border-subtle)_72%,transparent),color-mix(in_srgb,var(--border-subtle)_45%,transparent))]',
    badgeTone: 'default',
    badgeClass: 'border-transparent shadow-none',
    titleClass: 'text-[var(--text-soft)]',
    descriptionClass: 'text-[var(--text-muted)]',
  };
}

function getStepStatusLabel(status, waitingForAction = false) {
  if (status === 'completed') return '已完成';
  if (status === 'running') return '进行中';
  if (status === 'error') return '异常';
  if (waitingForAction) return '待确认';
  return '未开始';
}

function getStepperItemState(status) {
  if (status === 'completed') return 'completed';
  if (status === 'running') return 'loading';
  if (status === 'error') return 'error';
  return 'inactive';
}

function resolveCurrentStepValue(steps) {
  const index = steps.findIndex(
    step =>
      step.status === 'running' ||
      step.status === 'error' ||
      step.waitingForAction,
  );
  if (index >= 0) return index + 1;
  return steps.length;
}

function formatRawResponse(response) {
  if (!response) return '';
  return String(response.stdout || '').trim();
}

function formatStepDetail(detail) {
  if (!detail) return '';
  if (typeof detail === 'string') return detail.trim();

  const parts = [];

  if (detail.message) {
    parts.push(String(detail.message).trim());
  }

  const stdout = String(detail.stdout || '').trim();
  const stderr = String(detail.stderr || '').trim();

  if (stdout) {
    parts.push(stdout);
  }

  if (stderr) {
    parts.push(stderr);
  }

  if (detail.details) {
    if (typeof detail.details === 'string') {
      parts.push(detail.details.trim());
    } else {
      try {
        parts.push(JSON.stringify(detail.details, null, 2));
      } catch {
        parts.push(String(detail.details));
      }
    }
  }

  if (parts.length) {
    return parts.filter(Boolean).join('\n\n');
  }

  return formatRawResponse(detail);
}

function DetailTooltip({ children, detail }) {
  const content = formatStepDetail(detail);
  if (!content) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={10}
        className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-['IBM_Plex_Mono',monospace] text-[11px] leading-5"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

function StepStatusBadge({ status, detail, waitingForAction = false }) {
  const appearance = getStepAppearance(status);
  const label = getStepStatusLabel(status, waitingForAction);
  const badge = (
    <Badge
      tone={appearance.badgeTone}
      className={`shrink-0 self-start rounded-full px-2.5 py-1 text-[10px] ${appearance.badgeClass}`}
    >
      {label}
    </Badge>
  );

  if (status !== 'completed' && status !== 'error') {
    return badge;
  }

  return <DetailTooltip detail={detail}>{badge}</DetailTooltip>;
}

function StepTimeline({ steps }) {
  const currentValue = resolveCurrentStepValue(steps);

  return (
    <Stepper
      value={currentValue}
      orientation="vertical"
      indicators={{
        completed: <Check className="h-5 w-5" strokeWidth={2.4} />,
        loading: <RefreshCw className="h-4.5 w-4.5 animate-spin" strokeWidth={2.2} />,
      }}
      className="flex w-full flex-col"
    >
      <StepperNav className="gap-0">
        {steps.map((step, index) => {
          const appearance = getStepAppearance(step.status);
          const itemState = getStepperItemState(step.status);

          return (
            <StepperItem
              key={step.id}
              step={index + 1}
              state={itemState}
              className="relative items-start"
            >
              <StepperTrigger className="items-start gap-4.5 pb-6 last:pb-0">
                <StepperIndicator
                  className={`relative z-10 mt-0.5 size-9 border transition-all duration-300 ${appearance.nodeClass}`}
                >
                  {itemState === 'error' ? (
                    <X
                      className="h-4 w-4 text-[var(--danger-strong)]"
                      strokeWidth={2.4}
                    />
                  ) : itemState === 'inactive' ? (
                    <Dot
                      className="h-5 w-5 text-[var(--text-muted)]"
                      strokeWidth={2.4}
                    />
                  ) : null}
                </StepperIndicator>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <StepperTitle
                        className={`pt-0.5 text-[15px] font-semibold tracking-[-0.012em] ${appearance.titleClass}`}
                      >
                        {step.title}
                      </StepperTitle>
                      <div
                        className={`mt-1.5 pr-3 text-[13px] leading-6 ${appearance.descriptionClass}`}
                      >
                        {step.description}
                      </div>
                    </div>
                    <StepStatusBadge
                      status={step.status}
                      detail={step.detail}
                      waitingForAction={step.waitingForAction}
                    />
                  </div>
                </div>
              </StepperTrigger>
              {index < steps.length - 1 ? (
                <StepperSeparator
                  className={`absolute bottom-0 left-[18px] top-9 -z-10 m-0 w-px ${appearance.lineClass}`}
                />
              ) : null}
            </StepperItem>
          );
        })}
      </StepperNav>
    </Stepper>
  );
}

export function AsyncStepsDialog({
  open,
  canClose,
  onClose,
  title,
  description,
  steps,
  completedContent = null,
  footerLeft = null,
  footerRight = null,
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Dialog
        open={open}
        onOpenChange={nextOpen => {
          if (!nextOpen && canClose) onClose();
        }}
      >
        <DialogContent
          className="w-[min(calc(100vw-2rem),560px)] overflow-hidden p-0"
          onInteractOutside={event => {
            if (!canClose) event.preventDefault();
          }}
          onPointerDownOutside={event => {
            if (!canClose) event.preventDefault();
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(111,132,255,0.16),transparent_62%)]" />

          <DialogHeader className="relative px-8 pb-6 pt-9 pr-14 text-center">
            <DialogTitle className="text-[1.22rem] font-medium tracking-[-0.015em]">
              {title}
            </DialogTitle>
            <DialogDescription className="mx-auto max-w-[28rem] text-[13px] leading-6 text-[var(--text-soft)]">
              {description}
            </DialogDescription>
          </DialogHeader>

          {canClose ? (
            <DialogIconClose className="absolute right-4 top-4" />
          ) : null}

          <div className="space-y-4 px-8 py-6">
            <StepTimeline steps={steps} />
            {completedContent}
          </div>

          <div className="flex items-center justify-between gap-4 pl-7 pr-5 py-4">
            {footerLeft ?? <div />}
            {footerRight ?? <div />}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
