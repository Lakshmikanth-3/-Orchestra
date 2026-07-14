import { EventEmitter } from "node:events";
import type { LedgerEvent } from "./ledger";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function publish(runId: string, event: LedgerEvent): void {
  emitter.emit(runId, event);
}

export function subscribe(runId: string, handler: (event: LedgerEvent) => void): () => void {
  emitter.on(runId, handler);
  return () => emitter.off(runId, handler);
}
