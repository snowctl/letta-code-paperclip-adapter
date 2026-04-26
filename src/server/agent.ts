import { Letta } from "@letta-ai/letta-client";

export interface ResolveAgentDeps {
  agentName: string;
  model: string;
  listAgents: (opts: { name: string }) => Promise<Array<{ id: string; name: string }>>;
  createAgent: (opts: { name: string; model?: string }) => Promise<{ id: string }>;
}

export async function resolveAgent(deps: ResolveAgentDeps): Promise<string> {
  const { agentName, model, listAgents, createAgent } = deps;
  const existing = await listAgents({ name: agentName });
  if (existing.length > 0 && existing[0]) {
    return existing[0].id;
  }
  const createOpts: { name: string; model?: string } = { name: agentName };
  if (model) createOpts.model = model;
  const created = await createAgent(createOpts);
  return created.id;
}

export function makeLettaAgentDeps(
  serverUrl: string,
  apiKey: string | undefined,
  agentName: string,
  model: string,
): ResolveAgentDeps {
  const client = new Letta({
    baseURL: serverUrl,
    ...(apiKey ? { apiKey } : {}),
  });
  return {
    agentName,
    model,
    listAgents: async (opts) => {
      const items: Array<{ id: string; name: string }> = [];
      for await (const agent of client.agents.list({ name: opts.name })) {
        items.push({ id: agent.id, name: agent.name });
      }
      return items;
    },
    createAgent: async (opts) => {
      const params: Parameters<InstanceType<typeof Letta>["agents"]["create"]>[0] = { name: opts.name };
      if (opts.model) params.model = opts.model;
      const agent = await client.agents.create(params);
      return { id: agent.id };
    },
  };
}
