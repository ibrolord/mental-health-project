import * as gemini from './gemini';
import * as claude from './claude';
import type { Message } from './claude';
import type { UserContext } from './context';
import { containsExplicitCrisis, CRISIS_RESPONSE } from './crisis';
import { trimConversationForModel } from './chat-history';

export type ChatModel = 'gemini' | 'claude' | 'safety';
type ModelProvider = Exclude<ChatModel, 'safety'>;

export type ChatRoutingOptions = {
  preferredProvider?: ModelProvider;
  /** Aborts both attempts and skips fallback, e.g. when the client disconnects. */
  signal?: AbortSignal;
  /**
   * Total time for primary plus fallback, measured from the call. Set it below
   * the caller's client timeout. Defaults to CHAT_DEADLINE_MS.
   */
  deadlineMs?: number;
};

function hasProviderCredential(provider: ModelProvider): boolean {
  const value =
    provider === 'gemini'
      ? process.env.GOOGLE_API_KEY
      : process.env.ANTHROPIC_API_KEY;
  return Boolean(value?.trim());
}

function configuredPrimaryProvider(): ModelProvider {
  const configured = process.env.AI_PRIMARY_PROVIDER?.trim().toLowerCase();
  if (configured === 'gemini' || configured === 'claude') {
    if (hasProviderCredential(configured)) return configured;
  }

  if (hasProviderCredential('claude')) return 'claude';
  if (hasProviderCredential('gemini')) return 'gemini';
  throw new Error('No AI provider is configured');
}

/** Upper bound for a single provider attempt, whatever the overall deadline. */
export const PROVIDER_TIMEOUT_MS = 20_000;

/**
 * Default overall deadline (primary + fallback) for text chat. The mobile
 * chat client waits 45s; this leaves room for auth, parsing and network.
 */
export const CHAT_DEADLINE_MS = 38_000;

/** Share of the overall deadline the primary may use when a fallback exists. */
export const PRIMARY_DEADLINE_SHARE = 0.55;

/** A fallback with less time than this left is skipped instead of started. */
export const MIN_FALLBACK_MS = 1_500;

export class ProviderTimeoutError extends Error {
  constructor(provider: ModelProvider, timeoutMs: number) {
    super(`${provider} did not respond within ${timeoutMs}ms`);
    this.name = 'ProviderTimeoutError';
  }
}

/** The caller cancelled (for example the client disconnected). */
export class ChatCancelledError extends Error {
  constructor() {
    super('Chat request was cancelled');
    this.name = 'ChatCancelledError';
  }
}

async function callProvider(
  provider: ModelProvider,
  messages: Message[],
  userContext: UserContext | undefined,
  timeoutMs: number,
  parentSignal?: AbortSignal
): Promise<string> {
  if (parentSignal?.aborted) throw new ChatCancelledError();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onParentAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError(provider, timeoutMs));
    }, timeoutMs);
    onParentAbort = () => {
      controller.abort();
      reject(new ChatCancelledError());
    };
    parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  });
  const call =
    provider === 'gemini'
      ? gemini.chat(messages, userContext, { signal: controller.signal })
      : claude.chat(messages, userContext, { signal: controller.signal });
  // A provider that rejects after the deadline must not surface as unhandled.
  call.catch(() => undefined);
  try {
    const response = await Promise.race([call, deadline]);
    if (typeof response !== 'string' || !response.trim()) {
      throw new Error(`${provider} returned an empty response`);
    }
    return response.trim();
  } finally {
    clearTimeout(timer);
    if (onParentAbort) parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

/**
 * Detects if a conversation requires the more sophisticated Claude model
 * vs the faster/free Gemini model
 */
function requiresClaudeModel(messages: Message[]): boolean {
  const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
  const recentMessages = messages.slice(-3).map(m => m.content.toLowerCase()).join(' ');
  
  // Crisis keywords - always use Claude for safety
  const crisisKeywords = [
    'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
    'self harm', 'self-harm', 'cutting', 'hurt myself',
    'overdose', 'end it all', 'no point living',
  ];
  
  if (crisisKeywords.some(keyword => recentMessages.includes(keyword))) {
    console.log('[Model Router] Crisis detected → Using Claude');
    return true;
  }
  
  // Complex trauma/abuse keywords
  const traumaKeywords = [
    'trauma', 'ptsd', 'abuse', 'assault', 'rape',
    'molest', 'domestic violence', 'flashback',
  ];
  
  if (traumaKeywords.some(keyword => recentMessages.includes(keyword))) {
    console.log('[Model Router] Trauma topic detected → Using Claude');
    return true;
  }
  
  // User explicitly requests deeper help
  const deepHelpPhrases = [
    'i need more help', 'this is serious', 'i\'m really struggling',
    'deeper conversation', 'more thorough', 'i\'m in crisis',
  ];
  
  if (deepHelpPhrases.some(phrase => lastMessage.includes(phrase))) {
    console.log('[Model Router] Deep help requested → Using Claude');
    return true;
  }
  
  // Long conversation (>10 messages) - use Claude for better context handling
  if (messages.length > 10) {
    console.log('[Model Router] Long conversation → Using Claude');
    return true;
  }
  
  console.log('[Model Router] Standard conversation');
  return false;
}

/**
 * Routes chat requests to the appropriate AI model based on conversation complexity
 */
export async function chat(
  messages: Message[],
  userContext?: UserContext,
  options: ChatRoutingOptions = {}
): Promise<{ response: string; model: ChatModel }> {
  // Crisis detection always sees the full, untrimmed conversation.
  if (containsExplicitCrisis(messages)) {
    console.warn('[Model Router] Explicit crisis detected; returning deterministic safety response');
    return { response: CRISIS_RESPONSE, model: 'safety' };
  }

  // Long conversations are trimmed to a budget rather than rejected.
  const modelMessages = trimConversationForModel(messages);
  const prefersClaude = requiresClaudeModel(modelMessages);
  const preferredProvider = options.preferredProvider;
  const primary: ModelProvider =
    prefersClaude && hasProviderCredential('claude')
      ? 'claude'
      : preferredProvider && hasProviderCredential(preferredProvider)
        ? preferredProvider
      : userContext?.appleHealthSummary && hasProviderCredential('gemini')
        ? 'gemini'
      : configuredPrimaryProvider();
  const fallback: ModelProvider = primary === 'claude' ? 'gemini' : 'claude';
  const hasFallback = hasProviderCredential(fallback);

  const { signal } = options;
  const deadlineMs =
    Number.isFinite(options.deadlineMs) && (options.deadlineMs ?? 0) > 0
      ? (options.deadlineMs as number)
      : CHAT_DEADLINE_MS;
  const startedAt = Date.now();
  const remaining = () => deadlineMs - (Date.now() - startedAt);
  // With a fallback available, the primary only gets its share so the
  // fallback can still answer inside the caller's timeout.
  const primaryTimeoutMs = Math.max(
    1,
    Math.min(
      PROVIDER_TIMEOUT_MS,
      hasFallback ? Math.floor(deadlineMs * PRIMARY_DEADLINE_SHARE) : deadlineMs
    )
  );

  try {
    console.log(`[Model Router] Using ${primary}`);
    const response = await callProvider(
      primary,
      modelMessages,
      userContext,
      primaryTimeoutMs,
      signal
    );
    return { response, model: primary };
  } catch (error) {
    if (error instanceof ChatCancelledError || signal?.aborted) {
      throw new ChatCancelledError();
    }
    console.error(`[Model Router] ${primary} failed:`, error);

    const fallbackTimeoutMs = Math.min(PROVIDER_TIMEOUT_MS, remaining());
    if (!hasFallback || fallbackTimeoutMs < MIN_FALLBACK_MS) {
      throw new Error('AI service temporarily unavailable');
    }

    try {
      console.log(`[Model Router] Falling back to ${fallback}`);
      const response = await callProvider(
        fallback,
        modelMessages,
        userContext,
        fallbackTimeoutMs,
        signal
      );
      return { response, model: fallback };
    } catch (fallbackError) {
      if (fallbackError instanceof ChatCancelledError || signal?.aborted) {
        throw new ChatCancelledError();
      }
      console.error('[Model Router] Both models failed:', fallbackError);
      throw new Error('AI service temporarily unavailable');
    }
  }
}
