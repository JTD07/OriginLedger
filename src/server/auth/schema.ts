import * as z from "zod";

export const emailSchema = z.email({ error: "Enter a valid email address." });

export const passwordSchema = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .regex(/[a-zA-Z]/, { error: "Include at least one letter." })
  .regex(/[0-9]/, { error: "Include at least one number." });

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const recoverSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z.object({
  password: passwordSchema,
});

export type AuthFieldErrors = {
  email?: string;
  password?: string;
};

export type AuthFormState = {
  message?: string;
  fieldErrors?: AuthFieldErrors;
  values?: {
    email?: string;
  };
} | null;

export function firstIssue(
  issues: Readonly<Record<string, string[] | undefined>>,
  key: string,
): string | undefined {
  return issues[key]?.[0];
}

export function fieldErrorsFromZod(error: z.ZodError): AuthFieldErrors {
  const flattened = error.flatten().fieldErrors;
  const fieldErrors: AuthFieldErrors = {};
  const email = firstIssue(flattened, "email");
  const password = firstIssue(flattened, "password");
  if (email) {
    fieldErrors.email = email;
  }
  if (password) {
    fieldErrors.password = password;
  }
  return fieldErrors;
}
