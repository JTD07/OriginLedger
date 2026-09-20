"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/server/auth/actions";
import type { AuthFormState } from "@/server/auth/schema";
import { Field, FormMessage, SubmitButton } from "./auth-ui";

export function UpdatePasswordForm() {
  const [state, action] = useActionState(
    updatePasswordAction,
    null as AuthFormState,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        id="password"
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        error={state?.fieldErrors?.password}
      />
      <FormMessage message={state?.message} />
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
