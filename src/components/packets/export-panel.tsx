"use client";

import { useState } from "react";
import {
  createShareLinkAction,
  generateEvidencePacketAction,
  revokeShareLinkAction,
  type PacketActionResult,
} from "@/server/packets/actions";
import { RAW_PROMPT_EXPORT_WARNING } from "@/server/packets/constants";
import type { EvidenceExportView, ShareLinkView } from "@/server/packets/types";

export function ExportPanel({
  assetId,
  canMutate,
  exports,
  shares,
}: {
  assetId: string;
  canMutate: boolean;
  exports: EvidenceExportView[];
  shares: ShareLinkView[];
}) {
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function onGenerate(formData: FormData) {
    setGenerateNotice(null);
    const result = await generateEvidencePacketAction(formData);
    setGenerateNotice(result.message ?? (result.ok ? "Generated." : "Failed."));
  }

  async function onShare(formData: FormData) {
    setShareNotice(null);
    setShareUrl(null);
    const result: PacketActionResult = await createShareLinkAction(formData);
    if (result.ok && result.url) {
      setShareUrl(result.url);
      setShareNotice("Copy this link now. It will not be shown again.");
      return;
    }
    setShareNotice(result.message ?? "The share link could not be created.");
  }

  async function onRevoke(formData: FormData) {
    setShareNotice(null);
    const result = await revokeShareLinkAction(formData);
    setShareNotice(result.message ?? (result.ok ? "Revoked." : "Failed."));
  }

  return (
    <div className="flex flex-col gap-8">
      {canMutate ? (
        <form action={onGenerate} className="flex flex-col gap-3">
          <input type="hidden" name="assetId" value={assetId} />
          <label className="flex flex-col gap-1">
            Format
            <select
              name="format"
              className="rounded-md border border-zinc-300 px-3 py-2"
              defaultValue="json"
            >
              <option value="json">JSON</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="includeRawPrompt"
              className="mt-1"
              defaultChecked={false}
            />
            <span>
              Include the raw prompt in this export. {RAW_PROMPT_EXPORT_WARNING}
            </span>
          </label>
          <button
            type="submit"
            className="w-fit rounded-md border border-zinc-300 px-4 py-2"
          >
            Generate evidence packet
          </button>
          {generateNotice ? <p role="status">{generateNotice}</p> : null}
        </form>
      ) : (
        <p>You can download existing packets for this organization.</p>
      )}

      <section
        className="flex flex-col gap-3"
        aria-labelledby="exports-heading"
      >
        <h2 id="exports-heading" className="text-xl font-semibold">
          Generated packets
        </h2>
        {exports.length === 0 ? (
          <p>No packets have been generated yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {exports.map((item) => {
              const itemShares = shares.filter(
                (share) => share.exportId === item.id,
              );
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 border border-zinc-200 p-4"
                >
                  <p>
                    {item.format.toUpperCase()} · {item.schemaVersion} ·{" "}
                    {item.generatedAt}
                  </p>
                  <p className="text-sm">
                    SHA-256 {item.contentSha256} · raw prompt{" "}
                    {item.includesRawPrompt ? "included" : "omitted"}
                    {item.chainHeadSequence
                      ? ` · chain head sequence ${item.chainHeadSequence}`
                      : " · no chain head"}
                  </p>
                  <p>
                    <a
                      className="underline"
                      href={`/app/assets/${assetId}/exports/${item.id}/download`}
                    >
                      Download packet
                    </a>
                  </p>
                  {canMutate ? (
                    <form action={onShare} className="flex flex-wrap gap-2">
                      <input type="hidden" name="assetId" value={assetId} />
                      <input type="hidden" name="exportId" value={item.id} />
                      <label className="flex items-center gap-2 text-sm">
                        Expires
                        <select
                          name="expires"
                          className="rounded-md border border-zinc-300 px-2 py-1"
                          defaultValue="none"
                        >
                          <option value="none">No expiry</option>
                          <option value="7d">7 days</option>
                          <option value="30d">30 days</option>
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 px-3 py-1"
                      >
                        Create share link
                      </button>
                    </form>
                  ) : null}
                  {itemShares.length > 0 ? (
                    <ul className="text-sm">
                      {itemShares.map((share) => (
                        <li key={share.id} className="flex flex-wrap gap-2">
                          <span>
                            Link {share.status}
                            {share.expiresAt
                              ? ` · expires ${share.expiresAt}`
                              : ""}
                          </span>
                          {canMutate && share.status === "active" ? (
                            <form action={onRevoke}>
                              <input
                                type="hidden"
                                name="assetId"
                                value={assetId}
                              />
                              <input
                                type="hidden"
                                name="shareLinkId"
                                value={share.id}
                              />
                              <button type="submit" className="underline">
                                Revoke
                              </button>
                            </form>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {shareNotice ? <p role="status">{shareNotice}</p> : null}
        {shareUrl ? (
          <p>
            Share URL: <code>{shareUrl}</code>
          </p>
        ) : null}
      </section>
    </div>
  );
}
