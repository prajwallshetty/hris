"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useActionState } from "react";

import { authenticate } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(authenticate, undefined);
  const [visible, setVisible] = useState(false);

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="accessCode">Access Code</FieldLabel>
          <InputGroup className="h-10">
            <InputGroupInput
              id="accessCode"
              name="accessCode"
              type={visible ? "text" : "password"}
              placeholder="ADM-666"
              autoComplete="off"
              autoCapitalize="characters"
              className="font-mono tracking-wide uppercase"
              required
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={visible ? "Hide access code" : "Show access code"}
                onClick={() => setVisible((v) => !v)}
              >
                {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        {state && !state.success && <FieldError>{state.error}</FieldError>}
        <Button type="submit" className="w-full" loading={isPending}>
          {isPending ? "Signing in…" : "Continue"}
        </Button>
      </FieldGroup>
    </form>
  );
}
