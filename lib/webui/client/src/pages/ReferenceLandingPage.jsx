import { AgentTaskLogo } from '../components/AgentTaskLogo.jsx';
import logoUrl from '../logo.svg';
import {
  finalBullets,
  painPoints,
  solutionBullets,
} from './landingContent.js';

function HeroVisual() {
  return (
    <div className="relative flex justify-center items-center h-[500px]">
      <div className="absolute inset-0 bg-primary/6 rounded-full blur-[120px]" />
      <div className="relative z-20 w-[23rem] rounded-[32px] border border-primary/10 bg-surface-container-lowest p-6 shadow-[0_32px_64px_rgba(56,90,174,0.08)] landing-float">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="font-label text-[10px] uppercase tracking-[0.24em] text-primary">Task Record</p>
            <h3 className="mt-2 font-headline text-2xl font-bold">Voice Research Pack</h3>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            Live
          </div>
        </div>

        <div className="space-y-3 rounded-[24px] bg-surface-container p-4">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">
            <span>Workspace</span>
            <span>8 files</span>
          </div>
          <div className="space-y-2 text-sm text-on-surface/80">
            <div className="rounded-2xl bg-surface px-4 py-3">report.md</div>
            <div className="rounded-2xl bg-surface px-4 py-3">comparison-notes.md</div>
            <div className="rounded-2xl bg-surface px-4 py-3">updates/2026-03-30.md</div>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] bg-surface-container p-4">
          <div className="flex justify-between font-label text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">
            <span>Feedback Loop</span>
            <span>72%</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div className="landing-pulse-bar h-full rounded-full bg-primary" style={{ width: '72%' }} />
          </div>
          <div className="mt-4 grid gap-2 text-sm text-on-surface/80">
            <div className="rounded-2xl bg-surface px-4 py-3">comment: add deployment notes</div>
            <div className="rounded-2xl bg-surface px-4 py-3">update: backup old report and revise summary</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SolutionVisual() {
  return (
    <div className="w-full rounded-[48px] bg-[#f1efee] p-8 shadow-2xl">
      <div className="rounded-[32px] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-black/5 pb-4">
          <div>
            <div className="font-label text-[10px] uppercase tracking-[0.22em] text-primary">Mission Control</div>
            <h4 className="mt-2 font-headline text-2xl font-bold">Task Review Board</h4>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 font-label text-[10px] uppercase tracking-[0.2em] text-primary">WebUI</div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] bg-surface-container-low p-4">
            <div className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">Timeline</div>
            <div className="mt-4 space-y-3 text-sm text-on-surface/80">
              <div className="rounded-2xl bg-white px-4 py-3">09:10 create task record</div>
              <div className="rounded-2xl bg-white px-4 py-3">09:42 write report.md</div>
              <div className="rounded-2xl bg-white px-4 py-3">10:08 update after feedback</div>
            </div>
          </div>
          <div className="rounded-[24px] bg-primary-container/20 p-4">
            <div className="font-label text-[10px] uppercase tracking-[0.2em] text-primary">Outputs</div>
            <div className="mt-4 space-y-3 text-sm text-on-surface/80">
              <div className="rounded-2xl bg-white/90 px-4 py-3">report.md</div>
              <div className="rounded-2xl bg-white/90 px-4 py-3">report.html</div>
              <div className="rounded-2xl bg-white/90 px-4 py-3">report.mp3</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReferenceLandingPage() {
  return (
    <div className="relative bg-surface text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container tonal-transition-bg min-h-screen console-aurora-shell">
      <div className="console-aurora-layer console-aurora-layer-a" />
      <div className="console-aurora-layer console-aurora-layer-b" />
      <div className="console-aurora-layer console-aurora-layer-c" />
      <div className="console-aurora-beam console-aurora-beam-a" />
      <div className="console-aurora-beam console-aurora-beam-b" />
      <header className="fixed top-0 w-full z-50 console-landing-header">
        <nav className="max-w-7xl mx-auto flex justify-between items-center px-5 md:px-8 h-20 console-landing-header-shell">
          <AgentTaskLogo subtitle="Task control plane for AI agents" compact />
          <div className="flex items-center gap-4">
            <a
              className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-xl font-headline font-semibold text-sm hover:opacity-90 active:scale-95 transition-all duration-300"
              href="/"
            >
              Launch Console
            </a>
          </div>
        </nav>
      </header>

      <main className="pt-20">
        <section className="relative px-5 md:px-[5.5rem] overflow-hidden pt-10 pb-20 md:pt-14 md:pb-32">
          <div className="max-w-7xl mx-auto grid gap-12 md:grid-cols-2 md:gap-16 items-center">
            <div className="z-10">
              <span className="font-label text-primary uppercase tracking-[0.2em] text-[10px] mb-6 block">
                The Future of Autonomy
              </span>
              <h1 className="font-headline text-[2.9rem] md:text-[4.5rem] leading-[1.05] font-extrabold tracking-tight mb-6 md:mb-8">
                You rest.
                <br />
                <span className="text-primary">Agent works.</span>
              </h1>
              <p className="font-body text-lg md:text-xl text-on-surface-variant max-w-lg mb-8 md:mb-12 leading-relaxed">
                From ephemeral chat threads to a hardened mission control. Agent Task distills chaotic AI interactions into structured, reliable workspaces.
              </p>
              <div className="flex flex-wrap gap-4">
                <a className="bg-surface-container-high text-on-surface px-6 md:px-8 py-3.5 md:py-4 rounded-xl font-headline font-bold hover:bg-surface-dim transition-all" href="#methodology">
                  Read Methodology
                </a>
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section className="px-5 md:px-[5.5rem] py-24 md:py-32 bg-surface-container-low">
          <div className="max-w-7xl mx-auto">
            <div className="mb-20 text-center md:text-left">
              <span className="font-label text-primary uppercase tracking-[0.2em] text-[10px] mb-4 block">The friction</span>
              <h2 className="font-headline text-4xl font-bold tracking-tight">Chat is not a Workspace.</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {painPoints.map((item) => (
                <div key={item.title} className="bg-surface p-8 md:p-12 rounded-[32px] hover:translate-y-[-8px] transition-transform duration-500">
                  <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-error/10 text-error mb-8">
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </div>
                  <h4 className="font-headline text-xl font-bold mb-4">{item.title}</h4>
                  <p className="font-body text-on-surface-variant leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="methodology" className="px-5 md:px-[5.5rem] py-24 md:py-40">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-14 md:gap-24 items-center">
              <div className="order-2 lg:order-1">
                <SolutionVisual />
              </div>
              <div className="order-1 lg:order-2">
                <span className="font-label text-primary uppercase tracking-[0.2em] text-[10px] mb-6 block">The Transformation</span>
                <h2 className="font-headline text-4xl md:text-5xl font-bold leading-tight mb-6 md:mb-8">The Worklog Loop</h2>
                <p className="font-body text-base md:text-lg text-on-surface-variant mb-10 md:mb-12 leading-relaxed">
                  Stop repeating yourself. Define a task once, and it becomes a formal record with its own workspace, deliverables, feedback history, and review surface.
                </p>
                <ul className="space-y-10">
                  {solutionBullets.map((item) => (
                    <li key={item.title} className="flex gap-6">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                      </div>
                      <div>
                        <h5 className="font-headline font-bold mb-2">{item.title}</h5>
                        <p className="font-body text-on-surface-variant text-sm">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="documentation" className="px-5 md:px-[5.5rem] py-24 md:py-32 bg-surface-container-highest/20">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-6 h-auto md:h-[600px]">
              <div className="md:col-span-2 md:row-span-2 bg-surface-container-lowest p-12 rounded-[40px] flex flex-col justify-between border border-primary/5">
                <div>
                  <span className="font-label text-primary uppercase text-[10px] tracking-widest mb-4 block">Central Core</span>
                  <h3 className="font-headline text-3xl font-bold mb-6">Mission Control Dashboard</h3>
                  <p className="font-body text-on-surface-variant">
                    A unified view of task records, workspaces, reports, feedback, and current progress in one editorial interface.
                  </p>
                </div>
                <div className="rounded-2xl mt-8 bg-surface-container-low p-6 shadow-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white p-4">
                      <div className="font-label text-[10px] uppercase tracking-[0.22em] text-primary">Status</div>
                      <div className="mt-3 font-headline text-xl font-bold">todo / in progress / done</div>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <div className="font-label text-[10px] uppercase tracking-[0.22em] text-primary">Reports</div>
                      <div className="mt-3 font-headline text-xl font-bold">md / html / mp3</div>
                    </div>
                  </div>
                </div>
              </div>
              {finalBullets.map((item) => (
                <div key={item.title} className={`${item.className} p-10 rounded-[40px] flex ${item.align || 'items-end'}`}>
                  <div>
                    {item.icon ? <span className="material-symbols-outlined text-3xl mb-4">{item.icon}</span> : null}
                    <h4 className="font-headline text-2xl font-bold mb-2">{item.title}</h4>
                    <p className="font-body text-sm opacity-80">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cta" className="px-5 md:px-[5.5rem] py-24 md:py-40 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-headline text-[2.8rem] md:text-[3.5rem] font-extrabold tracking-tight mb-6 md:mb-8">
              Wake up to results.
            </h2>
            <p className="font-body text-lg md:text-xl text-on-surface-variant mb-10 md:mb-12">
              A persistent record with files, feedback, and progress you can review the moment you return.
            </p>
            <div className="flex flex-col items-center justify-center gap-6">
              <a className="w-full md:w-auto bg-primary text-on-primary px-10 py-5 rounded-2xl font-headline font-bold flex items-center justify-center gap-3 text-lg hover:shadow-2xl transition-all" href="/">
                <span className="material-symbols-outlined">rocket_launch</span>
                Launch Console
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full rounded-t-[32px] bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-5 md:px-16 py-10 md:py-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <AgentTaskLogo subtitle="Task control plane for AI agents" compact />
            <div className="h-4 w-[1px] bg-outline-variant" />
            <div className="font-body text-xs tracking-wide uppercase opacity-70">
              © 2026 Agent Task. Structured work records for AI agents.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
