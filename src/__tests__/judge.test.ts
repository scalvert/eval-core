import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnthropicJudge } from '../judge.js';

const createMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

const DEFAULT_USAGE = { input_tokens: 100, output_tokens: 50 };

function mockResponse(
  json: object,
  usage: { input_tokens: number; output_tokens: number } = DEFAULT_USAGE
) {
  createMock.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(json) }],
    usage,
  });
}

describe('createAnthropicJudge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns passed=true when score >= threshold', async () => {
    mockResponse({ pass: true, score: 0.8, reasoning: 'Good' });
    const judge = createAnthropicJudge({ model: 'claude-sonnet-4-6', threshold: 0.7 });
    const result = await judge({ input: 'hi', response: 'hello', rubric: 'be polite' });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(0.8);
  });

  it('returns passed=false when score < threshold', async () => {
    mockResponse({ pass: true, score: 0.5, reasoning: 'Meh' });
    const judge = createAnthropicJudge({ model: 'claude-sonnet-4-6', threshold: 0.7 });
    const result = await judge({ input: 'hi', response: 'go away', rubric: 'be polite' });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0.5);
  });

  it('strips ```json fences', async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '```json\n{"pass": true, "score": 0.9, "reasoning": "ok"}\n```',
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const judge = createAnthropicJudge({ model: 'claude-sonnet-4-6', threshold: 0.5 });
    const result = await judge({ input: 'x', response: 'y', rubric: 'z' });
    expect(result.score).toBe(0.9);
  });

  it('strips bare ``` fences', async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '```\n{"pass": true, "score": 0.7, "reasoning": "fine"}\n```',
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const judge = createAnthropicJudge({ model: 'claude-sonnet-4-6', threshold: 0.5 });
    const result = await judge({ input: 'x', response: 'y', rubric: 'z' });
    expect(result.score).toBe(0.7);
  });

  it('throws on malformed JSON', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json at all' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const judge = createAnthropicJudge({ model: 'claude-sonnet-4-6', threshold: 0.5 });
    await expect(judge({ input: 'x', response: 'y', rubric: 'z' })).rejects.toThrow(
      'Failed to parse judge response as JSON'
    );
  });

  it('throws on invalid schema (missing reasoning)', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"pass": true, "score": 0.8}' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const judge = createAnthropicJudge({ model: 'claude-sonnet-4-6', threshold: 0.5 });
    await expect(judge({ input: 'x', response: 'y', rubric: 'z' })).rejects.toThrow(
      'Judge returned invalid response'
    );
  });

  it('returns token counts from the API response', async () => {
    mockResponse(
      { pass: true, score: 0.9, reasoning: 'great' },
      { input_tokens: 200, output_tokens: 75 }
    );
    const judge = createAnthropicJudge({ model: 'claude-sonnet-4-6', threshold: 0.5 });
    const result = await judge({ input: 'x', response: 'y', rubric: 'z' });
    expect(result.inputTokens).toBe(200);
    expect(result.outputTokens).toBe(75);
  });
});
