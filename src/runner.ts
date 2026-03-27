import type { TestCase, TestResult, RunResult, JudgeFn, ResponseFn } from './types.js';
import { calculateCost, type Pricing } from './cost.js';

export interface RunEvalOptions {
  testCases: TestCase[];
  respond: ResponseFn;
  judge: JudgeFn;
  concurrency?: number;
  pricing?: Pricing;
}

export async function runEval(options: RunEvalOptions): Promise<RunResult> {
  const { testCases, respond, judge, concurrency = 3, pricing } = options;
  const runId = `run-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const results: TestResult[] = [];

  const queue = [...testCases];
  const running = new Set<Promise<void>>();

  async function processCase(testCase: TestCase): Promise<void> {
    const start = performance.now();

    const respondResult = await respond(testCase.input);
    const judgeResult = await judge({
      input: testCase.input,
      response: respondResult.response,
      rubric: testCase.rubric,
    });

    const durationMs = Math.round(performance.now() - start);
    const inputTokens = (respondResult.inputTokens ?? 0) + (judgeResult.inputTokens ?? 0);
    const outputTokens = (respondResult.outputTokens ?? 0) + (judgeResult.outputTokens ?? 0);
    const costUsd = pricing ? calculateCost(pricing, inputTokens, outputTokens) : 0;

    results.push({
      name: testCase.name,
      passed: judgeResult.passed,
      score: judgeResult.score,
      reasoning: judgeResult.reasoning,
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
    });
  }

  for (const testCase of queue) {
    if (running.size >= concurrency) {
      await Promise.race(running);
    }
    const promise = processCase(testCase).then(() => {
      running.delete(promise);
    });
    running.add(promise);
  }

  await Promise.all(running);

  const passedCount = results.filter((r) => r.passed).length;
  const totalInputTokens = results.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalOutputTokens = results.reduce((sum, r) => sum + r.outputTokens, 0);
  const totalCostUsd = results.reduce((sum, r) => sum + r.costUsd, 0);

  return {
    runId,
    timestamp,
    passRate: testCases.length > 0 ? passedCount / testCases.length : 0,
    results,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
  };
}
