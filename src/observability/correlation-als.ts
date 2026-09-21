import { AsyncLocalStorage } from "node:async_hooks";
import {
  generateCorrelationId,
  isValidCorrelationId,
  resolveCorrelationId,
} from "./correlation";

type CorrelationStore = {
  correlationId: string;
};

const storage = new AsyncLocalStorage<CorrelationStore>();

export function withCorrelation<T>(correlationId: string, run: () => T): T {
  const id = isValidCorrelationId(correlationId)
    ? correlationId
    : generateCorrelationId();
  return storage.run({ correlationId: id }, run);
}

export function getStoredCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function correlationFromHeaders(
  headers: Headers | { get(name: string): string | null },
): string {
  return resolveCorrelationId(
    headers.get("x-correlation-id") ?? headers.get("x-request-id"),
  );
}
