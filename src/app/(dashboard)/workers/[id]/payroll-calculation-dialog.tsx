"use client";

import { Calculator } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export type PayrollCalculationData = {
  periodName: string;
  regularHours: number;
  regularRate: number;
  regularPay: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimePay: number;
  allowances: number;
  bonuses: number;
  advanceDeduction: number;
  loanDeduction: number;
  leaveDeduction: number;
  otherDeductions: number;
  grossPay: number;
  netPayable: number;
  paid: number;
  outstanding: number;
};

function money(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function Line({ label, detail, amount, negative }: { label: string; detail?: string; amount: number; negative?: boolean }) {
  if (amount === 0 && negative === undefined) return null;
  return (
    <div className="flex items-baseline justify-between py-1.5 text-sm">
      <div>
        <span>{label}</span>
        {detail && <span className="text-muted-foreground ml-2 text-xs">{detail}</span>}
      </div>
      <span className={negative ? "text-destructive tabular-nums" : "tabular-nums"}>
        {negative ? "−" : ""}
        {money(Math.abs(amount))}
      </span>
    </div>
  );
}

// §16 calculation transparency: never let a payroll figure be an
// unexplained black box — every line here is a stored, real value
// (WorkerPayrollItem / WorkerPayroll fields), not derived for display.
export function PayrollCalculationDialog({ data }: { data: PayrollCalculationData }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <Calculator className="size-4" />
            View Calculation
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{data.periodName} — Calculation</DialogTitle>
        </DialogHeader>

        <div className="divide-border divide-y">
          <div>
            <Line label="Regular" detail={`${data.regularHours}h × ${money(data.regularRate)}`} amount={data.regularPay} />
            <Line
              label="Overtime"
              detail={`${data.overtimeHours}h × ${money(data.overtimeRate)}`}
              amount={data.overtimePay}
            />
            <Line label="Allowances" amount={data.allowances} />
            <Line label="Bonuses" amount={data.bonuses} />
          </div>
          <div className="pt-1.5">
            <Line label="Advance deduction" amount={data.advanceDeduction} negative />
            <Line label="Loan deduction" amount={data.loanDeduction} negative />
            <Line label="Leave deduction" amount={data.leaveDeduction} negative />
            <Line label="Other deductions" amount={data.otherDeductions} negative />
          </div>
        </div>

        <Separator />

        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Gross Pay</span>
          <span className="tabular-nums">{money(data.grossPay)}</span>
        </div>
        <div className="flex items-baseline justify-between font-semibold">
          <span>Net Payable</span>
          <span className="tabular-nums">{money(data.netPayable)}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Paid</span>
          <span className="tabular-nums">{money(data.paid)}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Outstanding</span>
          <span className="tabular-nums">{money(data.outstanding)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
