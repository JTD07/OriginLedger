import type { ReactNode } from "react";

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-500">OriginLedger</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </main>
  );
}

export function Field({
  id,
  label,
  type,
  name,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  type: string;
  name: string;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
      />
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-sm text-zinc-800" role="status">
      {message}
    </p>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white"
    >
      {children}
    </button>
  );
}
