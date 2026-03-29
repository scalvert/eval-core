import { z } from 'zod';
import type { JudgeFn } from './types.js';

const JudgeResponseSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(1),
  reasoning: z.string(),
});

export interface AnthropicJudgeConfig {
  apiKey?: string;
  model: string;
  threshold: number;
}

export function createAnthropicJudge(config: AnthropicJudgeConfig): JudgeFn {
  let clientPromise: Promise<InstanceType<typeof import('@anthropic-ai/sdk').default>>;

  return async ({ input, response, rubric }) => {
    if (!clientPromise) {
      clientPromise = import('@anthropic-ai/sdk').then(
        (mod) => new mod.default({ apiKey: config.apiKey })
      );
    }
    const client = await clientPromise;
    const message = await client.messages.create({
      model: config.model,
      max_tokens: 1024,
      system:
        'You are an objective evaluator. Score whether a model response satisfies a rubric. Respond ONLY with JSON: { "pass": boolean, "score": number (0.0–1.0), "reasoning": string }',
      messages: [
        {
          role: 'user',
          content: `Rubric: ${rubric}\n\nUser message: ${input}\n\nResponse to evaluate:\n${response}\n\nDoes this response satisfy the rubric?`,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = parseJudgeResponse(text);

    return {
      passed: parsed.score >= config.threshold,
      score: parsed.score,
      reasoning: parsed.reasoning,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  };
}

function parseJudgeResponse(text: string): {
  pass: boolean;
  score: number;
  reasoning: string;
} {
  let jsonText = text.trim();

  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7);
  }
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3);
  }
  jsonText = jsonText.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const jsonMatch = jsonText.match(/\{[\s\S]*"pass"[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error(`Failed to parse judge response as JSON: ${text}`);
    }
  }

  const result = JudgeResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Judge returned invalid response. Expected {pass, score, reasoning} but got: ${jsonText.slice(0, 500)}\nValidation errors: ${JSON.stringify(result.error.issues)}`
    );
  }
  return result.data;
}
