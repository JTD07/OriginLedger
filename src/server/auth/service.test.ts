import { describe, expect, test } from "vitest";
import { RECOVERY_NOTICE, SIGN_UP_CONFIRM_NOTICE } from "./errors";
import {
  requestPasswordReset,
  signInWithCredentials,
  signOutCurrentSession,
  signUpWithCredentials,
  updatePassword,
  type AuthGateway,
} from "./service";

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    async signInWithPassword() {
      return { error: null };
    },
    async signUp() {
      return {
        data: {
          user: { id: "11111111-1111-1111-1111-111111111111", email: "a@b.co" },
          sessionPresent: true,
        },
        error: null,
      };
    },
    async signOut() {
      return { error: null };
    },
    async resetPasswordForEmail() {
      return { error: null };
    },
    async updatePassword() {
      return { error: null };
    },
    async getClaims() {
      return {
        claims: { sub: "11111111-1111-1111-1111-111111111111" },
        error: null,
      };
    },
    async verifyOtp() {
      return { error: null };
    },
    ...overrides,
  };
}

function credentialsForm(email = "owner@example.com", password = "correct1") {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

describe("auth service", () => {
  test("signs in and uses a safe next path", async () => {
    const result = await signInWithCredentials(
      gateway(),
      credentialsForm(),
      "/app",
    );
    expect(result).toEqual({ ok: true, redirectTo: "/app" });
  });

  test("returns field errors without calling the gateway", async () => {
    let called = false;
    const result = await signInWithCredentials(
      gateway({
        async signInWithPassword() {
          called = true;
          return { error: null };
        },
      }),
      credentialsForm("bad", "short"),
      "/app",
    );
    expect(called).toBe(false);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.state.fieldErrors?.email).toBeDefined();
  });

  test("maps invalid credentials without leaking provider text", async () => {
    const leaked = "No user matching owner@example.com";
    const result = await signInWithCredentials(
      gateway({
        async signInWithPassword() {
          return { error: { code: "invalid_credentials", message: leaked } };
        },
      }),
      credentialsForm(),
      "/app",
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.state.message).toBe("Email or password is incorrect.");
    expect(result.state.message).not.toContain(leaked);
  });

  test("signs up into a session when confirmation is off", async () => {
    const result = await signUpWithCredentials(
      gateway(),
      credentialsForm(),
      "http://127.0.0.1:3000/auth/confirm",
    );
    expect(result).toEqual({ ok: true, redirectTo: "/app" });
  });

  test("asks the user to confirm email when no session is returned", async () => {
    const result = await signUpWithCredentials(
      gateway({
        async signUp() {
          return {
            data: { user: { id: "u", email: "a@b.co" }, sessionPresent: false },
            error: null,
          };
        },
      }),
      credentialsForm(),
      "http://127.0.0.1:3000/auth/confirm",
    );
    expect(result).toEqual({ ok: true, notice: SIGN_UP_CONFIRM_NOTICE });
  });

  test("always shows the same recovery notice", async () => {
    const result = await requestPasswordReset(
      gateway(),
      (() => {
        const formData = new FormData();
        formData.set("email", "owner@example.com");
        return formData;
      })(),
      "http://127.0.0.1:3000/auth/confirm?next=/update-password",
    );
    expect(result).toEqual({ ok: true, notice: RECOVERY_NOTICE });
  });

  test("updates a password for a recovered session", async () => {
    const formData = new FormData();
    formData.set("password", "correct2");
    const result = await updatePassword(gateway(), formData);
    expect(result).toEqual({ ok: true, redirectTo: "/app" });
  });

  test("signs out to the sign-in page", async () => {
    const result = await signOutCurrentSession(gateway());
    expect(result).toEqual({ ok: true, redirectTo: "/sign-in" });
  });
});
