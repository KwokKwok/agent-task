export const painPoints = [
  {
    icon: 'sync_disabled',
    title: 'Constant Participation',
    body: 'Current AI agents often require you to stay present for every output. If you step away, the flow stops. Agent Task is built around work that can be reviewed later.',
  },
  {
    icon: 'visibility_off',
    title: 'Invisible Deliverables',
    body: 'Where did the AI save that file? In a chat bubble three scrolls up? Agent Task gives each task its own workspace and a stable place for deliverables.',
  },
  {
    icon: 'warning',
    title: 'Unreliable Hand-Offs',
    body: 'Long chat histories make work harder to inspect and continue. A formal task record keeps files, reports, and revisions anchored in one place.',
  },
];

export const solutionBullets = [
  {
    title: 'Independent Workspace',
    body: 'Every task gets its own sandbox for reports, notes, drafts, and process files.',
  },
  {
    title: 'Feedback / Rework Cycle',
    body: 'Review drafts, leave comments, reject a result, and keep updates attached to the same record.',
  },
  {
    title: 'Mission Control Interface',
    body: 'A single WebUI for task timelines, reports, files, and the current state of work.',
  },
];

export const finalBullets = [
  {
    title: 'Feedback Loop',
    body: 'Structured comments, rejection, and updates instead of loose chat replies.',
    className: 'md:col-span-2 bg-primary-container text-on-primary-container',
    align: 'items-end',
  },
  {
    title: 'CLI Ready',
    body: 'Create records, inspect workspaces, and surface WebUI access from the command line.',
    icon: 'terminal',
    className: 'bg-secondary-container text-on-secondary-container',
  },
  {
    title: 'Session Gated',
    body: 'Public landing, protected console. The real work interface still sits behind token and session checks.',
    icon: 'security',
    className: 'bg-tertiary-fixed text-on-tertiary-fixed',
  },
];
