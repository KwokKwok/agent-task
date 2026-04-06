import { CircleHelp, Database, Globe2, Server } from 'lucide-react';

function SectionDivider() {
  return <div className="settings-divider my-4 border-t" />;
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-3">
      <div className="settings-title flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      {description ? (
        <p className="settings-muted mt-1 text-[13px] leading-6">{description}</p>
      ) : null}
    </div>
  );
}

function ReadOnlyRow({ label, description, value }) {
  return (
    <div className="flex flex-col gap-2 py-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 shrink-0 basis-[180px]">
        <div className="settings-title text-sm font-medium">{label}</div>
        {description ? <div className="settings-muted mt-0.5 text-[12px] leading-5">{description}</div> : null}
      </div>
      <div className="settings-card-soft min-h-[40px] min-w-0 flex-1 rounded-[12px] px-3.5 py-2.5 font-mono text-[12px] leading-6 break-all">
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
    <div className="space-y-1">
      <SectionHeader
        icon={CircleHelp}
        title="关于"
        description="这里展示当前 WebUI 实例的只读环境信息。部署与启动参数请通过命令行或 README 配置。"
      />

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

      <div className="settings-card rounded-[14px] p-4 text-sm leading-6">
        <div className="settings-muted">
          已移出界面的项目：
          {' '}
          <code>Host</code>
          、<code>Port</code>
          、<code>Public URL</code>
          、<code>Default Thinking</code>
          、<code>Default Timeout</code>
          。
        </div>
      </div>
    </div>
  );
}
