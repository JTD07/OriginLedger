"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createAuthGateway,
  recoveryRedirectTo,
  signupEmailRedirectTo,
} from "./gateway";
import {
  requestPasswordReset,
  signInWithCredentials,
  signOutCurrentSession,
  signUpWithCredentials,
  updatePassword,
  type AuthActionResult,
} from "./service";
import type { AuthFormState } from "./schema";

function toFormState(result: AuthActionResult): AuthFormState {
  if (!result.ok) {
    return result.state;
  }
  if (result.notice) {
    return { message: result.notice };
  }
  return null;
}

async function finish(result: AuthActionResult): Promise<AuthFormState> {
  if (result.ok && result.redirectTo) {
    revalidatePath("/", "layout");
    redirect(result.redirectTo);
  }

  return toFormState(result);
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createServerSupabaseClient();
  const result = await signInWithCredentials(
    createAuthGateway(supabase),
    formData,
    formData.get("next"),
  );
  return finish(result);
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createServerSupabaseClient();
  const result = await signUpWithCredentials(
    createAuthGateway(supabase),
    formData,
    signupEmailRedirectTo(),
  );
  return finish(result);
}

export async function recoverAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createServerSupabaseClient();
  const result = await requestPasswordReset(
    createAuthGateway(supabase),
    formData,
    recoveryRedirectTo(),
  );
  return finish(result);
}

export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createServerSupabaseClient();
  const result = await updatePassword(createAuthGateway(supabase), formData);
  return finish(result);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const result = await signOutCurrentSession(createAuthGateway(supabase));
  if (result.ok && result.redirectTo) {
    revalidatePath("/", "layout");
    redirect(result.redirectTo);
  }
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
