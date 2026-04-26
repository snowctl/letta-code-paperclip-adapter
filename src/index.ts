import type { ServerAdapterModule } from "@paperclipai/adapter-utils";
import { execute } from "./server/execute.js";
import { testEnvironment } from "./server/test.js";
import { sessionCodec } from "./server/session.js";

export const type = "letta_code";
export const label = "Letta Code (local)";

export const models = [
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "anthropic/claude-opus-4-7-20251101", label: "Claude Opus 4.7" },
  { id: "anthropic/claude-sonnet-4-6-20251114", label: "Claude Sonnet 4.6" },
];

export const agentConfigurationDoc = `# letta_code agent configuration

Adapter: letta_code

Use when:
- You need a stateful Letta agent with persistent memory across task wakeups
- The agent should maintain conversation context between Paperclip heartbeats
- The task requires long-running work with Letta's tool-calling capabilities

Don't use when:
- You need a simple one-shot script (use the "process" adapter instead)
- No Letta server is available on the host
- You want a stateless agent without cross-run memory

Core fields:
- lettaServerUrl (string, required): URL of the Letta server, e.g. "http://localhost:8283"
- lettaApiKey (string, optional): API key for authenticated Letta server deployments
- agentName (string, required): Name of the Letta agent to use; created automatically if it doesn't exist
- model (string, optional): LLM model ID for agent creation only (e.g. "openai/gpt-4o"). Ignored if the agent already exists.
- cwd (string, required): Absolute path to the working directory for the letta process
- promptTemplate (string, optional): Paperclip wake prompt template.
- maxTurns (number, optional): Maximum agent turns per run. 0 = unlimited.
- timeoutSec (number, optional, default 600): Hard process timeout in seconds.
- graceSec (number, optional, default 15): Grace period after SIGTERM before SIGKILL.
- env (object, optional): Additional environment variables injected into the letta process.
`;

export function createServerAdapter(): ServerAdapterModule {
  return {
    type,
    execute,
    testEnvironment,
    sessionCodec,
    models,
    agentConfigurationDoc,
    supportsLocalAgentJwt: true,
  };
}
