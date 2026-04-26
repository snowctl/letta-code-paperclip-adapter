import type { UsageSummary } from "@paperclipai/adapter-utils";

export interface ParsedLettaOutput {
  conversationId: string | null;
  agentId: string | null;
  model: string;
  summary: string;
  usage: UsageSummary | null;
  isError: boolean;
  resultJson: Record<string, unknown> | null;
}

function safeParseJson(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function asStr(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

function asNum(val: unknown, fallback = 0): number {
  return typeof val === "number" && Number.isFinite(val) ? val : fallback;
}

export function parseLettaOutput(stdout: string): ParsedLettaOutput {
  let conversationId: string | null = null;
  let agentId: string | null = null;
  let model = "";
  let resultJson: Record<string, unknown> | null = null;
  const assistantTexts: string[] = [];

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = safeParseJson(line);
    if (!event) continue;

    const type = asStr(event.type);

    if (type === "system" && asStr(event.subtype) === "init") {
      conversationId = asStr(event.conversation_id) || conversationId;
      agentId = asStr(event.agent_id) || agentId;
      model = asStr(event.model) || model;
      continue;
    }

    if (type === "message") {
      const msgType = asStr(event.message_type);
      if (msgType === "assistant_message") {
        const text = asStr(event.text);
        if (text) assistantTexts.push(text);
      }
      conversationId = asStr(event.conversation_id) || conversationId;
      agentId = asStr(event.agent_id) || agentId;
      continue;
    }

    if (type === "result") {
      resultJson = event;
      conversationId = asStr(event.conversation_id) || conversationId;
      agentId = asStr(event.agent_id) || agentId;
      continue;
    }
  }

  if (!resultJson) {
    return {
      conversationId,
      agentId,
      model,
      summary: assistantTexts.join("\n\n").trim(),
      usage: null,
      isError: false,
      resultJson: null,
    };
  }

  const rawUsage = resultJson.usage;
  const usage: UsageSummary | null =
    rawUsage !== null && typeof rawUsage === "object" && !Array.isArray(rawUsage)
      ? {
          inputTokens: asNum((rawUsage as Record<string, unknown>).prompt_tokens),
          outputTokens: asNum((rawUsage as Record<string, unknown>).completion_tokens),
          cachedInputTokens: asNum((rawUsage as Record<string, unknown>).cache_read_input_tokens),
        }
      : null;

  const resultText = typeof resultJson.result === "string" ? resultJson.result.trim() : "";
  const summary = resultText || assistantTexts.join("\n\n").trim();
  const isError = asStr(resultJson.subtype) === "error";

  return { conversationId, agentId, model, summary, usage, isError, resultJson };
}

const UNKNOWN_CONV_RE = /conversation\s+\S+\s+not\s+found|unknown\s+conversation|no\s+conversation\s+found/i;

export function isLettaUnknownConversationError(stdout: string): boolean {
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = safeParseJson(line);
    if (!event) continue;
    if (asStr(event.type) === "error") {
      const msg = asStr(event.message);
      if (UNKNOWN_CONV_RE.test(msg)) return true;
    }
  }
  return false;
}
