import { z } from "zod";

const uuidSchema = z.uuid();

export const checkoutRequestSchema = z
  .object({
    organizationId: uuidSchema,
    plan: z.enum(["starter", "agency", "agency_plus"]),
    priceId: z.string().optional(),
    stripePriceId: z.string().optional(),
    customerId: z.string().optional(),
    stripeCustomerId: z.string().optional(),
    successUrl: z.string().optional(),
    cancelUrl: z.string().optional(),
  })
  .strict();

export const portalRequestSchema = z
  .object({
    organizationId: uuidSchema,
    customerId: z.string().optional(),
    stripeCustomerId: z.string().optional(),
    returnUrl: z.string().optional(),
  })
  .strict();

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type PortalRequest = z.infer<typeof portalRequestSchema>;
