// src/tests/agent.test.ts
import { describe, expect, test, mock } from "bun:test";
import { resolveAgent } from "../server/agent";

// Minimal AgentState shape we depend on
const EXISTING_AGENT = { id: "agent-existing", name: "dev-worker" };
const CREATED_AGENT = { id: "agent-new", name: "dev-worker" };

describe("resolveAgent", () => {
  test("returns existing agent id when agent is found by name", async () => {
    const listAgents = mock(async () => [EXISTING_AGENT]);
    const createAgent = mock(async () => CREATED_AGENT);
    const result = await resolveAgent({
      agentName: "dev-worker",
      model: "",
      listAgents,
      createAgent,
    });
    expect(result).toBe("agent-existing");
    expect(createAgent).not.toHaveBeenCalled();
  });

  test("creates agent when none found and returns new id", async () => {
    const listAgents = mock(async () => []);
    const createAgent = mock(async () => CREATED_AGENT);
    const result = await resolveAgent({
      agentName: "dev-worker",
      model: "gpt-4o",
      listAgents,
      createAgent,
    });
    expect(result).toBe("agent-new");
    expect(createAgent).toHaveBeenCalledWith({ name: "dev-worker", model: "gpt-4o" });
  });

  test("picks first match when multiple agents share a name", async () => {
    const listAgents = mock(async () => [
      { id: "agent-first", name: "dev-worker" },
      { id: "agent-second", name: "dev-worker" },
    ]);
    const createAgent = mock(async () => CREATED_AGENT);
    const result = await resolveAgent({
      agentName: "dev-worker",
      model: "",
      listAgents,
      createAgent,
    });
    expect(result).toBe("agent-first");
  });

  test("creates agent without model when model is empty string", async () => {
    const listAgents = mock(async () => []);
    const createAgent = mock(async () => CREATED_AGENT);
    await resolveAgent({ agentName: "dev-worker", model: "", listAgents, createAgent });
    expect(createAgent).toHaveBeenCalledWith({ name: "dev-worker" });
  });
});
