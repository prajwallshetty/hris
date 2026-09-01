"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateEmployeePayroll } from "@/server/actions/employee-payroll";

type EmployeeOption = { id: string; fullName: string };

export function GenerateEmployeePayrollForm({
  payrollPeriodId,
  employees,
}: {
  payrollPeriodId: string;
  employees: EmployeeOption[];
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const result = await generateEmployeePayroll({ payrollPeriodId, employeeId: employeeId || undefined });
      if (result.success) {
        toast.success(`Generated payroll for ${result.data.generated} employee(s).`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 text-sm font-medium">Generate Employee Payroll</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field className="sm:col-span-3">
          <FieldLabel>Employee</FieldLabel>
          <Select value={employeeId || "ALL"} onValueChange={(v) => setEmployeeId(v === "ALL" ? "" : (v ?? ""))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All active employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All active employees</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
            {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate
          </Button>
        </div>
      </div>
    </div>
  );
}
