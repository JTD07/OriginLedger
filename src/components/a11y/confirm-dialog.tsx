"use client";

import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const lastActive = useRef<Element | null>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) {
      return;
    }
    if (open) {
      lastActive.current = document.activeElement;
      if (!node.open) {
        node.showModal();
      }
      const focusable = node.querySelector<HTMLElement>(
        "button, [href], input, select, textarea",
      );
      focusable?.focus();
      return;
    }
    if (node.open) {
      node.close();
    }
    if (lastActive.current instanceof HTMLElement) {
      lastActive.current.focus();
    }
  }, [open]);

  function handleCancel() {
    if (busy) {
      return;
    }
    onCancel();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onConfirm();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-md border border-zinc-300 p-0 backdrop:bg-zinc-900/40"
      onCancel={(event) => {
        event.preventDefault();
        handleCancel();
      }}
      onClose={handleCancel}
    >
      <form className="flex flex-col gap-4 p-6" onSubmit={handleSubmit}>
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        <div className="text-zinc-800">{children}</div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 font-medium"
            onClick={handleCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Removing…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
