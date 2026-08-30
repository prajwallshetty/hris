// Centralized calculation engine (§17/§20) — every salary/commission/billing
// formula in the app must go through one of these, not be reimplemented
// inline in a server action, a query, or (never) a UI component.
export * from "./hours";
export * from "./payroll";
export * from "./billing";
export * from "./commission";
export * from "./finance";
export * from "./profitability";
