import { z } from "zod";

/**
 * An optional numeric form field. A blank `<input type="number">` submits
 * "", which `z.coerce.number()` turns into 0 — that either fails a
 * `.positive()` check with no visible field (the form silently refuses to
 * submit) or stores a meaningless 0 (e.g. vehicle year 0). Blank means
 * "not provided" here.
 */
export function optionalNumber<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" || value === null ? undefined : value), schema.optional());
}
