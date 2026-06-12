import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Default region for bare (non-`+`) numbers — ~90% of input is NANP. */
const DEFAULT_COUNTRY = "US";

/**
 * Format a stored E.164 phone number for display: national format for NANP
 * (US/CA), international otherwise. Falls back to the raw value if it can't be
 * parsed.
 */
export function formatPhoneDisplay(value: string): string {
    const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
    if (!parsed) return value;
    return parsed.country === "US" || parsed.country === "CA"
        ? parsed.formatNational()
        : parsed.formatInternational();
}

/** A dialable `tel:` value (E.164) for a stored number; raw value if unparseable. */
export function phoneHref(value: string): string {
    return parsePhoneNumberFromString(value, DEFAULT_COUNTRY)?.number ?? value;
}

/**
 * Format raw input when the field loses focus: a clean national/international
 * string once the number is at least *possible* (right shape/length), otherwise
 * the value unchanged — so a partial number the user is still editing isn't
 * clobbered. Used for on-blur formatting (not as-you-type, which mangles the
 * value when re-parsed each keystroke).
 */
export function formatPhoneInput(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_COUNTRY);
    if (!parsed?.isPossible()) return value;
    return parsed.country === "US" || parsed.country === "CA"
        ? parsed.formatNational()
        : parsed.formatInternational();
}
