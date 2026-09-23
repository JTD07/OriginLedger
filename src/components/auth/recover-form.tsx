"use client";

import { useActionState } from "react";
import Link from "next/link";
import { recoverAction } from "@/server/auth/actions";
import type { AuthFormState } from "@/server/auth/schema";
import { Field, FormMessage, SubmitButton } from "./auth-ui";

export function RecoverForm() {
  const [state, action] = useActionState(recoverAction, null as AuthFormState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={state?.fieldErrors?.email}
        defaultValue={state?.values?.email}
      />
      <FormMessage message={state?.message} />
      <SubmitButton>Send reset link</SubmitButton>
      <p className="text-sm text-zinc-600">
        <Link className="underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
