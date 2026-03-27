import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RunResult } from './types.js';
import { RunResultSchema } from './types.js';

export async function saveBaseline(
  result: RunResult,
  filePath: string
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(result, null, 2), 'utf8');
}

export async function loadBaseline(
  filePath: string
): Promise<RunResult | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return null;
    }
    throw err;
  }

  const parsed = JSON.parse(raw);
  const result = RunResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Malformed baseline file: ${filePath}\nValidation errors: ${JSON.stringify(result.error.issues)}`
    );
  }
  return result.data;
}

export function buildPassMap(result: RunResult): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const r of result.results) {
    map.set(r.name, r.passed);
  }
  return map;
}
