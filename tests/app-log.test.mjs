import test from 'node:test';
import assert from 'node:assert/strict';
import { addLog, reportError, logEntries, clearLog, errorCount, recentProblems, onLog } from '../src/app-log.js';
import { buildFeedbackReport, feedbackTitle, issueUrl, mailUrl } from '../src/feedback.js';
import { ROTATION_AXIS_COLORS } from '../src/turrets/asset-guides.js';

test('errors keep their level, collapse repeats and are counted', () => {
  clearLog(); let calls = 0; const stop = onLog(() => calls++);
  addLog('Model loaded', 'SCENE');
  reportError(new Error('Shader failed'), 'RENDER'); reportError(new Error('Shader failed'), 'RENDER');
  addLog('Thin blocks skipped', 'MODEL', 'warning');
  reportError(Object.assign(new Error('stop'), { name: 'AbortError' }));
  assert.equal(logEntries().length, 3);
  assert.equal(logEntries()[1].count, 2);
  assert.equal(errorCount(), 2);
  assert.deepEqual(recentProblems().map(e => e.level), ['error', 'warning']);
  assert.ok(calls >= 4); stop(); clearLog(); assert.equal(errorCount(), 0);
});

test('feedback report carries the message, system details and recent problems', () => {
  clearLog(); reportError(new Error('Export failed'), 'EXPORT');
  const body = buildFeedbackReport({ kind: 'bug', message: 'Export crashed', system: [['App', 'Avorion Viewer 0.11.0']], problems: recentProblems() });
  assert.match(body, /### Bug report/); assert.match(body, /Export crashed/); assert.match(body, /Avorion Viewer 0\.11\.0/); assert.match(body, /EXPORT: Export failed/);
  const bare = buildFeedbackReport({ kind: 'idea', message: 'x', includeSystem: false, includeErrors: false, system: [['App', 'v']] });
  assert.doesNotMatch(bare, /System|Recent errors/);
  assert.equal(feedbackTitle('idea', 'Add a grid\nmore'), 'Idea: Add a grid');
  const url = new URL(issueUrl('https://github.com/o/r/issues', 'T', 'B', 'bug'));
  assert.equal(url.pathname, '/o/r/issues/new'); assert.equal(url.searchParams.get('body'), 'B'); assert.equal(url.searchParams.get('labels'), 'bug');
  assert.equal(new URL(issueUrl('https://github.com/o/r', 'T', 'B', 'other')).pathname, '/o/r/issues/new');
  assert.equal(issueUrl('', 'T', 'B'), '');
  assert.match(mailUrl('a@b.c', 'Hi there', 'x&y'), /^mailto:a@b\.c\?subject=Hi%20there&body=x%26y$/);
  clearLog();
});

test('turret rotation axes avoid the world axis colors', () => {
  const world = [0xa34f50, 0x65a34f, 0x527ac6];
  const rgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  for (const color of Object.values(ROTATION_AXIS_COLORS)) for (const axis of world) {
    const d = Math.hypot(...rgb(color).map((v, i) => v - rgb(axis)[i])); assert.ok(d > 120, `${color.toString(16)} too close to ${axis.toString(16)}`);
  }
});
