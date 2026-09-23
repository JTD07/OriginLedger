"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </>
  );
}

export function Field({
  id,
  label,
  type,
  name,
  autoComplete,
  error,
  defaultValue,
  required = true,
  describedBy,
}: {
  id: string;
  label: string;
  type: string;
  name: string;
  autoComplete?: string;
  error?: string;
  defaultValue?: string;
  required?: boolean;
  describedBy?: string;
}) {
  const errorId = `${id}-error`;
  const helpIds = [describedBy, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
        {required ? <span className="font-normal"> (required)</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={helpIds || undefined}
        defaultValue={defaultValue}
        className="min-h-11 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({
  message,
  tone = "status",
}: {
  message?: string;
  tone?: "status" | "alert";
}) {
  if (!message) {
    return null;
  }

  return (
    <p
      className="text-sm text-zinc-800"
      role={tone === "alert" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
