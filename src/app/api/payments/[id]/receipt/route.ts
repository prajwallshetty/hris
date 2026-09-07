import type { NextRequest } from "next/server";

import { logAudit } from "@/server/audit";
import { getPaymentReceiptData } from "@/server/queries/receipts";
import { getSessionUser } from "@/server/session";

function formatMoney(amount: number): string {
  return `SAR ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await getSessionUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: paymentId } = await params;
  const receipt = await getPaymentReceiptData(paymentId, user);

  if (!receipt) {
    return new Response("Receipt not found or unauthorized", { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const isAutoDownload = searchParams.get("download") === "1";

  // Log audit trail for downloading/viewing receipt
  await logAudit({
    userId: user.id,
    action: "download_receipt",
    entityType: "WorkerPayment",
    entityId: paymentId,
    newValue: { receiptNumber: receipt.receiptNumber, amount: receipt.amountPaidThisTransaction },
  });

  const totalDeductions =
    receipt.advanceDeduction + receipt.loanDeduction + receipt.leaveDeduction + receipt.otherDeductions;
  const totalAllowancesAndBonuses = receipt.allowances + receipt.bonuses;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Salary Payment Receipt - ${receipt.receiptNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.5;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 32px;
    }
    @media print {
      body { background: white; }
      .receipt-card { border: none; padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 24px;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #0f172a 0%, #3b82f6 100%);
      color: white;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 20px;
      letter-spacing: -1px;
    }
    .company-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .company-sub {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .receipt-badge-wrap {
      text-align: right;
    }
    .receipt-title {
      font-size: 18px;
      font-weight: 800;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .receipt-num {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .receipt-date {
      font-size: 12px;
      color: #64748b;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    .info-box {
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 6px;
      padding: 16px;
    }
    .info-box-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      color: #64748b;
    }
    .info-val {
      font-weight: 600;
      color: #0f172a;
      text-align: right;
    }
    .table-title {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    table.breakdown-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    table.breakdown-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      text-align: left;
    }
    table.breakdown-table th.right, table.breakdown-table td.right {
      text-align: right;
    }
    table.breakdown-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
    }
    table.breakdown-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .amount-highlight {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .amount-highlight-label {
      font-size: 13px;
      font-weight: 700;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .amount-highlight-val {
      font-size: 22px;
      font-weight: 800;
      color: #15803d;
    }
    .summary-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 32px;
    }
    .payment-meta {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
    }
    .signature-box {
      width: 240px;
      text-align: center;
      padding-top: 40px;
    }
    .signature-line {
      border-top: 1.5px solid #0f172a;
      margin-bottom: 6px;
    }
    .signature-title {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }
    .footer-note {
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
    .action-bar {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-bottom: 20px;
    }
    .btn {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0f172a;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="action-bar no-print">
      <button onclick="window.print()" class="btn btn-primary">
        🖨️ Print / Save as PDF
      </button>
    </div>

    <div class="header-bar">
      <div class="brand-logo">
        <div class="brand-icon">GB</div>
        <div>
          <div class="company-title">GrowthBridge HRIS</div>
          <div class="company-sub">Saudi Manpower & Employee Management</div>
        </div>
      </div>
      <div class="receipt-badge-wrap">
        <div class="receipt-title">Payment Receipt</div>
        <div class="receipt-num">${receipt.receiptNumber}</div>
        <div class="receipt-date">Date: ${formatDate(receipt.paymentDate)}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="info-box">
        <div class="info-box-title">Recipient Information</div>
        <div class="info-row">
          <span class="info-label">Name:</span>
          <span class="info-val">${receipt.recipientName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Code / ID:</span>
          <span class="info-val">${receipt.recipientCode}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Iqama / ID:</span>
          <span class="info-val">${receipt.iqamaOrId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Designation:</span>
          <span class="info-val">${receipt.designation}</span>
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">Assignment & Payroll Period</div>
        <div class="info-row">
          <span class="info-label">Client / Dept:</span>
          <span class="info-val">${receipt.clientOrDepartment}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Project / Site:</span>
          <span class="info-val">${receipt.siteName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payroll Period:</span>
          <span class="info-val">${receipt.payrollPeriodName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Ref:</span>
          <span class="info-val">${receipt.referenceNumber ?? "—"}</span>
        </div>
      </div>
    </div>

    <div class="table-title">Earnings & Deductions Summary</div>
    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Hours / Rate</th>
          <th class="right">Earnings (SAR)</th>
          <th class="right">Deductions (SAR)</th>
        </tr>
      </thead>
      <tbody>
        ${
          receipt.recipientType === "WORKER"
            ? `
        <tr>
          <td>Regular Work Hours</td>
          <td class="right">${receipt.regularHours} hrs @ ${formatMoney(receipt.regularRate)}/hr</td>
          <td class="right">${formatMoney(receipt.basicSalaryOrRegularPay)}</td>
          <td class="right">—</td>
        </tr>
        ${
          receipt.overtimeHours > 0
            ? `
        <tr>
          <td>Overtime Hours</td>
          <td class="right">${receipt.overtimeHours} hrs @ ${formatMoney(receipt.overtimeRate)}/hr</td>
          <td class="right">${formatMoney(receipt.overtimePay)}</td>
          <td class="right">—</td>
        </tr>`
            : ""
        }
        `
            : `
        <tr>
          <td>Basic Salary</td>
          <td class="right">Monthly</td>
          <td class="right">${formatMoney(receipt.basicSalaryOrRegularPay)}</td>
          <td class="right">—</td>
        </tr>`
        }
        ${
          totalAllowancesAndBonuses > 0
            ? `
        <tr>
          <td>Allowances & Bonuses</td>
          <td class="right">—</td>
          <td class="right">${formatMoney(totalAllowancesAndBonuses)}</td>
          <td class="right">—</td>
        </tr>`
            : ""
        }
        ${
          receipt.advanceDeduction > 0
            ? `
        <tr>
          <td>Advance Deduction</td>
          <td class="right">—</td>
          <td class="right">—</td>
          <td class="right">${formatMoney(receipt.advanceDeduction)}</td>
        </tr>`
            : ""
        }
        ${
          receipt.loanDeduction > 0
            ? `
        <tr>
          <td>Loan Installment Deduction</td>
          <td class="right">—</td>
          <td class="right">—</td>
          <td class="right">${formatMoney(receipt.loanDeduction)}</td>
        </tr>`
            : ""
        }
        ${
          receipt.leaveDeduction > 0
            ? `
        <tr>
          <td>Leave Deduction</td>
          <td class="right">—</td>
          <td class="right">—</td>
          <td class="right">${formatMoney(receipt.leaveDeduction)}</td>
        </tr>`
            : ""
        }
        ${
          receipt.otherDeductions > 0
            ? `
        <tr>
          <td>Other Deductions</td>
          <td class="right">—</td>
          <td class="right">—</td>
          <td class="right">${formatMoney(receipt.otherDeductions)}</td>
        </tr>`
            : ""
        }
        <tr style="font-weight: 700; background: #f1f5f9;">
          <td>Total Gross / Net Payable</td>
          <td class="right">—</td>
          <td class="right">${formatMoney(receipt.grossPay)}</td>
          <td class="right">${formatMoney(totalDeductions)}</td>
        </tr>
      </tbody>
    </table>

    <div class="amount-highlight">
      <div>
        <div class="amount-highlight-label">Amount Paid (This Transaction)</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">
          Method: <strong>${receipt.paymentMethod.replace(/_/g, " ")}</strong> ${receipt.referenceNumber ? `(Ref: ${receipt.referenceNumber})` : ""}
        </div>
      </div>
      <div class="amount-highlight-val">${formatMoney(receipt.amountPaidThisTransaction)}</div>
    </div>

    <div class="summary-section">
      <div class="payment-meta">
        <div class="info-row">
          <span class="info-label">Net Salary Payable:</span>
          <span class="info-val">${formatMoney(receipt.netPayable)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Total Amount Paid To Date:</span>
          <span class="info-val">${formatMoney(receipt.totalAmountPaid)}</span>
        </div>
        <div class="info-row" style="padding-top: 4px; border-top: 1px dashed #cbd5e1; font-weight: 700;">
          <span class="info-label" style="color: #0f172a;">Remaining Outstanding Balance:</span>
          <span class="info-val" style="color: ${receipt.remainingOutstanding > 0 ? "#d97706" : "#166534"};">
            ${formatMoney(receipt.remainingOutstanding)}
          </span>
        </div>
        ${receipt.remarks ? `<div style="margin-top: 8px; font-size: 11px; color: #64748b;"><strong>Remarks:</strong> ${receipt.remarks}</div>` : ""}
      </div>

      <div class="signature-box">
        <div style="height: 40px;"></div>
        <div class="signature-line"></div>
        <div class="signature-title">Authorized Signatory & Stamp</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">GrowthBridge Finance Dept.</div>
      </div>
    </div>

    <div class="footer-note">
      This is a computer-generated salary receipt issued by GrowthBridge HRIS System.<br>
      System Transaction ID: ${receipt.paymentId} | Generated on ${new Date().toLocaleString()}
    </div>
  </div>

  ${isAutoDownload ? `<script>window.onload = function() { window.print(); };</script>` : ""}
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": isAutoDownload
        ? `inline; filename="receipt-${receipt.receiptNumber}.html"`
        : "inline",
    },
  });
}
