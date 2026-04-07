import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../lib/webui/client/src/lib/utils.ts';
import { sortByCreatedTimeDesc, sortByPriorityThenTime } from '../lib/webui/client/src/lib/helpers.js';

describe('webui time formatting', () => {
  it('treats small future clock skew as just now', () => {
    const now = Date.parse('2026-04-07T12:00:00.000Z');

    expect(formatRelativeTime('2026-04-07T12:00:20.000Z', now)).toBe('刚刚');
  });

  it('keeps full datetime for clearly future timestamps', () => {
    const now = Date.parse('2026-04-07T12:00:00.000Z');

    expect(formatRelativeTime('2026-04-07T12:02:00.000Z', now)).toBe('2026/04/07 20:02:00');
  });
});

describe('webui task sorting helpers', () => {
  it('sorts non-todo cards by created_at desc', () => {
    const items = [
      { id: 'older', created_at: '2026-04-07T12:00:00.000Z' },
      { id: 'newer', created_at: '2026-04-07T12:00:05.000Z' },
    ];

    expect(sortByCreatedTimeDesc(items).map((item) => item.id)).toEqual(['newer', 'older']);
  });

  it('uses created_at as the tie-breaker for todo priority sorting', () => {
    const items = [
      { id: 'later', priority: 'high', created_at: '2026-04-07T12:00:05.000Z' },
      { id: 'earlier', priority: 'high', created_at: '2026-04-07T12:00:00.000Z' },
    ];

    expect(sortByPriorityThenTime(items).map((item) => item.id)).toEqual(['earlier', 'later']);
  });
});
