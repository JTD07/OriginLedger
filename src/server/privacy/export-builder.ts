import { sha256HexBytes } from "@/server/packets/hash";
import {
  EXPORT_OMIT_COLUMNS,
  ORGANIZATION_EXPORT_SCHEMA_VERSION,
  TENANT_EXPORT_TABLES,
  type TenantExportTable,
} from "./constants";
import {
  RAW_PROMPT_HANDLING_INCLUDED,
  RAW_PROMPT_HANDLING_OMITTED,
  organizationExportManifestSchema,
  type OrganizationExportManifest,
} from "./export-schema";
import { buildZipArchive } from "./zip";

export type ExportTableRow = Record<string, unknown>;

export type ExportObjectInput = {
  bucket: "origin-assets" | "evidence-packets";
  objectId: string;
  bytes: Uint8Array;
  contentType: string;
};

export type BuiltOrganizationExport = {
  archive: Uint8Array;
  manifest: OrganizationExportManifest;
  archiveSha256: string;
  manifestSha256: string;
};

const encoder = new TextEncoder();

export function sanitizeExportRow(
  row: ExportTableRow,
  includeRawPrompts: boolean,
): ExportTableRow {
  const output: ExportTableRow = {};
  for (const [key, value] of Object.entries(row)) {
    if ((EXPORT_OMIT_COLUMNS as readonly string[]).includes(key)) {
      if (key === "raw_prompt" && includeRawPrompts) {
        output[key] = value;
      }
      continue;
    }
    output[key] = value;
  }
  return output;
}

export async function buildOrganizationExport(input: {
  organizationId: string;
  generatedAt: string;
  includeRawPrompts: boolean;
  tables: Partial<Record<TenantExportTable, ExportTableRow[]>>;
  objects: ExportObjectInput[];
}): Promise<BuiltOrganizationExport> {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  const fileChecksums: Record<string, string> = {};

  for (const table of TENANT_EXPORT_TABLES) {
    const rows = (input.tables[table] ?? []).map((row) =>
      sanitizeExportRow(row, input.includeRawPrompts),
    );
    const name = `tables/${table}.json`;
    const data = encoder.encode(`${JSON.stringify(rows)}\n`);
    files.push({ name, data });
    fileChecksums[name] = await sha256HexBytes(data);
  }

  const objectInventory = [];
  for (const object of input.objects) {
    const sha256 = await sha256HexBytes(object.bytes);
    const name = `objects/${object.bucket}/${object.objectId}`;
    files.push({ name, data: object.bytes });
    fileChecksums[name] = sha256;
    objectInventory.push({
      bucket: object.bucket,
      objectId: object.objectId,
      sha256,
      byteSize: object.bytes.byteLength,
      contentType: object.contentType,
    });
  }

  const manifestWithoutChecksums = {
    schemaVersion: ORGANIZATION_EXPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    organizationId: input.organizationId,
    includeRawPrompts: input.includeRawPrompts,
    rawPromptHandling: input.includeRawPrompts
      ? RAW_PROMPT_HANDLING_INCLUDED
      : RAW_PROMPT_HANDLING_OMITTED,
    tables: [...TENANT_EXPORT_TABLES],
    objects: objectInventory,
    omitted: {
      secrets: true as const,
      authenticationTokens: true as const,
      signedUrls: true as const,
      webhookPayloads: true as const,
      operationalJobs: true as const,
      storagePaths: true as const,
    },
    checksums: {
      manifestSha256: "0".repeat(64),
      files: fileChecksums,
    },
  };

  const draftBytes = encoder.encode(
    `${JSON.stringify(manifestWithoutChecksums, null, 2)}\n`,
  );
  const manifestSha256 = await sha256HexBytes(draftBytes);
  const manifest: OrganizationExportManifest = {
    ...manifestWithoutChecksums,
    checksums: {
      manifestSha256,
      files: fileChecksums,
    },
  };
  organizationExportManifestSchema.parse(manifest);
  const manifestBytes = encoder.encode(
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  files.unshift({ name: "manifest.json", data: manifestBytes });
  fileChecksums["manifest.json"] = await sha256HexBytes(manifestBytes);
  manifest.checksums.files = fileChecksums;

  const archive = buildZipArchive(files);
  const archiveSha256 = await sha256HexBytes(archive);
  manifest.checksums.archiveSha256 = archiveSha256;
  organizationExportManifestSchema.parse(manifest);

  return {
    archive,
    manifest,
    archiveSha256,
    manifestSha256,
  };
}
