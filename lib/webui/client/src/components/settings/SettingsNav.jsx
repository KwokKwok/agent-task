import { Bot, HardDrive, ListChecks, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { id: 'agent-intake-skill', label: 'Agent 接入', icon: Sparkles },
  { id: 'prompts', label: 'Agent 执行', icon: Bot },
  { id: 'task-types', label: '任务类型', icon: ListChecks },
  { id: 'storage', label: '存储', icon: HardDrive },
];

export function SettingsNav({ active, onChange, onClose }) {
  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-[var(--surface-soft)]">
      <div className="flex items-center px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-soft)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 pb-4">
        {ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                'flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13px] font-medium tracking-[0.014em] transition-all',
                isActive
                  ? 'bg-[var(--panel-bg-strong)] text-[var(--text-main)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-[var(--text-soft)] hover:bg-[color-mix(in_srgb,var(--panel-bg-strong)_60%,transparent)] hover:text-[var(--text-main)]',
              )}
            >
              <Icon className="h-[16px] w-[16px] shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
