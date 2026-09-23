"use client";

import { useState } from "react";
import {
  cancelOrganizationDeletionAction,
  requestOrganizationDeletionAction,
  requestOrganizationExportAction,
  retryOrganizationDeletionAction,
} from "@/server/privacy/actions";
import {
  DELETE_CONFIRM_PHRASE,
  EXPORT_CONFIRM_PHRASE,
} from "@/server/privacy/constants";

export function OrganizationExportForm({
  organizationId,
  organizationName,
  rawPromptWarning,
}: {
  organizationId: string;
  organizationName: string;
  rawPromptWarning: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        const result = await requestOrganizationExportAction(formData);
        setMessage(result.message);
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="organizationName" value={organizationName} />
      <p>{rawPromptWarning}</p>
      <label className="flex flex-col gap-1 text-sm">
        Type the organization name to confirm
        <input
          name="confirmName"
          className="rounded-md border border-zinc-300 px-3 py-2"
          autoComplete="off"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Type {EXPORT_CONFIRM_PHRASE} to confirm
        <input
          name="confirmPhrase"
          className="rounded-md border border-zinc-300 px-3 py-2"
          autoComplete="off"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          name="password"
          className="rounded-md border border-zinc-300 px-3 py-2"
          autoComplete="current-password"
          required
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="includeRawPrompts" />
        Include explicitly stored raw prompts
      </label>
      <button
        type="submit"
        className="min-h-11 w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
      >
        Request organization export
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

export function OrganizationDeletionForm({
  organizationId,
  organizationName,
  deletionCopy,
}: {
  organizationId: string;
  organizationName: string;
  deletionCopy: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        const result = await requestOrganizationDeletionAction(formData);
        setMessage(result.message);
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="organizationName" value={organizationName} />
      <p>{deletionCopy}</p>
      <p>
        This cannot be undone after storage removal begins. Organization files,
        declarations, evidence history, packets, share links, and memberships
        for this organization are removed. Your sign-in account remains if you
        belong to another organization.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Type the organization name to confirm
        <input
          name="confirmName"
          className="rounded-md border border-zinc-300 px-3 py-2"
          autoComplete="off"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Type {DELETE_CONFIRM_PHRASE} to confirm
        <input
          name="confirmPhrase"
          className="rounded-md border border-zinc-300 px-3 py-2"
          autoComplete="off"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          name="password"
          className="rounded-md border border-zinc-300 px-3 py-2"
          autoComplete="current-password"
          required
        />
      </label>
      <button
        type="submit"
        className="min-h-11 w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
      >
        Request organization deletion
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

export function DeletionRetryForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        const result = await retryOrganizationDeletionAction(formData);
        setMessage(result.message);
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <button
        type="submit"
        className="min-h-11 w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
      >
        Retry failed deletion
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

export function DeletionCancelForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        const result = await cancelOrganizationDeletionAction(formData);
        setMessage(result.message);
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <button
        type="submit"
        className="min-h-11 w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
      >
        Cancel deletion
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
