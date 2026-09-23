import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-zinc-700">{children}</div>
      {action}
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "warning" | "danger" | "busy";
  children: ReactNode;
}) {
  const className =
    tone === "success"
      ? "border-emerald-700 bg-emerald-50 text-emerald-900"
      : tone === "warning"
        ? "border-amber-700 bg-amber-50 text-amber-950"
        : tone === "danger"
          ? "border-red-700 bg-red-50 text-red-900"
          : tone === "busy"
            ? "border-blue-800 bg-blue-50 text-blue-950"
            : "border-zinc-400 bg-zinc-50 text-zinc-800";
  return (
    <p
      role="status"
      className={`rounded-md border px-2 py-1 text-sm ${className}`}
    >
      Status: {children}
    </p>
  );
}

export function LoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 flex-col gap-3" aria-busy="true">
      <p>{label}</p>
      <div className="h-6 w-2/3 rounded bg-zinc-200" />
      <div className="h-4 w-full rounded bg-zinc-100" />
      <div className="h-4 w-5/6 rounded bg-zinc-100" />
    </div>
  );
}
