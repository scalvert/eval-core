import { z } from 'zod';

export interface TestCase {
  name: string;
  input: string;
  rubric: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  score: number;
  reasoning: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface RunResult {
  runId: string;
  timestamp: string;
  passRate: number;
  results: TestResult[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

export type JudgeFn = (options: { input: string; response: string; rubric: string }) => Promise<{
  passed: boolean;
  score: number;
  reasoning: string;
  inputTokens?: number;
  outputTokens?: number;
}>;

export type ResponseFn = (input: string) => Promise<{
  response: string;
  inputTokens?: number;
  outputTokens?: number;
}>;

export const TestCaseSchema = z.object({
  name: z.string(),
  input: z.string(),
  rubric: z.string(),
});

export const TestResultSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  costUsd: z.number(),
  durationMs: z.number(),
});

export const RunResultSchema = z.object({
  runId: z.string(),
  timestamp: z.string(),
  passRate: z.number().min(0).max(1),
  results: z.array(TestResultSchema),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  totalCostUsd: z.number(),
});
