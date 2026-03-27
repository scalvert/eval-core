# @scalvert/eval-core

[![CI Build](https://github.com/scalvert/eval-core/actions/workflows/ci-build.yml/badge.svg)](https://github.com/scalvert/eval-core/actions/workflows/ci-build.yml)
[![npm version](https://badge.fury.io/js/%40scalvert%2Feval-core.svg)](https://www.npmjs.com/package/@scalvert/eval-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

General-purpose LLM evaluation primitives. Run test cases against a model, score responses with an LLM judge, and compare results against a saved baseline.

## Installation

```sh
npm install @scalvert/eval-core
```

## Usage

### Running evaluations

The core workflow: provide a `respond` function (calls your model), a `judge` function (scores the response), and a set of test cases.

```typescript
import { runEval, createAnthropicJudge, type ResponseFn } from '@scalvert/eval-core';

const respond: ResponseFn = async (input) => {
  // Call your model here — any provider, any API
  return { response: 'model output', inputTokens: 100, outputTokens: 50 };
};

const judge = createAnthropicJudge({
  model: 'claude-sonnet-4-6',
  threshold: 0.7,
});

const result = await runEval({
  testCases: [{ name: 'greeting', input: 'Say hello', rubric: 'Response is a friendly greeting' }],
  respond,
  judge,
  concurrency: 3,
});

console.log(result.passRate); // 0.0–1.0
```

### Comparing runs against a baseline

```typescript
import { compareRuns, loadBaseline, saveBaseline } from '@scalvert/eval-core';

// Save a run as the baseline
await saveBaseline(result, 'baseline.json');

// Later, compare a new run against it
const baseline = await loadBaseline('baseline.json');
if (baseline) {
  const { passRateDelta, regressions, improvements } = compareRuns(newResult, baseline);
}
```

### Validating test case JSON

```typescript
import { TestCaseSchema } from '@scalvert/eval-core';
import { z } from 'zod';

const testCases = z.array(TestCaseSchema).parse(JSON.parse(rawJson));
```

### Custom judges

`createAnthropicJudge` is a convenience — you can pass any function matching `JudgeFn`:

```typescript
import type { JudgeFn } from '@scalvert/eval-core';

const myJudge: JudgeFn = async ({ input, response, rubric }) => {
  // Your own scoring logic
  return { passed: true, score: 0.95, reasoning: 'Looks good' };
};
```

## API

### `runEval(options)`

Runs test cases with concurrency control, returning a `RunResult` with pass rate, per-case scores, and token usage.

### `createAnthropicJudge(config)`

Factory that returns a `JudgeFn` using the Anthropic messages API. Scores responses against a rubric and applies a threshold.

### `compareRuns(current, baseline)`

Returns `passRateDelta`, `regressions` (names that went from pass to fail), and `improvements` (fail to pass).

### `saveBaseline(result, filePath)` / `loadBaseline(filePath)`

Persist and load `RunResult` objects as JSON. `loadBaseline` returns `null` for missing files and throws on malformed data.

### `buildPassMap(result)`

Returns a `Map<string, boolean>` of test name to pass/fail status.

### `calculateCost(pricing, inputTokens, outputTokens)`

Calculates cost from token counts given a `Pricing` object (`{ inputPerMillion, outputPerMillion }`).

## License

MIT
