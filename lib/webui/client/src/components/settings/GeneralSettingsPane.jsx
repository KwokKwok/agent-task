import { CircleHelp, Database, Globe2, Server } from 'lucide-react';

function SectionDivider() {
  return <div className="my-5 border-t border-[var(--border-subtle)]" />;
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 text-[13px] font-medium tracking-[0.014em] text-[var(--text-main)]">
        <Icon className="h-4 w-4 text-[var(--text-soft)]" />
        {title}
      </div>
      {description ? (
        <p className="mt-1 text-[12px] leading-[1.6] tracking-[0.014em] text-[var(--text-soft)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function ReadOnlyRow({ label, description, value }) {
  return (
    <div className="flex flex-col gap-2 py-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 shrink-0 basis-[180px]">
        <div className="text-[13px] font-medium tracking-[0.014em] text-[var(--text-main)]">{label}</div>
        {description ? <div className="mt-0.5 text-[11px] leading-[1.45] tracking-[0.014em] text-[var(--text-muted)]">{description}</div> : null}
      </div>
      <div className="min-h-[36px] min-w-0 flex-1 rounded-[10px] bg-[var(--surface-soft)] px-3.5 py-2 font-mono text-[12px] leading-[1.6] tracking-normal text-[var(--text-main)] break-all">
        {value || '-'}
      </div>
    </div>
  );
}

function formatBindAddress(runtimeInfo, config) {
  const host = runtimeInfo?.host || config.host || '127.0.0.1';
  const port = runtimeInfo?.port || config.port || 3333;
  return `http://${host}:${port}`;
}

export function GeneralSettingsPane({ config }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mb-6">
        <div className="text-[15px] font-medium tracking-[0.016em] text-[var(--text-main)]">
          关于
        </div>
        <div className="mt-1 text-[12px] leading-[1.6] tracking-[0.014em] text-[var(--text-soft)]">
          当前 WebUI 实例的只读环境信息
        </div>
      </div>

      <SectionHeader
        icon={Database}
        title="数据与配置"
        description="用于确认当前连到的是哪一套数据目录，以及它的来源。"
      />

      <ReadOnlyRow
        label="当前数据根目录"
        description="如果你是在连接远端环境，这里会直接反映当前实例真正读写的路径。"
        value={config.dataRoot}
      />

      <ReadOnlyRow
        label="数据目录来源"
        description="显示当前数据目录是由哪个环境变量或默认路径决定的。"
        value={config.dataRootSource}
      />

      <SectionDivider />

      <SectionHeader
        icon={Server}
        title="运行信息"
        description="帮助确认当前 WebUI 实例的运行状态与版本。"
      />

      <ReadOnlyRow
        label="WebUI 地址"
        description="当前 WebUI 实例实际绑定的地址。"
        value={formatBindAddress(config.runtimeInfo, config)}
      />

      <ReadOnlyRow
        label="启动时间"
        description="当前 WebUI 进程的启动时间。"
        value={config.runtimeInfo?.startedAt || '-'}
      />

      <ReadOnlyRow
        label="进程 PID"
        description="当前 WebUI 后端进程号。"
        value={config.runtimeInfo?.pid ? String(config.runtimeInfo.pid) : '-'}
      />

      <ReadOnlyRow
        label="版本"
        description="当前部署实例的 agent-task 版本。"
        value={config.version || '-'}
      />

      <SectionDivider />

      <SectionHeader
        icon={Globe2}
        title="说明"
        description="以下配置项已移出 WebUI，仅保留在命令行和 README 中维护。"
      />

      <div className="rounded-[12px] bg-[var(--surface-soft)] p-4 text-[12px] leading-[1.6] tracking-[0.014em] text-[var(--text-soft)]">
        已移出界面的项目：{' '}
        <code className="rounded bg-[var(--panel-bg-strong)] px-1.5 py-0.5 font-mono text-[11px]">Host</code>、
        <code className="rounded bg-[var(--panel-bg-strong)] px-1.5 py-0.5 font-mono text-[11px]">Port</code>、
        <code className="rounded bg-[var(--panel-bg-strong)] px-1.5 py-0.5 font-mono text-[11px]">Public URL</code>、
        <code className="rounded bg-[var(--panel-bg-strong)] px-1.5 py-0.5 font-mono text-[11px]">Default Thinking</code>、
        <code className="rounded bg-[var(--panel-bg-strong)] px-1.5 py-0.5 font-mono text-[11px]">Default Timeout</code>。
      </div>
    </div>
  );
}
