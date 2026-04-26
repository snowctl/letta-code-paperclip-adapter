import { describe, expect, test } from "bun:test";
import { parseLettaStdoutLine } from "../ui/parse-stdout";

const TS = "2026-04-25T12:00:00.000Z";

describe("parseLettaStdoutLine", () => {
  test("system/init → init entry with model and conversationId as sessionId", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
      session_id: "s1",
      uuid: "u1",
      agent_id: "a1",
      conversation_id: "conv-abc",
      model: "gpt-4o",
      tools: [],
      cwd: "/tmp",
      mcp_servers: [],
      permission_mode: "auto",
      slash_commands: [],
    });
    const entries = parseLettaStdoutLine(line, TS);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("init");
    if (entries[0]?.kind === "init") {
      expect(entries[0].model).toBe("gpt-4o");
      expect(entries[0].sessionId).toBe("conv-abc");
    }
  });

  test("assistant message → assistant entry", () => {
    const line = JSON.stringify({
      type: "message",
      message_type: "assistant_message",
      session_id: "s1",
      uuid: "u2",
      agent_id: "a1",
      conversation_id: "conv-abc",
      text: "Hello, I will complete the task.",
    });
    const entries = parseLettaStdoutLine(line, TS);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("assistant");
    if (entries[0]?.kind === "assistant") {
      expect(entries[0].text).toBe("Hello, I will complete the task.");
    }
  });

  test("reasoning message → thinking entry", () => {
    const line = JSON.stringify({
      type: "message",
      message_type: "reasoning_message",
      session_id: "s1",
      uuid: "u3",
      agent_id: "a1",
      conversation_id: "conv-abc",
      reasoning: "Let me think about this...",
    });
    const entries = parseLettaStdoutLine(line, TS);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("thinking");
  });

  test("tool_call message → tool_call entry", () => {
    const line = JSON.stringify({
      type: "message",
      message_type: "tool_call",
      session_id: "s1",
      uuid: "u4",
      agent_id: "a1",
      conversation_id: "conv-abc",
      tool_call: { id: "tc1", name: "read_file", arguments: "{\"path\":\"/foo\"}" },
    });
    const entries = parseLettaStdoutLine(line, TS);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("tool_call");
    if (entries[0]?.kind === "tool_call") {
      expect(entries[0].name).toBe("read_file");
    }
  });

  test("tool_return message → tool_result entry", () => {
    const line = JSON.stringify({
      type: "message",
      message_type: "tool_return",
      session_id: "s1",
      uuid: "u5",
      agent_id: "a1",
      conversation_id: "conv-abc",
      tool_return: "file contents here",
      status: "success",
      tool_call_id: "tc1",
    });
    const entries = parseLettaStdoutLine(line, TS);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("tool_result");
    if (entries[0]?.kind === "tool_result") {
      expect(entries[0].isError).toBe(false);
    }
  });

  test("result event → result entry with usage", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      session_id: "s1",
      uuid: "u6",
      agent_id: "a1",
      conversation_id: "conv-abc",
      duration_ms: 1000,
      duration_api_ms: 900,
      num_turns: 3,
      result: "Task done.",
      run_ids: [],
      usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
    });
    const entries = parseLettaStdoutLine(line, TS);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("result");
    if (entries[0]?.kind === "result") {
      expect(entries[0].inputTokens).toBe(100);
      expect(entries[0].outputTokens).toBe(40);
      expect(entries[0].isError).toBe(false);
    }
  });

  test("unparseable line → stdout fallback entry", () => {
    const entries = parseLettaStdoutLine("not json at all", TS);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe("stdout");
  });

  test("empty line → empty array", () => {
    expect(parseLettaStdoutLine("", TS)).toHaveLength(0);
    expect(parseLettaStdoutLine("   ", TS)).toHaveLength(0);
  });
});
