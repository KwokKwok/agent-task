import {
  buildDispatchPrompt,
  buildRepairPrompt,
  invokeOpenClawAgent,
} from '../openclaw-dispatch.js';
import {
  createRepairRunFromTimedOut,
  createTaskRun,
  failTaskRunDispatch,
  listTimedOutRunningTasks,
  markRepairExhausted,
  markTaskRunTimedOut,
} from '../task-run.js';
import { DEFAULT_TASK_TIMEOUT_SECONDS } from '../task.js';
import { addEvent, listTasks } from '../task.js';
import { getTaskTypeById, listTaskTypes } from '../task-type.js';
import { readWebuiConfig } from './config-store.js';
import { writeSystemLog } from './system-log.js';

function selectExecutionStrategy(task, config) {
  if (task.type_id) {
    return getTaskTypeById(task.type_id, config, { includeDisabled: true });
  }

  const strategies = listTaskTypes(config);
  if (!strategies.length) return null;
  if (strategies.length === 1) return strategies[0];

  const haystack = `${task.title || ''}\n${task.description || ''}`.toLowerCase();
  return strategies.find((strategy) => {
    const hints = [strategy.id, strategy.name, strategy.triggerCondition]
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean);
    return hints.some((hint) => haystack.includes(hint));
  }) || null;
}

function resolveOpenClawRuntime(task, config) {
  const strategy = selectExecutionStrategy(task, config);
  const taskTimeout = Number(task.timeout_seconds);
  const hasExplicitTaskTimeout = Number.isInteger(taskTimeout)
    && taskTimeout > 0
    && taskTimeout !== DEFAULT_TASK_TIMEOUT_SECONDS;

  return {
    strategy,
    thinking: config.general?.openclawDefaults?.thinking || 'off',
    timeoutSeconds: hasExplicitTaskTimeout
      ? taskTimeout
      : strategy?.openclaw?.timeoutSeconds
        || config.general?.openclawDefaults?.timeoutSeconds
        || taskTimeout
        || DEFAULT_TASK_TIMEOUT_SECONDS,
  };
}

export function createScheduler({
  intervalMs,
  maxConcurrent,
  invokeAgent = invokeOpenClawAgent,
  config: schedulerConfig,
} = {}) {
  let timer = null;
  let running = false;

  function writeSchedulerLog(level, message, meta) {
    writeSystemLog(level, 'scheduler', message, meta);
  }

  async function runCycle(triggerSource = 'interval') {
    if (running) {
      writeSchedulerLog('warn', 'Scheduler cycle skipped', {
        triggerSource,
        reason: 'cycle_locked',
      });
      return { skipped: true, reason: 'cycle_locked', dispatched: 0 };
    }

    running = true;
    try {
      const config = schedulerConfig || readWebuiConfig();
      let repaired = 0;
      const timedOutTasks = listTimedOutRunningTasks();
      for (const timedOut of timedOutTasks) {
        const sessionKey = timedOut.session_key || `task-${timedOut.id}`;
        const runtime = resolveOpenClawRuntime(timedOut, config);
        const timeoutSeconds = timedOut.dispatch_timeout_seconds || runtime.timeoutSeconds;

        if ((timedOut.repair_count || 0) >= 1) {
          markTaskRunTimedOut(timedOut.run_id);
          addEvent(timedOut.id, 'dispatch_timed_out', `Dispatch timed out after ${timeoutSeconds}s`);
          writeSchedulerLog('warn', 'Dispatch timed out', {
            taskId: timedOut.id,
            runId: timedOut.run_id,
            timeoutSeconds,
            triggerSource,
          });
          markRepairExhausted(timedOut.id);
          addEvent(timedOut.id, 'repair_exhausted', 'Automatic repair limit reached');
          writeSchedulerLog('warn', 'Automatic repair limit reached', {
            taskId: timedOut.id,
            runId: timedOut.run_id,
            triggerSource,
          });
          continue;
        }

        let run;
        try {
          const prompt = buildRepairPrompt(timedOut, {
            config,
            sessionKey,
            timeoutSeconds,
          });
          run = createRepairRunFromTimedOut(timedOut.id, timedOut.run_id, {
            kind: 'repair',
            status: 'running',
            snapshotStatus: 'repairing',
            sessionKey,
            prompt,
            timeoutSeconds,
            triggerSource,
            attemptIndex: (timedOut.repair_count || 0) + 1,
          });
          addEvent(timedOut.id, 'dispatch_timed_out', `Dispatch timed out after ${timeoutSeconds}s`);
          writeSchedulerLog('warn', 'Dispatch timed out', {
            taskId: timedOut.id,
            runId: timedOut.run_id,
            timeoutSeconds,
            triggerSource,
          });
        } catch (error) {
          writeSchedulerLog('error', 'Automatic repair preparation failed', {
            taskId: timedOut.id,
            runId: timedOut.run_id,
            triggerSource,
            errorMessage: error.message,
          });
          continue;
        }

        try {
          await invokeAgent({
            sessionKey,
            prompt: run.prompt,
            timeoutSeconds,
            thinking: runtime.thinking,
          });
          addEvent(timedOut.id, 'repair_started', `Automatic repair started (${triggerSource})`);
          writeSchedulerLog('info', 'Automatic repair started', {
            taskId: timedOut.id,
            sessionKey,
            timeoutSeconds,
            triggerSource,
          });
          repaired += 1;
        } catch (error) {
          failTaskRunDispatch(run.id, error.message, 'in_progress', 'repair_exhausted');
          addEvent(timedOut.id, 'repair_failed', error.message);
          writeSchedulerLog('error', 'Automatic repair failed', {
            taskId: timedOut.id,
            runId: run.id,
            triggerSource,
            errorMessage: error.message,
          });
        }
      }

      const activeCount = listTasks({ status: 'in_progress' })
        .filter((task) => task.dispatch_status === 'running' || task.dispatch_status === 'repairing')
        .length;
      const available = Math.max(0, (maxConcurrent ?? 2) - activeCount);
      const todoTasks = listTasks({ status: 'todo' });

      if (available === 0) {
        const result = {
          dispatched: 0,
          repaired,
          activeCount,
          available,
          queuedTodoCount: todoTasks.length,
          timedOutCount: timedOutTasks.length,
        };
        writeSchedulerLog('info', 'Scheduler cycle completed', {
          triggerSource,
          ...result,
        });
        return result;
      }

      const queue = todoTasks.slice(0, available);
      let dispatched = 0;

      for (const task of queue) {
        const sessionKey = task.session_key || `task-${task.id}`;
        const runtime = resolveOpenClawRuntime(task, config);

        let run;
        try {
          const prompt = buildDispatchPrompt(task, {
            config,
            sessionKey,
            timeoutSeconds: runtime.timeoutSeconds,
          });
          run = createTaskRun(task.id, {
            kind: 'dispatch',
            status: 'running',
            taskStatus: 'in_progress',
            sessionKey,
            prompt,
            timeoutSeconds: runtime.timeoutSeconds,
            triggerSource,
            attemptIndex: 1,
          });
          addEvent(task.id, 'status_changed', 'Scheduled by WebUI dispatcher');
        } catch (error) {
          writeSchedulerLog('error', 'Automatic dispatch preparation failed', {
            taskId: task.id,
            triggerSource,
            errorMessage: error.message,
          });
          continue;
        }

        try {
          await invokeAgent({
            sessionKey,
            prompt: run.prompt,
            timeoutSeconds: runtime.timeoutSeconds,
            thinking: runtime.thinking,
          });
          addEvent(task.id, 'dispatch_started', `Automatic dispatch started (${triggerSource})`);
          writeSchedulerLog('info', 'Automatic dispatch started', {
            taskId: task.id,
            sessionKey,
            timeoutSeconds: runtime.timeoutSeconds,
            triggerSource,
          });
          dispatched += 1;
        } catch (error) {
          failTaskRunDispatch(run.id, error.message, 'todo');
          addEvent(task.id, 'dispatch_failed', error.message);
          writeSchedulerLog('error', 'Automatic dispatch failed', {
            taskId: task.id,
            runId: run.id,
            triggerSource,
            errorMessage: error.message,
          });
        }
      }

      const result = {
        dispatched,
        repaired,
        activeCount,
        available,
        queuedTodoCount: todoTasks.length,
        timedOutCount: timedOutTasks.length,
      };

      if (
        triggerSource !== 'interval'
        || dispatched > 0
        || repaired > 0
        || activeCount > 0
        || todoTasks.length > 0
        || timedOutTasks.length > 0
      ) {
        writeSchedulerLog('info', 'Scheduler cycle completed', {
          triggerSource,
          ...result,
        });
      }

      return result;
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      void runCycle('interval');
    }, intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
    runCycle,
  };
}
