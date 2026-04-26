import { describe, expect, test } from "bun:test";
import { runEnvironmentChecks } from "../server/test";

describe("runEnvironmentChecks", () => {
  test("returns error check when lettaServerUrl is empty", async () => {
    const result = await runEnvironmentChecks({
      lettaServerUrl: "",
      agentName: "dev-worker",
      cwd: "/tmp",
      checkBinary: async () => true,
      checkServerReachable: async () => true,
      checkPathExists: async () => true,
    });
    const check = result.checks.find((c) => c.code === "server_url_configured");
    expect(check?.level).toBe("error");
    expect(result.status).toBe("fail");
  });

  test("returns error check when letta binary not found", async () => {
    const result = await runEnvironmentChecks({
      lettaServerUrl: "http://localhost:8283",
      agentName: "dev-worker",
      cwd: "/tmp",
      checkBinary: async () => false,
      checkServerReachable: async () => true,
      checkPathExists: async () => true,
    });
    const check = result.checks.find((c) => c.code === "letta_binary");
    expect(check?.level).toBe("error");
    expect(result.status).toBe("fail");
  });

  test("returns error check when server unreachable", async () => {
    const result = await runEnvironmentChecks({
      lettaServerUrl: "http://localhost:8283",
      agentName: "dev-worker",
      cwd: "/tmp",
      checkBinary: async () => true,
      checkServerReachable: async () => false,
      checkPathExists: async () => true,
    });
    const check = result.checks.find((c) => c.code === "server_reachable");
    expect(check?.level).toBe("error");
    expect(result.status).toBe("fail");
  });

  test("returns error when agentName is empty", async () => {
    const result = await runEnvironmentChecks({
      lettaServerUrl: "http://localhost:8283",
      agentName: "",
      cwd: "/tmp",
      checkBinary: async () => true,
      checkServerReachable: async () => true,
      checkPathExists: async () => true,
    });
    const check = result.checks.find((c) => c.code === "agent_name_configured");
    expect(check?.level).toBe("error");
  });

  test("returns error when cwd does not exist", async () => {
    const result = await runEnvironmentChecks({
      lettaServerUrl: "http://localhost:8283",
      agentName: "dev-worker",
      cwd: "/tmp",
      checkBinary: async () => true,
      checkServerReachable: async () => true,
      checkPathExists: async () => false,
    });
    const check = result.checks.find((c) => c.code === "cwd_valid");
    expect(check?.level).toBe("error");
  });

  test("returns pass status when all checks pass", async () => {
    const result = await runEnvironmentChecks({
      lettaServerUrl: "http://localhost:8283",
      agentName: "dev-worker",
      cwd: "/tmp",
      checkBinary: async () => true,
      checkServerReachable: async () => true,
      checkPathExists: async () => true,
    });
    expect(result.status).toBe("pass");
    expect(result.checks.every((c) => c.level === "info")).toBe(true);
  });
});
