"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createOrganizationAction,
  createProjectAction,
} from "@/server/assets/actions";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        const result = await createOrganizationAction(formData);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.refresh();
      }}
    >
      <label htmlFor="organization-name" className="text-sm font-medium">
        Organization name
      </label>
      <input
        id="organization-name"
        name="name"
        required
        className="rounded-md border border-zinc-300 px-3 py-2"
      />
      {message ? (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white"
      >
        Create organization
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

  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        formData.set("organizationId", organizationId);
        const result = await createProjectAction(formData);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.refresh();
      }}
    >
      <label htmlFor="project-name" className="text-sm font-medium">
        Project name
      </label>
      <input
        id="project-name"
        name="name"
        required
        className="rounded-md border border-zinc-300 px-3 py-2"
      />
      {message ? (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        className="rounded-md border border-zinc-300 px-4 py-2 font-medium"
      >
        Create project
      </button>
    </form>
  );
}
