import type { TranscriptEntry } from "@paperclipai/adapter-utils";

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

function str(val: unknown, fallback = ""): string {
  return typeof val === "string" ? val : fallback;
}

function num(val: unknown, fallback = 0): number {
  return typeof val === "number" && Number.isFinite(val) ? val : fallback;
}

export function parseLettaStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const event = safeParseJson(trimmed);
  if (!event) {
    return [{ kind: "stdout", ts, text: trimmed }];
  }

  const type = str(event.type);

  if (type === "system" && str(event.subtype) === "init") {
    return [{ kind: "init", ts, model: str(event.model), sessionId: str(event.conversation_id) }];
  }

  if (type === "message") {
    const msgType = str(event.message_type);

    if (msgType === "assistant_message") {
      const text = str(event.text);
      if (!text) return [];
      return [{ kind: "assistant", ts, text }];
    }

    if (msgType === "reasoning_message") {
      const text = str(event.reasoning);
      if (!text) return [];
      return [{ kind: "thinking", ts, text }];
    }

    if (msgType === "tool_call" || msgType === "tool_calls") {
      const toolCall = event.tool_call as Record<string, unknown> | undefined;
      if (!toolCall) return [];
      let input: unknown = toolCall.arguments;
      if (typeof input === "string") {
        try {
          input = JSON.parse(input);
        } catch {
          // keep as string
        }
      }
      return [{ kind: "tool_call", ts, name: str(toolCall.name), input, toolUseId: str(toolCall.id) }];
    }

    if (msgType === "tool_return" || msgType === "tool_return_message") {
      const content = str(event.tool_return);
      const isError = str(event.status) === "error";
      return [{ kind: "tool_result", ts, toolUseId: str(event.tool_call_id), content, isError }];
    }

    return [];
  }

  if (type === "result") {
    const usage = event.usage as Record<string, unknown> | null | undefined;
    const inputTokens = usage ? num(usage.prompt_tokens) : 0;
    const outputTokens = usage ? num(usage.completion_tokens) : 0;
    const cachedTokens = usage ? num(usage.cache_read_input_tokens) : 0;
    const isError = str(event.subtype) === "error";
    const text = str(event.result);
    return [
      {
        kind: "result",
        ts,
        text,
        inputTokens,
        outputTokens,
        cachedTokens,
        costUsd: 0,
        subtype: str(event.subtype, "success"),
        isError,
        errors: [],
      },
    ];
  }

  if (type === "error") {
    return [{ kind: "stderr", ts, text: str(event.message) }];
  }

  return [{ kind: "stdout", ts, text: trimmed }];
}
