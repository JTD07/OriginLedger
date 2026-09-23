"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import type { OnboardingStep } from "@/server/samples/progress";

const listeners = new Map<string, Set<() => void>>();

function subscribeKey(key: string, onStoreChange: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(onStoreChange);
  return () => {
    set.delete(onStoreChange);
  };
}

function emit(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function readDismissed(key: string) {
  return window.localStorage.getItem(key) === "1";
}

export function OnboardingChecklist({
  organizationId,
  steps,
  completedHref,
}: {
  organizationId: string;
  steps: OnboardingStep[];
  completedHref: string | null;
}) {
  const storageKey = `originledger.onboarding.dismissed.${organizationId}`;
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeKey(storageKey, onStoreChange),
    [storageKey],
  );
  const getSnapshot = useCallback(
    () => readDismissed(storageKey),
    [storageKey],
  );
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const remaining = steps.filter((step) => !step.done);
  const complete = remaining.length === 0;

  if (dismissed && !complete) {
    return (
      <p>
        <button
          type="button"
          className="min-h-11 underline"
          onClick={() => {
            window.localStorage.removeItem(storageKey);
            emit(storageKey);
          }}
        >
          Show first-value checklist
        </button>
      </p>
    );
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4"
      aria-labelledby="onboarding-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="onboarding-heading" className="text-xl font-semibold">
          First-value checklist
        </h2>
        <button
          type="button"
          className="min-h-11 rounded-md border border-zinc-300 px-3 py-1 text-sm"
          onClick={() => {
            window.localStorage.setItem(storageKey, "1");
            emit(storageKey);
          }}
        >
          Dismiss checklist
        </button>
      </div>
      {complete ? (
        <p role="status">
          First-value path complete.{" "}
          {completedHref ? (
            <Link className="underline" href={completedHref}>
              Open the generated packet
            </Link>
          ) : (
            "Open Evidence packets to download the snapshot."
          )}
        </p>
      ) : (
        <p>
          Current action: {remaining[0]?.nextAction}{" "}
          {remaining[0]?.href ? (
            <Link className="underline" href={remaining[0].href}>
              Continue
            </Link>
          ) : null}
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.id}>
            <span className="font-medium">{step.done ? "Done" : "To do"}:</span>{" "}
            {step.href ? (
              <Link className="underline" href={step.href}>
                {step.title}
              </Link>
            ) : (
              step.title
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
