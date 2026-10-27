import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { Logo } from "@/components/shared/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <Logo size="login" className="mb-2" />
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to Manpower HRIS with your access code</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
