import { Badge } from './ui/badge.jsx';
import { TimeStamp } from './TimeStamp.jsx';
import { cn } from '../lib/utils';
import { getStatusLabel, getStatusMeta } from '../lib/helpers.js';
import { markdownToPlainTextPreview } from '../lib/markdown-preview.js';
import { Play } from 'lucide-react';

export function TaskCard({ task, isActive, onClick, now, panelOpen }) {
  const meta = getStatusMeta(task.status);
  const descriptionPreview = markdownToPlainTextPreview(task.description);
  return (
    <article
      className={cn(
        'task-card group rounded-xl p-4 transition-all duration-200',
        isActive && 'task-card-active',
        panelOpen && !isActive && 'opacity-45 saturate-[.78] hover:opacity-65',
        !panelOpen && !isActive && 'hover:-translate-y-0.5',
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <h3 className="mb-2 flex items-center gap-2 line-clamp-2 font-['Manrope',sans-serif] text-base font-semibold text-[var(--text-main)]">
        {task.title || '(无标题)'}
        {task.has_audio && (
          <span className="theme-accent-pill flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
            <Play className="h-3 w-3" />
            音频
          </span>
        )}
      </h3>
      <p className="mb-3 line-clamp-2 whitespace-pre-line text-xs text-[var(--text-soft)]">
        {descriptionPreview || '(无描述)'}
      </p>

      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
        <Badge tone={meta.tone}>{getStatusLabel(task.status)}</Badge>
        <span className="font-['Space_Grotesk',sans-serif]">{task.id}</span>
        <span className="ml-auto">
          <TimeStamp value={task.created_at} now={now} />
        </span>
      </div>
    </article>
  );
}
