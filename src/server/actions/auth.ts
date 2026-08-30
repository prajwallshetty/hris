"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import type { ActionResult } from "@/server/action-result";

export async function authenticate(
  _prevState: ActionResult<undefined> | undefined,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "Invalid email or password." };
    }
    // NextAuth throws a redirect internally on success — let it propagate.
    throw error;
  }
}
