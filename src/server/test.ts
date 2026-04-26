import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";
import { stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";

export interface RunEnvironmentChecksDeps {
  lettaServerUrl: string;
  agentName: string;
  cwd: string;
  checkBinary: () => Promise<boolean>;
  checkServerReachable: () => Promise<boolean>;
  checkPathExists: () => Promise<boolean>;
}

export interface RunEnvironmentChecksResult {
  status: "pass" | "warn" | "fail";
  checks: AdapterEnvironmentCheck[];
}

export async function runEnvironmentChecks(
  deps: RunEnvironmentChecksDeps,
): Promise<RunEnvironmentChecksResult> {
  const { lettaServerUrl, agentName, cwd, checkBinary, checkServerReachable, checkPathExists } =
    deps;
  const checks: AdapterEnvironmentCheck[] = [];

  // Check: server URL configured
  if (!lettaServerUrl) {
    checks.push({
      code: "server_url_configured",
      level: "error",
      message: "Letta server URL is not configured.",
      detail: "Set the lettaServerUrl config field to the URL of your Letta server.",
      hint: "Example: http://localhost:8283",
    });
  } else {
    checks.push({
      code: "server_url_configured",
      level: "info",
      message: `Letta server URL is configured: ${lettaServerUrl}`,
    });
  }

  // Check: agent name configured
  if (!agentName) {
    checks.push({
      code: "agent_name_configured",
      level: "error",
      message: "Agent name is not configured.",
      detail: "Set the agentName config field to the name of your Letta agent.",
      hint: "Example: dev-worker",
    });
  } else {
    checks.push({
      code: "agent_name_configured",
      level: "info",
      message: `Agent name is configured: ${agentName}`,
    });
  }

  // Check: letta binary available
  const binaryFound = await checkBinary();
  if (!binaryFound) {
    checks.push({
      code: "letta_binary",
      level: "error",
      message: "The 'letta' binary was not found in PATH.",
      detail: "Install letta: https://docs.letta.com/install",
      hint: "Run: pip install letta",
    });
  } else {
    checks.push({
      code: "letta_binary",
      level: "info",
      message: "The 'letta' binary is available.",
    });
  }

  // Check: server reachable (only if URL is configured)
  if (lettaServerUrl) {
    const reachable = await checkServerReachable();
    if (!reachable) {
      checks.push({
        code: "server_reachable",
        level: "error",
        message: `Letta server is not reachable at ${lettaServerUrl}.`,
        detail: "Ensure the Letta server is running and accessible.",
        hint: "Run: letta server",
      });
    } else {
      checks.push({
        code: "server_reachable",
        level: "info",
        message: `Letta server is reachable at ${lettaServerUrl}.`,
      });
    }
  } else {
    checks.push({
      code: "server_reachable",
      level: "error",
      message: "Cannot check server reachability — server URL is not configured.",
    });
  }

  // Check: cwd exists
  const pathExists = await checkPathExists();
  if (!pathExists) {
    checks.push({
      code: "cwd_valid",
      level: "error",
      message: `Working directory does not exist: ${cwd}`,
      detail: "Ensure the configured working directory exists on disk.",
    });
  } else {
    checks.push({
      code: "cwd_valid",
      level: "info",
      message: `Working directory exists: ${cwd}`,
    });
  }

  // Derive status
  const hasError = checks.some((c) => c.level === "error");
  const hasWarn = checks.some((c) => c.level === "warn");
  const status: "pass" | "warn" | "fail" = hasError ? "fail" : hasWarn ? "warn" : "pass";

  return { status, checks };
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const config = ctx.config;
  const lettaServerUrl = asString(config["lettaServerUrl"], "");
  const agentName = asString(config["agentName"], "");
  const cwd = asString(config["cwd"], process.cwd());

  const result = await runEnvironmentChecks({
    lettaServerUrl,
    agentName,
    cwd,
    checkBinary: async () => {
      try {
        const r = spawnSync("letta", ["--version"], { timeout: 5000 });
        return r.status === 0;
      } catch {
        return false;
      }
    },
    checkServerReachable: async () => {
      try {
        const res = await fetch(`${lettaServerUrl}/v1/agents`, {
          signal: AbortSignal.timeout(5000),
        });
        return res.ok || res.status < 500;
      } catch {
        return false;
      }
    },
    checkPathExists: async () => {
      try {
        await stat(cwd);
        return true;
      } catch {
        return false;
      }
    },
  });

  return {
    adapterType: ctx.adapterType,
    status: result.status,
    checks: result.checks,
    testedAt: new Date().toISOString(),
  };
}
