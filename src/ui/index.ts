import { parseLettaStdoutLine } from "./parse-stdout.js";

export { parseLettaStdoutLine };

export const adapterUiParser = {
  version: "1" as const,
  parseStdoutLine: parseLettaStdoutLine,
};
