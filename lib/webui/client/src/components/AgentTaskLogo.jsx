import logoUrl from '../logo.svg';

export function AgentTaskLogo({ subtitle = 'AI task control plane', compact = false }) {
  return (
    <div className={`agent-logo-lockup${compact ? ' is-compact' : ''}`}>
      <img className="agent-logo-mark" src={logoUrl} alt="Agent Task" />
      <div>
        <p className="agent-logo-title">Agent Task</p>
        <p className="agent-logo-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
