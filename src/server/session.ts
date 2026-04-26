import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

export interface LettaSessionParams {
  conversationId: string;
  agentId: string;
  agentName: string;
  cwd: string;
}

export function readSessionParams(raw: unknown): LettaSessionParams | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const conversationId = obj["conversationId"];
  const agentId = obj["agentId"];
  const cwd = obj["cwd"];

  if (
    typeof conversationId !== "string" || conversationId === "" ||
    typeof agentId !== "string" || agentId === "" ||
    typeof cwd !== "string" || cwd === ""
  ) {
    return null;
  }

  const agentName = typeof obj["agentName"] === "string" ? obj["agentName"] : "";

  return { conversationId, agentId, agentName, cwd };
}

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw: unknown): Record<string, unknown> | null {
    const params = readSessionParams(raw);
    if (params === null) return null;
    return params as unknown as Record<string, unknown>;
  },

  serialize(params: Record<string, unknown> | null): Record<string, unknown> | null {
    return params;
  },

  getDisplayId(params: Record<string, unknown> | null): string | null {
    if (params === null) return null;
    const conversationId = params["conversationId"];
    return typeof conversationId === "string" ? conversationId : null;
  },
};
