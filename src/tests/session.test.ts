// src/tests/session.test.ts
import { describe, expect, test } from "bun:test";
import { sessionCodec } from "../server/session";

const VALID_PARAMS = {
  conversationId: "conv-abc",
  agentId: "agent-123",
  agentName: "dev-worker",
  cwd: "/home/user/project",
};

describe("sessionCodec.serialize", () => {
  test("returns the params object as-is when all fields present", () => {
    expect(sessionCodec.serialize(VALID_PARAMS)).toEqual(VALID_PARAMS);
  });

  test("returns null when params is null", () => {
    expect(sessionCodec.serialize(null)).toBeNull();
  });
});

describe("sessionCodec.deserialize", () => {
  test("returns params when all required fields are strings", () => {
    const result = sessionCodec.deserialize(VALID_PARAMS);
    expect(result).toEqual(VALID_PARAMS);
  });

  test("returns null when conversationId is missing", () => {
    const { conversationId: _, ...rest } = VALID_PARAMS;
    expect(sessionCodec.deserialize(rest)).toBeNull();
  });

  test("returns null when agentId is missing", () => {
    const { agentId: _, ...rest } = VALID_PARAMS;
    expect(sessionCodec.deserialize(rest)).toBeNull();
  });

  test("returns null when cwd is missing", () => {
    const { cwd: _, ...rest } = VALID_PARAMS;
    expect(sessionCodec.deserialize(rest)).toBeNull();
  });

  test("returns null for non-object input", () => {
    expect(sessionCodec.deserialize(null)).toBeNull();
    expect(sessionCodec.deserialize("string")).toBeNull();
    expect(sessionCodec.deserialize(42)).toBeNull();
  });
});

describe("sessionCodec.getDisplayId", () => {
  test("returns conversationId", () => {
    expect(sessionCodec.getDisplayId?.(VALID_PARAMS)).toBe("conv-abc");
  });

  test("returns null when params is null", () => {
    expect(sessionCodec.getDisplayId?.(null)).toBeNull();
  });
});
