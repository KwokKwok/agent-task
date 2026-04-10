import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { PromptEditorPane } from './settings/PromptEditorPane';
import { SettingsNav } from './settings/SettingsNav';
import { TaskTypesSettingsPane } from './settings/TaskTypesSettingsPane';
import { AgentOnboardingPane } from './settings/AgentOnboardingPane';

async function fetchJson(path, options) {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function buildConfigPayload(config) {
  return {
    host: config.host,
    port: config.port,
    publicUrl: config.publicUrl,
    general: config.general,
    executionGuidance: config.executionGuidance,
    chatGuidance: config.chatGuidance,
  };
}

function SettingsLoadingSkeleton() {
  return (
    <div className="settings-pane flex min-h-0 flex-1 flex-row overflow-hidden rounded-[16px]">
      <aside className="settings-sidebar flex h-full w-[220px] shrink-0 flex-col px-3 py-4">
        <Skeleton className="mb-6 h-9 w-9 rounded-full" />
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map(item => (
            <Skeleton key={item} className="h-11 w-full rounded-[10px]" />
          ))}
        </div>
      </aside>
      <div className="settings-pane min-h-0 flex-1 space-y-6 px-10 py-9">
        <Skeleton className="h-8 w-20 rounded-xl" />
        <div className="space-y-5">
          {[0, 1, 2, 3].map(item => (
            <div key={item} className="space-y-2">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-11 w-full rounded-[10px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function mergeConfigPatch(current, patch) {
  return {
    ...current,
    ...patch,
    general: patch.general
      ? {
          ...current.general,
          ...patch.general,
          openclawDefaults: {
            ...(current.general?.openclawDefaults || {}),
            ...(patch.general.openclawDefaults || {}),
          },
        }
      : current.general,
    executionGuidance: patch.executionGuidance
      ? {
          ...current.executionGuidance,
          ...patch.executionGuidance,
          common: patch.executionGuidance.common
            ? {
                ...(current.executionGuidance?.common || {}),
                ...patch.executionGuidance.common,
              }
            : current.executionGuidance?.common,
          strategies:
            patch.executionGuidance.strategies ??
            current.executionGuidance?.strategies,
        }
      : current.executionGuidance,
    chatGuidance: patch.chatGuidance
      ? {
          ...(current.chatGuidance || {}),
          ...patch.chatGuidance,
        }
      : current.chatGuidance,
  };
}

export function SettingsModal({ onClose }) {
  const [activePane, setActivePane] = useState('agent-intake-skill');
  const [config, setConfig] = useState({
    host: '',
    port: 3333,
    publicUrl: '',
    dataRoot: '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const cfg = await fetchJson('/api/config');
        setConfig(cfg);
      } catch (err) {
        setError(err.message || '设置加载失败');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function saveConfig(patch, options = {}) {
    const {
      successMessage = '配置已更新',
      successDescription,
      errorMessage = '保存失败',
    } = options;
    setSaving(true);
    setError('');
    try {
      const payload = patch || buildConfigPayload(config);
      const updated = await fetchJson('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setConfig(updated);
      toast.success(successMessage, {
        description: successDescription,
      });
      return updated;
    } catch (err) {
      const message = err.message || errorMessage;
      setError(message);
      toast.error(errorMessage, {
        description:
          err.message && err.message !== errorMessage ? err.message : undefined,
      });
      return null;
    } finally {
      setSaving(false);
    }
  }

  function handleChange(patch) {
    setConfig(prev => mergeConfigPatch(prev, patch));
  }

  function handleSave(patch, options) {
    return saveConfig(patch, options);
  }

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="settings-dialog h-[min(86vh,820px)] gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">设置</DialogTitle>
        <DialogDescription className="sr-only">
          配置 WebUI 常规参数、提示词模板和任务类型。
        </DialogDescription>
        {loading ? (
          <SettingsLoadingSkeleton />
        ) : (
          <div className="settings-pane flex min-h-0 flex-1 flex-row overflow-hidden rounded-[16px]">
            <SettingsNav
              active={activePane}
              onChange={setActivePane}
              onClose={onClose}
              config={config}
            />
            <div
              className={`settings-pane flex min-h-0 flex-1 flex-col py-7 ${activePane === 'task-types' ? 'overflow-y-auto' : 'overflow-hidden'}`}
            >
              <div
                className={`w-full px-8 ${activePane === 'task-types' ? '' : 'flex min-h-0 flex-1 flex-col'}`}
              >
                {activePane === 'agent-intake-skill' ? (
                  <AgentOnboardingPane
                    config={config}
                    onSave={handleSave}
                    saving={saving}
                  />
                ) : activePane === 'task-types' ? (
                  <TaskTypesSettingsPane
                    config={config}
                    onSave={handleSave}
                    saving={saving}
                  />
                ) : (
                  <PromptEditorPane
                    config={config}
                    onSave={handleSave}
                    saving={saving}
                  />
                )}

                {error ? (
                  <div className="settings-error mt-3 px-4 rounded-xl py-3 text-sm">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
