import { BILLING_PAGE_PATH } from "./constants";

function originOf(appUrl: string): URL {
  return new URL(appUrl);
}

export function billingReturnUrl(appUrl: string): string {
  const url = originOf(appUrl);
  url.pathname = BILLING_PAGE_PATH;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function checkoutSuccessUrl(appUrl: string): string {
  const url = new URL(billingReturnUrl(appUrl));
  url.searchParams.set("checkout", "processing");
  return url.toString();
}

export function checkoutCancelUrl(appUrl: string): string {
  const url = new URL(billingReturnUrl(appUrl));
  url.searchParams.set("checkout", "cancelled");
  return url.toString();
}

export function minuteIdempotencyKey(
  prefix: string,
  now: Date = new Date(),
): string {
  const stamp = now.toISOString().slice(0, 16);
  return `${prefix}:${stamp}`;
}
