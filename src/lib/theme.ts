import type { SessionStatus } from "@codeoid/protocol";

/** Shared palette — terminal-adjacent dark UI, consistent across screens. */
export const palette = {
  bg: "#0d1117",
  surface: "#161b22",
  border: "#30363d",
  text: "#e6edf3",
  textDim: "#8a8f98",
  accent: "#58a6ff",
  green: "#3fb950",
  amber: "#d29922",
  red: "#f85149",
} as const;

/** Status → indicator color, mirroring the web UI's semantics. */
export function statusColor(status: SessionStatus): string {
  switch (status) {
    case "thinking":
    case "tool_running":
      return palette.amber;
    case "waiting_approval":
    case "error":
      return palette.red;
    case "idle":
    default:
      return palette.green;
  }
}
