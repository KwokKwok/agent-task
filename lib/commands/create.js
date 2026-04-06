import { createTask, getTask } from '../task.js';
import { createSessionCookie } from '../webui/auth.js';
import { readPidInfo } from '../webui/pid-store.js';
import { getToken } from '../webui/token-store.js';
import { formatTask, success, error } from '../format.js';

async function notifyWebUiDispatch() {
  const token = getToken();
  const pidInfo = readPidInfo();

  if (!token || !pidInfo?.host || !pidInfo?.port) {
    return;
  }

  try {
    await fetch(`http://${pidInfo.host}:${pidInfo.port}/api/internal/dispatch/run`, {
      method: 'POST',
      headers: {
        Cookie: createSessionCookie(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ triggerSource: 'task_created' }),
    });
  } catch {
    // Ignore wake-up failures. The next scheduler interval will pick the task up.
  }
}

export default function (program) {
  program
    .command('create')
    .description('Create a new task record')
    .requiredOption('-t, --title <title>', 'Record title')
    .option('-d, --description <desc>', 'Record description')
    .option('--type <id>', 'Task type id')
    .option('-p, --priority <priority>', 'Priority (low/medium/high/urgent)', 'medium')
    .option('-s, --status <status>', 'Initial status (default: todo)')
    .option('--timeout <seconds>', 'Task timeout in seconds', '1800')
    .action(async (opts) => {
      try {
        const task = createTask({
          title: opts.title,
          description: opts.description,
          typeId: opts.type,
          priority: opts.priority,
          status: opts.status,
          timeoutSeconds: opts.timeout,
        });
        await notifyWebUiDispatch();
        const latestTask = getTask(task.id) || task;
        success(`Task created: ${task.id}`);
        console.log();
        console.log(formatTask(latestTask));
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });
}
