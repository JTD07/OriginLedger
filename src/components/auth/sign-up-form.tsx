"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction } from "@/server/auth/actions";
import type { AuthFormState } from "@/server/auth/schema";
import { Field, FormMessage, SubmitButton } from "./auth-ui";

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, null as AuthFormState);

  return (
    <form action={action} className="flex flex-col gap-4">
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
        autoComplete="new-password"
        error={state?.fieldErrors?.password}
      />
      <FormMessage message={state?.message} />
      <SubmitButton>Create account</SubmitButton>
      <p className="text-sm text-zinc-600">
        Already have an account?{" "}
        <Link className="underline" href="/sign-in">
          Sign in
        </Link>
      </p>
    </form>
  );
}
