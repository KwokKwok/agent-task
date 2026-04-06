import { initWorkspace } from '../task.js';
import { formatTask, success, error } from '../format.js';

export default function (program) {
  program
    .command('workspace <id>')
    .description('Ensure workspace directory exists for a task record')
    .action((id) => {
      try {
        const task = initWorkspace(id);
        success(`Workspace ready: ${task.workspace_path}`);
        console.log();
        console.log(formatTask(task));
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });
}
