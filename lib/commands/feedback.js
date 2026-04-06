import { backupReports } from '../workspace.js';
import {
  commentTask,
  getTask,
  getTaskFeedback,
  rejectTask,
  updateTaskFeedback,
} from '../task.js';
import { error, info, success } from '../format.js';

export default function registerFeedback(program) {
  const feedback = program
    .command('feedback')
    .description('Manage feedback and revision history');

  feedback
    .command('read <id>')
    .description('Render feedback summary and timeline as markdown')
    .action((id) => {
      try {
        const data = getTaskFeedback(id);
        console.log(data.content);
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });

  feedback
    .command('reject <id>')
    .description('Reject the current result and return the record to todo')
    .option('-m, --message <message>', 'Rejection reason or next direction')
    .action((id, opts) => {
      try {
        const item = rejectTask(id, opts.message);
        success(`Feedback recorded for ${id}`);
        info(item.message);
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });

  feedback
    .command('comment <id>')
    .description('Add a human comment without changing the record status')
    .requiredOption('-m, --message <message>', 'Comment content')
    .action((id, opts) => {
      try {
        const item = commentTask(id, opts.message);
        success(`Comment recorded for ${id}`);
        info(item.message);
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });

  feedback
    .command('update <id>')
    .description('Record an AI update after report changes')
    .requiredOption('-m, --message <message>', 'Update summary')
    .option('--backup', 'Back up existing report files before recording the update')
    .action((id, opts) => {
      try {
        const task = getTask(id);
        if (!task) {
          throw new Error(`Task not found: ${id}`);
        }
        const backupPaths = opts.backup && task.workspace_path
          ? backupReports(task.workspace_path)
          : [];
        const item = updateTaskFeedback(id, opts.message, backupPaths.length ? { backupPaths } : null);
        success(`AI update recorded for ${id}`);
        if (backupPaths.length) {
          console.log('Backups:');
          for (const path of backupPaths) {
            console.log(`  ${path}`);
          }
        }
        info(item.message);
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });
}
