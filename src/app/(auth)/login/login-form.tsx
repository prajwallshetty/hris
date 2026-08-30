"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { authenticate } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        {state && !state.success && <FieldError>{state.error}</FieldError>}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </Button>
      </FieldGroup>
    </form>
  );
}
