/**
 * Model selection for every agent.
 *
 * Two tiers so we pay for intelligence only where it moves the needle:
 *   - 'code'   → the stronger model, used by Dev agents writing TypeScript
 *   - 'reason' → the cheaper model, used for planning, review and prose
 *
 * The shared `cacheProviderOptions` turns on Anthropic ephemeral prompt caching
 * so the stable system prompt is billed at 10% on repeat calls within 5 min.
 */
export type Tier = 'code' | 'reason';

export function getModel(tier: Tier) {
  const sonnet = process.env.ANTHROPIC_SONNET ?? 'claude-sonnet-5-5';
  const haiku = process.env.ANTHROPIC_HAIKU ?? 'claude-haiku-5-5';
  const model = tier === 'code' ? sonnet : haiku;
  return `anthropic/${model}` as const;
}

export const cacheProviderOptions = {
  anthropic: {
    cacheControl: { type: 'ephemeral' as const },
  },
};
