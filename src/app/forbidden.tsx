import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-full">
        <ShieldAlert className="text-muted-foreground size-7" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Your account role doesn&apos;t include this permission. Contact an administrator if you believe
          this is a mistake.
        </p>
      </div>
      <Button render={<Link href="/dashboard">Back to dashboard</Link>} />
    </div>
  );
}
