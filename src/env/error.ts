import type { ZodError } from "zod";

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

export function formatEnvError(error: ZodError): string {
  const lines = error.issues.map((issue) => {
    const name = issue.path.map(String).join(".") || "environment";
    return `  - ${name}: ${issue.message}`;
  });

  return [
    "OriginLedger environment is invalid.",
    "Missing or invalid:",
    ...lines,
    "Copy .env.example to .env.local and set the required values. Do not commit secrets.",
  ].join("\n");
}
