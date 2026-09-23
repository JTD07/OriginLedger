"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createOrganizationAction,
  createProjectAction,
} from "@/server/assets/actions";
import {
  createSampleProjectAction,
  removeSampleProjectAction,
} from "@/server/samples/actions";
import { ConfirmDialog } from "@/components/a11y/confirm-dialog";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        setPending(true);
        const result = await createOrganizationAction(formData);
        setPending(false);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.refresh();
      }}
    >
      <label htmlFor="organization-name" className="text-sm font-medium">
        Organization name <span className="font-normal">(required)</span>
      </label>
      <input
        id="organization-name"
        name="name"
        required
        aria-required="true"
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? "organization-name-error" : undefined}
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="organization"
        className="min-h-11 rounded-md border border-zinc-300 px-3 py-2"
      />
      {message ? (
        <p
          id="organization-name-error"
          role="alert"
          className="text-sm text-red-800"
        >
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create organization"}
      </button>
    </form>
  );
}

export function CreateProjectForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        formData.set("organizationId", organizationId);
        setPending(true);
        const result = await createProjectAction(formData);
        setPending(false);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        setName("");
        router.refresh();
      }}
    >
      <label htmlFor="project-name" className="text-sm font-medium">
        Project name <span className="font-normal">(required)</span>
      </label>
      <input
        id="project-name"
        name="name"
        required
        aria-required="true"
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? "project-name-error" : "project-name-help"}
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="min-h-11 rounded-md border border-zinc-300 px-3 py-2"
      />
      <p id="project-name-help" className="text-sm text-zinc-700">
        Use a real project name. Sample data is created separately and labeled
        synthetic.
      </p>
      {message ? (
        <p
          id="project-name-error"
          role="alert"
          className="text-sm text-red-800"
        >
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 font-medium disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}

export function CreateSampleProjectForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4"
      action={async () => {
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        setPending(true);
        const result = await createSampleProjectAction(formData);
        setPending(false);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.refresh();
      }}
    >
      <h3 className="text-base font-semibold">Synthetic sample project</h3>
      <p className="text-sm text-zinc-700">
        Creates one labeled sample project, uploads a generated PNG through the
        same private upload path, and saves an honest draft declaration. Sample
        files count toward this organization&apos;s monthly file limit. Nothing
        is emailed, billed, or published.
      </p>
      {message ? (
        <p role="alert" className="text-sm text-red-800">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="min-h-11 w-fit rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creating sample…" : "Create synthetic sample project"}
      </button>
    </form>
  );
}

export function RemoveSampleProjectForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p role="alert" className="text-sm text-red-800">
          {message}
        </p>
      ) : null}
      <button
        type="button"
        className="min-h-11 w-fit rounded-md border border-zinc-300 px-4 py-2 font-medium"
        onClick={() => setOpen(true)}
      >
        Remove synthetic sample project
      </button>
      <ConfirmDialog
        open={open}
        title="Remove the synthetic sample project?"
        confirmLabel="Remove synthetic sample project"
        cancelLabel="Keep sample project"
        busy={pending}
        onCancel={() => {
          if (!pending) {
            setOpen(false);
          }
        }}
        onConfirm={async () => {
          const formData = new FormData();
          formData.set("organizationId", organizationId);
          setPending(true);
          const result = await removeSampleProjectAction(formData);
          setPending(false);
          if (!result.ok) {
            setMessage(result.message);
            return;
          }
          setOpen(false);
          router.refresh();
        }}
      >
        <p>
          This removes only the labeled synthetic sample project, its private
          files, and the sample evidence history. Other projects and
          organization records stay. Removal is idempotent if the sample is
          already gone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
