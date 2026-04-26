# letta-code-paperclip-adapter

A [Paperclip](https://paperclip.ing) adapter that runs [Letta Code](https://github.com/letta-ai/letta-code) agents as Paperclip workers.

Paperclip spawns the `letta` CLI in headless mode, persists conversation threads across task wakeups, and injects a skill so agents can create Paperclip issues.

## Requirements

- `letta` CLI installed and on `PATH` (`npm install -g @letta-ai/letta-code`)
- A running Letta server (self-hosted or [Letta Cloud](https://letta.com))
- Paperclip server with external adapter support

## Installation

Install as a Paperclip adapter plugin (from the Paperclip board settings), or add to your Paperclip server's plugin directory:

```bash
npm install @letta-ai/letta-code-paperclip-adapter
```

## Adapter Configuration

| Field | Required | Description |
|-------|----------|-------------|
| `lettaServerUrl` | yes | Letta server URL (e.g. `http://localhost:8283`) |
| `lettaApiKey` | no | API key for authenticated Letta deployments |
| `agentName` | yes | Name of the Letta agent — created automatically if absent |
| `model` | no | LLM model for agent creation (e.g. `openai/gpt-4o`) |
| `cwd` | yes | Absolute working directory for the `letta` process |
| `promptTemplate` | no | Paperclip wake prompt template |
| `maxTurns` | no | Max agent turns per run (0 = unlimited) |
| `timeoutSec` | no | Process timeout in seconds (default: 600) |
| `graceSec` | no | Grace period after SIGTERM (default: 15) |
| `env` | no | Extra environment variables for the `letta` process |

## Session Persistence

Each Paperclip task gets a persistent Letta conversation thread. When Paperclip wakes an agent again for the same task (approval callback, nudge, etc.), the adapter resumes the same thread so the agent retains full context of what it has already done.

## License

Apache-2.0
