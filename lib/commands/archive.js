import { archiveTask } from '../task.js';
import { success, error } from '../format.js';

export default function (program) {
  program
    .command('archive <id>')
    .description('Archive a completed task record and compress its workspace')
    .action((id) => {
      try {
        const task = archiveTask(id);
        success(`Record archived: ${id}`);
        if (task.workspace_path) {
          console.log(`  Archive: ${task.workspace_path}`);
        }
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });
}
