export function hasClientBillingOverrides(input: {
  priceId?: string;
  customerId?: string;
  successUrl?: string;
  cancelUrl?: string;
  returnUrl?: string;
}): boolean {
  return Boolean(
    input.priceId ||
    input.customerId ||
    input.successUrl ||
    input.cancelUrl ||
    input.returnUrl,
  );
}

export function billingAccessError(
  access: { canBill: boolean } | null,
): "unauthorized" | "forbidden" | null {
  if (!access) {
    return "unauthorized";
  }
  if (!access.canBill) {
    return "forbidden";
  }
  return null;
}
