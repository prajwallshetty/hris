// wa.me click-to-chat helpers (§ WhatsApp integration). A wa.me link can
// only open a chat with a pre-filled text message — it cannot silently
// attach/upload a PDF or any file. Never build UI copy that implies
// otherwise; pair it with a separate "Download"/"Share" action for the
// document itself.

/**
 * Normalizes a stored phone number into the digits-only international
 * format wa.me requires (no spaces, +, or punctuation). There's no
 * per-record country-code field in this schema, so numbers already long
 * enough to include a country code are passed through as-is, and shorter
 * local-format numbers (e.g. a Saudi 05XXXXXXXX mobile) are assumed to be
 * in `defaultCountryCode`'s country and have their leading trunk zero
 * replaced with it.
 */
export function formatInternationalPhone(phone: string, defaultCountryCode = "966"): string {
  let digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return "";

  // Already has an international prefix typed as 00XXXXXXXXXX.
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Local trunk-prefixed number (e.g. Saudi "05XXXXXXXX", Indian "0XXXXXXXXXX")
  // — swap the leading 0 for the assumed country code.
  if (digits.startsWith("0")) {
    return `${defaultCountryCode}${digits.slice(1)}`;
  }

  // Already looks like it carries a country code (longer than a bare local
  // subscriber number) — use as-is.
  if (digits.length > 9) {
    return digits;
  }

  // Bare local subscriber number with no trunk prefix — prepend the
  // assumed country code.
  return `${defaultCountryCode}${digits}`;
}

/** Builds a wa.me click-to-chat URL with a pre-filled, URL-encoded message. */
export function buildWhatsAppUrl(phone: string, message: string, defaultCountryCode = "966"): string {
  const international = formatInternationalPhone(phone, defaultCountryCode);
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}
