import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveBaseline, loadBaseline, buildPassMap } from '../baseline.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { RunResult } from '../types.js';

const fixture: RunResult = {
  runId: 'run-123',
  timestamp: '2024-01-01T00:00:00.000Z',
  passRate: 0.5,
  results: [
    {
      name: 'test-a',
      passed: true,
      score: 0.9,
      reasoning: 'good',
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.001,
      durationMs: 500,
    },
    {
      name: 'test-b',
      passed: false,
      score: 0.3,
      reasoning: 'bad',
      inputTokens: 80,
      outputTokens: 40,
      costUsd: 0.0008,
      durationMs: 400,
    },
  ],
  totalInputTokens: 180,
  totalOutputTokens: 90,
  totalCostUsd: 0.0018,
};

describe('baseline', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'eval-core-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('save and load round-trips correctly', async () => {
    const filePath = join(tmpDir, 'baseline.json');
    await saveBaseline(fixture, filePath);
    const loaded = await loadBaseline(filePath);
    expect(loaded).toEqual(fixture);
  });

  it('creates parent directories', async () => {
    const filePath = join(tmpDir, 'nested', 'deep', 'baseline.json');
    await saveBaseline(fixture, filePath);
    const content = await readFile(filePath, 'utf8');
    expect(JSON.parse(content)).toEqual(fixture);
  });

  it('returns null for missing file', async () => {
    const result = await loadBaseline(join(tmpDir, 'nonexistent.json'));
    expect(result).toBeNull();
  });

  it('throws on malformed file', async () => {
    const filePath = join(tmpDir, 'bad.json');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(filePath, JSON.stringify({ runId: 'run-1' }), 'utf8');
    await expect(loadBaseline(filePath)).rejects.toThrow('Malformed baseline file');
  });

  describe('buildPassMap', () => {
    it('maps test names to passed status', () => {
      const map = buildPassMap(fixture);
      expect(map.get('test-a')).toBe(true);
      expect(map.get('test-b')).toBe(false);
      expect(map.size).toBe(2);
    });
  });
});
