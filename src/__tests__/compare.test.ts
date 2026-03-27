import { describe, it, expect } from 'vitest';
import { compareRuns } from '../compare.js';
import type { RunResult } from '../types.js';

function makeRun(results: Array<{ name: string; passed: boolean }>, passRate: number): RunResult {
  return {
    runId: 'run-1',
    timestamp: new Date().toISOString(),
    passRate,
    results: results.map((r) => ({
      ...r,
      score: r.passed ? 0.9 : 0.3,
      reasoning: 'reason',
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0,
      durationMs: 100,
    })),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
  };
}

describe('compareRuns', () => {
  it('identifies regressions', () => {
    const baseline = makeRun(
      [
        { name: 'a', passed: true },
        { name: 'b', passed: true },
      ],
      1
    );
    const current = makeRun(
      [
        { name: 'a', passed: true },
        { name: 'b', passed: false },
      ],
      0.5
    );

    const result = compareRuns(current, baseline);
    expect(result.regressions).toEqual(['b']);
    expect(result.improvements).toEqual([]);
  });

  it('identifies improvements', () => {
    const baseline = makeRun(
      [
        { name: 'a', passed: false },
        { name: 'b', passed: true },
      ],
      0.5
    );
    const current = makeRun(
      [
        { name: 'a', passed: true },
        { name: 'b', passed: true },
      ],
      1
    );

    const result = compareRuns(current, baseline);
    expect(result.improvements).toEqual(['a']);
    expect(result.regressions).toEqual([]);
  });

  it('calculates passRateDelta correctly', () => {
    const baseline = makeRun([{ name: 'a', passed: true }], 1);
    const current = makeRun([{ name: 'a', passed: false }], 0);

    const result = compareRuns(current, baseline);
    expect(result.passRateDelta).toBeCloseTo(-1);
  });

  it('ignores test cases only in one run', () => {
    const baseline = makeRun([{ name: 'a', passed: true }], 1);
    const current = makeRun(
      [
        { name: 'a', passed: true },
        { name: 'new-test', passed: false },
      ],
      0.5
    );

    const result = compareRuns(current, baseline);
    expect(result.regressions).toEqual([]);
    expect(result.improvements).toEqual([]);
  });
});
