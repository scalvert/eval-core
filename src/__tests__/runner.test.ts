import { describe, it, expect, vi } from 'vitest';
import { runEval } from '../runner.js';
import type { ResponseFn, JudgeFn, TestCase } from '../types.js';

const cases: TestCase[] = [
  { name: 'test-1', input: 'hello', rubric: 'be friendly' },
  { name: 'test-2', input: 'bye', rubric: 'be polite' },
  { name: 'test-3', input: 'help', rubric: 'be helpful' },
];

function makeRespond(overrides?: Partial<Awaited<ReturnType<ResponseFn>>>): ResponseFn {
  return vi.fn(async () => ({
    response: 'ok',
    inputTokens: 100,
    outputTokens: 50,
    ...overrides,
  }));
}

function makeJudge(pass: boolean): JudgeFn {
  return vi.fn(async () => ({
    passed: pass,
    score: pass ? 0.9 : 0.3,
    reasoning: 'reason',
    inputTokens: 50,
    outputTokens: 25,
  }));
}

describe('runEval', () => {
  it('computes passRate as a fraction', async () => {
    const judge: JudgeFn = vi.fn(async ({ rubric }) => ({
      passed: rubric === 'be friendly',
      score: rubric === 'be friendly' ? 0.9 : 0.3,
      reasoning: 'ok',
      inputTokens: 50,
      outputTokens: 25,
    }));

    const result = await runEval({
      testCases: cases,
      respond: makeRespond(),
      judge,
    });

    expect(result.passRate).toBeCloseTo(1 / 3);
  });

  it('accumulates tokens from respond and judge calls', async () => {
    const result = await runEval({
      testCases: [cases[0]],
      respond: makeRespond(),
      judge: makeJudge(true),
    });

    const r = result.results[0];
    expect(r.inputTokens).toBe(150);
    expect(r.outputTokens).toBe(75);
    expect(result.totalInputTokens).toBe(150);
    expect(result.totalOutputTokens).toBe(75);
  });

  it('respects concurrency limit', async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const respond: ResponseFn = async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
      currentConcurrent--;
      return { response: 'ok', inputTokens: 10, outputTokens: 5 };
    };

    const fiveCases: TestCase[] = Array.from({ length: 5 }, (_, index) => ({
      name: `test-${index}`,
      input: `input-${index}`,
      rubric: 'rubric',
    }));

    await runEval({
      testCases: fiveCases,
      respond,
      judge: makeJudge(true),
      concurrency: 2,
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('generates runId and timestamp', async () => {
    const result = await runEval({
      testCases: [cases[0]],
      respond: makeRespond(),
      judge: makeJudge(true),
    });

    expect(result.runId).toMatch(/^run-\d+$/);
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('handles zero test cases', async () => {
    const result = await runEval({
      testCases: [],
      respond: makeRespond(),
      judge: makeJudge(true),
    });

    expect(result.passRate).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('calculates cost when pricing is provided', async () => {
    const result = await runEval({
      testCases: [cases[0]],
      respond: makeRespond(),
      judge: makeJudge(true),
      pricing: { inputPerMillion: 0.8, outputPerMillion: 4 },
    });

    expect(result.results[0].costUsd).toBeGreaterThan(0);
    expect(result.totalCostUsd).toBeGreaterThan(0);
  });

  it('leaves cost as 0 when pricing is not provided', async () => {
    const result = await runEval({
      testCases: [cases[0]],
      respond: makeRespond(),
      judge: makeJudge(true),
    });

    expect(result.results[0].costUsd).toBe(0);
    expect(result.totalCostUsd).toBe(0);
  });
});
