import { Bot, Database, ListChecks, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { id: 'agent-onboarding', label: 'Agent 接入', icon: Sparkles },
  { id: 'prompts', label: 'Agent 执行', icon: Bot },
  { id: 'task-types', label: '任务类型', icon: ListChecks },
];

export function SettingsNav({ active, onChange, onClose, config }) {
  return (
    <aside className="settings-sidebar flex h-full w-[220px] shrink-0 flex-col">
      <div className="flex items-center px-2.5 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="settings-icon-button inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2.5 pb-4">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                'settings-tab flex h-11 w-full items-center gap-3 rounded-[8px] px-3.5 text-left text-[14px] font-normal transition-colors',
                isActive
                  ? 'settings-tab-active'
                  : 'hover:bg-[color-mix(in_srgb,var(--surface-soft)_92%,transparent)]',
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {config?.dataRoot ? (
        <div className="px-3.5 py-3">
          <div className="settings-muted mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide">
            <Database className="h-3 w-3" />
            数据目录
          </div>
          <div className="settings-card-soft break-all rounded-lg px-2 py-1.5 font-mono text-[10px] leading-[1.5]">
            {config.dataRoot}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
