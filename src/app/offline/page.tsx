"use client";

import { WifiOff, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      window.location.reload();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md border-slate-200 shadow-sm text-center">
        <CardHeader className="flex flex-col items-center pb-2">
          <div className="mb-4">
            <Logo size="login" />
          </div>
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <WifiOff className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900">
            {isOnline ? "Connection Restored" : "You Are Offline"}
          </CardTitle>
          <CardDescription className="text-sm text-slate-600">
            {isOnline
              ? "Reconnecting to Expand Arabia HRIS..."
              : "Expand Arabia HRIS requires an active internet connection to securely query and process workforce, payroll, and billing operations."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Financial Security Notice</p>
            <p className="mt-1">
              Actions involving salary payments, invoicing, and contract changes are strictly paused while offline to protect data integrity.
            </p>
          </div>

          <Button
            onClick={() => window.location.reload()}
            className="w-full bg-[#1F4ED8] hover:bg-[#1E40AF] text-white"
          >
            <RotateCcw className="mr-2 size-4" />
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
