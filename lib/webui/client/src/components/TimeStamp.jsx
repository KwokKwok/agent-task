import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';
import { cn, formatDateTime, formatRelativeTime } from '../lib/utils';

export function TimeStamp({ value, now, className }) {
  if (!value) return <span className={className}>--</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('cursor-help', className)}>
          {formatRelativeTime(value, now)}
        </span>
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(value)}</TooltipContent>
    </Tooltip>
  );
}
