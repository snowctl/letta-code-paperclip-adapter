// src/tests/execute.test.ts
import { describe, test } from "bun:test";
import { execute } from "../server/execute";

describe("execute export", () => {
  test("execute is a function", () => {
    if (typeof execute !== "function") throw new Error("execute must be a function");
  });
});
