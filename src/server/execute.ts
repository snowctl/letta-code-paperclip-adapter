import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  parseObject,
  buildPaperclipEnv,
  runChildProcess,
  ensureAbsoluteDirectory,
  ensurePathInEnv,
  renderTemplate,
} from "@paperclipai/adapter-utils/server-utils";
import { makeLettaAgentDeps, resolveAgent } from "./agent.js";
import { parseLettaOutput, isLettaUnknownConversationError } from "./parse.js";
import { readSessionParams } from "./session.js";

const DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE =
  "You are an expert software engineering agent. Complete the task in the current workspace.\n\nContext:\n- Run ID: {{runId}}\n- Agent ID: {{agentId}}\n- Company ID: {{companyId}}";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_SOURCE_DIR = path.resolve(__moduleDir, "../skills");

async function buildSkillsDir(): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-letta-skills-"));
  const entries = await fs.readdir(SKILLS_SOURCE_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await fs.symlink(
        path.join(SKILLS_SOURCE_DIR, entry.name),
        path.join(tmp, entry.name),
      );
    }
  }
  return tmp;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, onSpawn, authToken } = ctx;

  const lettaServerUrl = asString(config.lettaServerUrl, "");
  const lettaApiKey = asString(config.lettaApiKey, "");
  const agentName = asString(config.agentName, "");
  const model = asString(config.model, "");
  const cwd = asString(config.cwd, process.cwd());
  const timeoutSec = asNumber(config.timeoutSec, 600);
  const graceSec = asNumber(config.graceSec, 15);
  const maxTurns = asNumber(config.maxTurns, 0);
  const promptTemplate = asString(config.promptTemplate, DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE);
  const envConfig = parseObject(config.env);

  await ensureAbsoluteDirectory(cwd, { createIfMissing: false });

  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  env.PAPERCLIP_RUN_ID = runId;
  if (lettaServerUrl) env.LETTA_BASE_URL = lettaServerUrl;
  if (lettaApiKey) env.LETTA_API_KEY = lettaApiKey;

  const taskId = (typeof context.taskId === "string" && context.taskId) || null;
  const wakeReason = typeof context.wakeReason === "string" && context.wakeReason ? context.wakeReason : null;
  const approvalId = typeof context.approvalId === "string" && context.approvalId ? context.approvalId : null;
  const approvalStatus = typeof context.approvalStatus === "string" && context.approvalStatus ? context.approvalStatus : null;

  if (taskId) env.PAPERCLIP_TASK_ID = taskId;
  if (wakeReason) env.PAPERCLIP_WAKE_REASON = wakeReason;
  if (approvalId) env.PAPERCLIP_APPROVAL_ID = approvalId;
  if (approvalStatus) env.PAPERCLIP_APPROVAL_STATUS = approvalStatus;
  if (authToken) env.PAPERCLIP_API_KEY = authToken;

  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }

  const effectiveEnv = ensurePathInEnv({ ...process.env, ...env }) as Record<string, string>;

  const sessionParams = readSessionParams(runtime.sessionParams);
  let agentId: string;
  if (sessionParams?.agentId) {
    agentId = sessionParams.agentId;
  } else {
    const deps = makeLettaAgentDeps(lettaServerUrl, lettaApiKey || undefined, agentName, model);
    agentId = await resolveAgent(deps);
  }

  const canResume =
    Boolean(sessionParams?.conversationId) &&
    Boolean(sessionParams?.cwd) &&
    path.resolve(sessionParams!.cwd) === path.resolve(cwd);
  const conversationId = canResume ? sessionParams!.conversationId : null;

  if (sessionParams?.conversationId && !canResume) {
    await onLog(
      "stdout",
      `[paperclip] Letta conversation "${sessionParams.conversationId}" was for cwd "${sessionParams.cwd}" and will not be resumed in "${cwd}".\n`,
    );
  }

  const templateData: Record<string, unknown> = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId },
    context,
  };
  const prompt = renderTemplate(promptTemplate, templateData).trim();

  let skillsDir: string | null = null;
  try {
    skillsDir = await buildSkillsDir();
  } catch {
    await onLog("stderr", "[paperclip] Warning: could not prepare skills directory.\n");
  }

  const buildArgs = (resumeConvId: string | null): string[] => {
    const args = ["-p", prompt, "--output-format", "stream-json", "--agent", agentId];
    if (resumeConvId) args.push("--conversation", resumeConvId);
    if (maxTurns > 0) args.push("--max-turns", String(maxTurns));
    if (skillsDir) args.push("--skills", skillsDir);
    return args;
  };

  if (onMeta) {
    await onMeta({
      adapterType: "letta_code",
      command: "letta",
      cwd,
      commandArgs: buildArgs(conversationId),
      env: Object.fromEntries(
        Object.entries(env).map(([k, v]) =>
          /key|token|secret|password|authorization|cookie/i.test(k) ? [k, "[redacted]"] : [k, v],
        ),
      ),
      prompt,
      context,
    });
  }

  const runAttempt = async (resumeConvId: string | null) => {
    const args = buildArgs(resumeConvId);
    return runChildProcess(runId, "letta", args, {
      cwd,
      env: effectiveEnv,
      timeoutSec,
      graceSec,
      onLog,
      onSpawn,
    });
  };

  try {
    const proc = await runAttempt(conversationId);
    const parsed = parseLettaOutput(proc.stdout);

    if (
      conversationId &&
      !proc.timedOut &&
      (proc.exitCode ?? 0) !== 0 &&
      isLettaUnknownConversationError(proc.stdout)
    ) {
      await onLog(
        "stdout",
        `[paperclip] Letta conversation "${conversationId}" not found; retrying with a fresh conversation.\n`,
      );
      const retry = await runAttempt(null);
      const retryParsed = parseLettaOutput(retry.stdout);
      return toResult(retry, retryParsed, agentId, agentName, cwd, { clearSession: true });
    }

    return toResult(proc, parsed, agentId, agentName, cwd, { clearSession: false });
  } finally {
    if (skillsDir) {
      await fs.rm(skillsDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function toResult(
  proc: { exitCode: number | null; signal: string | null; timedOut: boolean; stderr: string },
  parsed: ReturnType<typeof parseLettaOutput>,
  agentId: string,
  agentName: string,
  cwd: string,
  opts: { clearSession: boolean },
): AdapterExecutionResult {
  if (proc.timedOut) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: true,
      errorMessage: "letta process timed out",
      clearSession: false,
    };
  }

  const failed = (proc.exitCode ?? 0) !== 0 || parsed.isError;
  const errorMessage = failed
    ? parsed.summary || proc.stderr.split(/\r?\n/).find(Boolean) || `letta exited with code ${proc.exitCode ?? -1}`
    : null;

  const newSessionParams: Record<string, unknown> | null =
    parsed.conversationId
      ? { conversationId: parsed.conversationId, agentId, agentName, cwd }
      : null;

  return {
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: false,
    errorMessage,
    usage: parsed.usage ?? undefined,
    sessionParams: newSessionParams,
    sessionDisplayId: parsed.conversationId ?? null,
    model: parsed.model || null,
    provider: "letta",
    summary: parsed.summary || null,
    resultJson: parsed.resultJson ?? null,
    clearSession: opts.clearSession,
  };
}
