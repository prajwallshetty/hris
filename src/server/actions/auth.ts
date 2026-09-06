"use server";

import { AuthError, CredentialsSignin } from "next-auth";

import { signIn } from "@/auth";
import type { ActionResult } from "@/server/action-result";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "That access code isn't valid. Check it and try again.",
  account_disabled: "This account has been disabled. Contact your administrator.",
  rate_limited: "Too many failed attempts. Please wait a few minutes and try again.",
};

export async function authenticate(
  _prevState: ActionResult<undefined> | undefined,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  try {
    await signIn("credentials", {
      accessCode: formData.get("accessCode"),
      redirectTo: "/dashboard",
    });
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return { success: false, error: ERROR_MESSAGES[error.code] ?? "That access code isn't valid." };
    }
    if (error instanceof AuthError) {
      return { success: false, error: "Unable to sign in right now. Please try again." };
    }
    // NextAuth throws a redirect internally on success — let it propagate.
    throw error;
  }
}
