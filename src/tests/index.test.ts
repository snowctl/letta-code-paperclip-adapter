import { describe, expect, test } from "bun:test";
import { createServerAdapter, type as adapterType } from "../index";

describe("createServerAdapter", () => {
  test("returns a module with required fields", () => {
    const mod = createServerAdapter();
    expect(mod.type).toBe("letta_code");
    expect(typeof mod.execute).toBe("function");
    expect(typeof mod.testEnvironment).toBe("function");
    expect(mod.sessionCodec).toBeDefined();
  });

  test("adapter type constant matches module type", () => {
    expect(adapterType).toBe("letta_code");
  });
});
