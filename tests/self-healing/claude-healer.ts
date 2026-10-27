import { spawn } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import type { Expectation, Healer, HealRequest, LocatorSpec, Proposal } from './types';

const MODEL = process.env.HEALER_MODEL ?? 'claude-opus-5-5';
// "api" needs ANTHROPIC_API_KEY or an `ant auth login` profile; "cli" needs a logged-in Claude Code.
const TRANSPORT = process.env.HEALER_TRANSPORT ?? (process.env.ANTHROPIC_API_KEY ? 'api' : 'cli');

const SYSTEM_PROMPT = `You repair broken Playwright locators in an automated UI test.
You get the selector that stopped matching, what the test meant it to find, and the visible elements on the page as JSON.
Suggest replacement locators, best first.

Rules:
- Prefer role + accessible name, then label text, then test id, then exact visible text.
- Use CSS only with a stable id, such as "#loanamount" or "#emiamount span". Never use :nth-child or any other position, and never XPath.
- Only use roles, names, labels, ids and text that appear in the element list. Do not invent attributes.
- If nothing on the page is what the test wanted, return an empty list. An empty list is a correct answer; a near miss is not.
- confidence is your probability, from 0 to 1, that the locator finds exactly the element the test wanted.`;

// Flat on purpose: one object shape for every strategy keeps the schema simple.
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['strategy', 'value', 'role', 'exact', 'confidence', 'reason'],
        properties: {
          strategy: { type: 'string', enum: ['role', 'label', 'text', 'testid', 'css'] },
          value: { type: 'string', description: 'The accessible name, label text, visible text, test id or CSS selector.' },
          role: { type: 'string', description: 'The ARIA role when strategy is "role", otherwise an empty string.' },
          exact: { type: 'boolean' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
      },
    },
  },
};

interface Candidate {
  strategy: LocatorSpec['strategy'];
  value: string;
  role: string;
  exact: boolean;
  confidence: number;
  reason: string;
}

function toSpec({ strategy, value, role, exact }: Candidate): LocatorSpec {
  switch (strategy) {
    case 'role':
      return { strategy, role, name: value, exact };
    case 'label':
    case 'text':
      return { strategy, text: value, exact };
    case 'testid':
      return { strategy, value };
    case 'css':
      return { strategy, selector: value };
  }
}

function describe(expected: Expectation): string {
  const parts = [
    expected.role && `role "${expected.role}"`,
    expected.name && `an accessible name matching ${expected.name}`,
    expected.text && `text matching ${expected.text}`,
    expected.editable && 'it must accept typing',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'no further requirements';
}

export function buildPrompt({ target, step, matches, elements }: HealRequest): string {
  return [
    `Broken selector: ${target.selector}`,
    `It matched ${matches} elements.`,
    `Test step: ${step}`,
    `The test wanted: ${target.intent}`,
    `Requirements: ${describe(target.expect)}`,
    '',
    'Visible elements, one JSON object per line:',
    ...elements.map((element) => JSON.stringify(element)),
  ].join('\n');
}

/** Through the Claude API, e.g. in CI with ANTHROPIC_API_KEY set as a secret. */
async function viaApi(prompt: string): Promise<{ candidates: Candidate[] }> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // If a safety classifier declines, retry on Anthropic's recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal') return { candidates: [] };
  const text = response.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') throw new Error(`No text in the response (stop_reason ${response.stop_reason})`);
  return JSON.parse(text.text);
}

/**
 * Through a local Claude Code install in print mode, so a developer who is
 * logged in to Claude Code needs no API key. Tools, MCP servers, user settings
 * and skills are switched off: they would add tens of thousands of tokens of
 * context that this one-shot question does not need.
 */
function viaClaudeCode(prompt: string): Promise<{ candidates: Candidate[] }> {
  const args = [
    '-p',
    '--model', MODEL,
    '--output-format', 'json',
    '--json-schema', JSON.stringify(RESPONSE_SCHEMA),
    '--system-prompt', SYSTEM_PROMPT,
    '--tools', '',
    '--strict-mcp-config',
    '--setting-sources', 'local',
    '--disable-slash-commands',
    '--no-session-persistence',
  ];
  // CLAUDECODE is set when the tests themselves run inside a Claude Code session.
  const { CLAUDECODE: _nested, ...env } = process.env;

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { env, timeout: 180_000 });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        const result = JSON.parse(stdout);
        if (code !== 0 || result.is_error) throw new Error(result.result ?? `exit code ${code}`);
        resolve(result.structured_output);
      } catch (error) {
        reject(new Error(`claude -p failed: ${error instanceof Error ? error.message : error}\n${stderr || stdout.slice(0, 500)}`));
      }
    });
    child.stdin.end(prompt);
  });
}

export const claudeHealer: Healer = {
  name: `claude (${MODEL} via ${TRANSPORT === 'api' ? 'the Claude API' : 'Claude Code'})`,
  async propose(request: HealRequest): Promise<Proposal[]> {
    const prompt = buildPrompt(request);
    const { candidates } = TRANSPORT === 'api' ? await viaApi(prompt) : await viaClaudeCode(prompt);
    return candidates.map((candidate) => ({ spec: toSpec(candidate), confidence: candidate.confidence, reason: candidate.reason }));
  },
};
