/**
 * Google Ads (gtag.js) helpers.
 *
 * HOW TO FILL IN YOUR IDs:
 *   1. GADS_ID — Google Ads › Admin › Linked accounts › Google Tag
 *      (or Google Ads › Tools › Google Tag). Looks like "AW-123456789".
 *   2. CONVERSION_LABEL — Google Ads › Goals › Conversions › [your Purchase action]
 *      › Tag setup › "Use Google Tag Manager" shows the full send_to string:
 *        gtag('event', 'conversion', { send_to: 'AW-123456789/AbCdEfGhIjk' })
 *                                                              ^^^^^^^^^^^
 *                                                              that's the label
 *
 * After updating, run `node_modules/.bin/next build` to confirm no TS errors.
 */

// TODO: replace with your Google Ads Measurement ID, e.g. "AW-123456789"
export const GADS_ID = "AW-18572680418";

// TODO: replace with your Purchase conversion label, e.g. "AbCdEfGhIjk"
export const CONVERSION_LABEL = "--31CJiHyrcdEOK5kphF";

// Let TypeScript know gtag and dataLayer exist on window after the script loads.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer: any[];
  }
}

function fire(...args: unknown[]) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag(...args);
}

/**
 * Re-send a config hit on client-side navigations.
 * Call from a router.events listener if you want SPA pageview tracking.
 */
export function pageview(url: string) {
  fire("config", GADS_ID, { page_path: url });
}

/**
 * Fire the Google Ads purchase conversion.
 * Call once after a booking is confirmed — never on page load alone.
 *
 * @param value        Trip total in dollars (not cents).
 * @param transactionId  Trip UUID for de-duplication in Google Ads reports.
 */
export function conversion(value: number, transactionId?: string) {
  fire("event", "conversion", {
    send_to: `${GADS_ID}/${CONVERSION_LABEL}`,
    value,
    currency: "USD",
    ...(transactionId ? { transaction_id: transactionId } : {}),
  });
}

/**
 * Fire when the user clicks the Book button (micro-conversion).
 * Helps Smart Bidding learn from partial funnel completions.
 *
 * @param value  Expected trip total in dollars at the time of click.
 */
export function beginCheckout(value: number) {
  fire("event", "begin_checkout", { value, currency: "USD" });
}
