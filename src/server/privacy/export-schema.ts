import * as z from "zod";
import {
  ORGANIZATION_EXPORT_SCHEMA_VERSION,
  TENANT_EXPORT_TABLES,
} from "./constants";

export const organizationExportObjectSchema = z.object({
  bucket: z.enum(["origin-assets", "evidence-packets"]),
  objectId: z.uuid(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  byteSize: z.number().int().nonnegative(),
  contentType: z.string().min(1),
});

export const organizationExportManifestSchema = z.object({
  schemaVersion: z.literal(ORGANIZATION_EXPORT_SCHEMA_VERSION),
  generatedAt: z.string().min(1),
  organizationId: z.uuid(),
  includeRawPrompts: z.boolean(),
  rawPromptHandling: z.string().min(1),
  tables: z.array(z.enum(TENANT_EXPORT_TABLES)),
  objects: z.array(organizationExportObjectSchema),
  omitted: z.object({
    secrets: z.literal(true),
    authenticationTokens: z.literal(true),
    signedUrls: z.literal(true),
    webhookPayloads: z.literal(true),
    operationalJobs: z.literal(true),
    storagePaths: z.literal(true),
  }),
  checksums: z.object({
    manifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
    archiveSha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    files: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
  }),
});

export type OrganizationExportManifest = z.infer<
  typeof organizationExportManifestSchema
>;

export const RAW_PROMPT_HANDLING_OMITTED =
  "Raw prompts stored on declaration versions are omitted from this archive unless the owner explicitly requested inclusion for this export.";

export const RAW_PROMPT_HANDLING_INCLUDED =
  "This archive includes raw prompts that were explicitly stored on declaration versions because the owner requested inclusion for this export.";
