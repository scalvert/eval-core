import type { RunResult } from './types.js';

export interface CompareResult {
  passRateDelta: number;
  regressions: string[];
  improvements: string[];
}

export function compareRuns(
  current: RunResult,
  baseline: RunResult
): CompareResult {
  const baselineMap = new Map<string, boolean>();
  for (const r of baseline.results) {
    baselineMap.set(r.name, r.passed);
  }

  const currentMap = new Map<string, boolean>();
  for (const r of current.results) {
    currentMap.set(r.name, r.passed);
  }

  const regressions: string[] = [];
  const improvements: string[] = [];

  for (const [name, currentPassed] of currentMap) {
    const baselinePassed = baselineMap.get(name);
    if (baselinePassed === undefined) continue;
    if (baselinePassed && !currentPassed) regressions.push(name);
    if (!baselinePassed && currentPassed) improvements.push(name);
  }

  return {
    passRateDelta: current.passRate - baseline.passRate,
    regressions,
    improvements,
  };
}
