import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/env/public";
import type { Database } from "@/types/database";
import { AUTH_CONFIRM_PATH, UPDATE_PASSWORD_PATH } from "./paths";
import type { AuthGateway, SignUpResult } from "./service";

type UserScopedClient = SupabaseClient<Database>;

function confirmUrl(next?: string): string {
  const origin = getPublicEnv().appUrl.replace(/\/$/, "");
  const url = new URL(AUTH_CONFIRM_PATH, `${origin}/`);
  if (next) {
    url.searchParams.set("next", next);
  }
  return url.toString();
}

export function createAuthGateway(client: UserScopedClient): AuthGateway {
  return {
    async signInWithPassword(input) {
      const { error } = await client.auth.signInWithPassword(input);
      return { error };
    },
    async signUp(input) {
      const { data, error } = await client.auth.signUp({
        email: input.email,
        password: input.password,
        options: { emailRedirectTo: input.emailRedirectTo },
      });

      const result: SignUpResult = {
        user: data.user ? { id: data.user.id, email: data.user.email } : null,
        sessionPresent: Boolean(data.session),
      };

      return { data: result, error };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      return { error };
    },
    async resetPasswordForEmail(input) {
      const { error } = await client.auth.resetPasswordForEmail(input.email, {
        redirectTo: input.redirectTo,
      });
      return { error };
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      return { error };
    },
    async getClaims() {
      const { data, error } = await client.auth.getClaims();
      const claims = data?.claims;
      if (!claims) {
        return { claims: null, error };
      }
      return {
        claims: {
          sub: claims.sub,
          email:
            "email" in claims && typeof claims.email === "string"
              ? claims.email
              : undefined,
        },
        error,
      };
    },
    async verifyOtp(input) {
      const { error } = await client.auth.verifyOtp(input);
      return { error };
    },
  };
}

export function signupEmailRedirectTo(): string {
  return confirmUrl();
}

export function recoveryRedirectTo(): string {
  return confirmUrl(UPDATE_PASSWORD_PATH);
}
