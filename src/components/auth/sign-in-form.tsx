"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction } from "@/server/auth/actions";
import type { AuthFormState } from "@/server/auth/schema";
import { Field, FormMessage, SubmitButton } from "./auth-ui";

export function SignInForm({
  nextPath,
  errorMessage,
}: {
  nextPath: string;
  errorMessage?: string;
}) {
  const [state, action] = useActionState(signInAction, null as AuthFormState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={nextPath} />
      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={state?.fieldErrors?.email}
      />
      <Field
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={state?.fieldErrors?.password}
      />
      <FormMessage message={state?.message ?? errorMessage} />
      <SubmitButton>Sign in</SubmitButton>
      <p className="text-sm text-zinc-600">
        <Link className="underline" href="/recover">
          Forgot password
        </Link>
        {" · "}
        <Link className="underline" href="/sign-up">
          Create an account
        </Link>
      </p>
    </form>
  );
}
