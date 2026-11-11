/**
 * Normalises a phone number to international digits for WhatsApp (no "+"). UAE local formats
 * (05X…, 5X…, 0 4…) get the 971 country code; numbers starting with + or 00 keep theirs.
 * Returns null when it cannot be a valid number.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountry = "971") {
  if (!raw) return null;
  const trimmed = raw.trim();
  let digits = trimmed.replace(/[^\d]/g, "");
  if (trimmed.startsWith("+")) {
    // already international
  } else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = defaultCountry + digits.slice(1);
  else if (digits.length === 9 && digits.startsWith("5")) digits = defaultCountry + digits;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}
