// src/tests/parse.test.ts
import { describe, expect, test } from "bun:test";
import { parseLettaOutput, isLettaUnknownConversationError } from "../server/parse";

const INIT_LINE = JSON.stringify({
  type: "system",
  subtype: "init",
  session_id: "sess-1",
  uuid: "u1",
  agent_id: "agent-abc",
  conversation_id: "conv-xyz",
  model: "gpt-4o",
  tools: [],
  cwd: "/tmp",
  mcp_servers: [],
  permission_mode: "auto",
  slash_commands: [],
});

const ASSISTANT_LINE = JSON.stringify({
  type: "message",
  message_type: "assistant_message",
  session_id: "sess-1",
  uuid: "u2",
  agent_id: "agent-abc",
  conversation_id: "conv-xyz",
  text: "I will complete the task.",
});

const RESULT_LINE = JSON.stringify({
  type: "result",
  subtype: "success",
  session_id: "sess-1",
  uuid: "u3",
  agent_id: "agent-abc",
  conversation_id: "conv-xyz",
  duration_ms: 2000,
  duration_api_ms: 1800,
  num_turns: 2,
  result: "Done.",
  run_ids: ["run-1"],
  usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
});

const UNKNOWN_CONV_ERROR_LINE = JSON.stringify({
  type: "error",
  message: "Conversation conv-999 not found",
  stop_reason: "error",
  session_id: "sess-err",
  uuid: "u-err",
  agent_id: "agent-abc",
  conversation_id: "conv-999",
});

describe("parseLettaOutput", () => {
  test("extracts conversationId and agentId from system/init", () => {
    const result = parseLettaOutput([INIT_LINE, RESULT_LINE].join("\n"));
    expect(result.conversationId).toBe("conv-xyz");
    expect(result.agentId).toBe("agent-abc");
  });

  test("extracts model from system/init", () => {
    const result = parseLettaOutput([INIT_LINE, RESULT_LINE].join("\n"));
    expect(result.model).toBe("gpt-4o");
  });

  test("accumulates assistant text as summary", () => {
    const result = parseLettaOutput([INIT_LINE, ASSISTANT_LINE, RESULT_LINE].join("\n"));
    expect(result.summary).toBe("Done.");
  });

  test("falls back to assistant text if result.result is null", () => {
    const resultLineNoText = JSON.stringify({
      ...JSON.parse(RESULT_LINE),
      result: null,
    });
    const result = parseLettaOutput([INIT_LINE, ASSISTANT_LINE, resultLineNoText].join("\n"));
    expect(result.summary).toBe("I will complete the task.");
  });

  test("extracts usage tokens from result", () => {
    const result = parseLettaOutput([INIT_LINE, RESULT_LINE].join("\n"));
    expect(result.usage?.inputTokens).toBe(100);
    expect(result.usage?.outputTokens).toBe(50);
  });

  test("isError is false for success subtype", () => {
    const result = parseLettaOutput([INIT_LINE, RESULT_LINE].join("\n"));
    expect(result.isError).toBe(false);
  });

  test("isError is true for error subtype", () => {
    const errorResult = JSON.stringify({ ...JSON.parse(RESULT_LINE), subtype: "error" });
    const result = parseLettaOutput([INIT_LINE, errorResult].join("\n"));
    expect(result.isError).toBe(true);
  });

  test("handles empty stdout gracefully", () => {
    const result = parseLettaOutput("");
    expect(result.conversationId).toBeNull();
    expect(result.usage).toBeNull();
    expect(result.isError).toBe(false);
  });

  test("skips unparseable lines", () => {
    const stdout = [INIT_LINE, "not json", RESULT_LINE].join("\n");
    const result = parseLettaOutput(stdout);
    expect(result.conversationId).toBe("conv-xyz");
  });
});

describe("isLettaUnknownConversationError", () => {
  test("returns true when error message mentions conversation not found", () => {
    expect(isLettaUnknownConversationError(UNKNOWN_CONV_ERROR_LINE)).toBe(true);
  });

  test("returns false for normal output", () => {
    expect(isLettaUnknownConversationError([INIT_LINE, RESULT_LINE].join("\n"))).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isLettaUnknownConversationError("")).toBe(false);
  });
});
