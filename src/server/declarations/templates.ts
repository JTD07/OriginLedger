export type TemplateCatalog = {
  id: string;
  en: string;
};

export const DISCLOSURE_TEMPLATES = {
  "none.human_created": {
    id: "none.human_created",
    en: "This file is recorded as created by a person. OriginLedger supports documentation and transparency workflows. It does not certify legal or regulatory compliance.",
  },
  "limited.ai_involved": {
    id: "limited.ai_involved",
    en: "This file is recorded as created with AI involvement{{toolClause}}. OriginLedger supports documentation and transparency workflows. It does not certify legal or regulatory compliance.",
  },
  "limited.incomplete_metadata": {
    id: "limited.incomplete_metadata",
    en: "AI involvement is recorded, but provider or model details are incomplete. A human reviewer should confirm any public disclosure wording. OriginLedger does not certify legal or regulatory compliance.",
  },
  "prominent.ai_involved": {
    id: "prominent.ai_involved",
    en: "This file is recorded as produced with AI{{toolClause}}. A prominent disclosure is recommended for the recorded distribution context. OriginLedger supports documentation and transparency workflows. It does not certify legal or regulatory compliance.",
  },
  "prominent.photorealistic_ai": {
    id: "prominent.photorealistic_ai",
    en: "This file is recorded as a photorealistic depiction produced with AI{{toolClause}}. A prominent disclosure is recommended. OriginLedger supports documentation and transparency workflows. It does not certify legal or regulatory compliance.",
  },
} as const;

export type DisclosureTemplateId = keyof typeof DISCLOSURE_TEMPLATES;

export type InterpolationData = {
  provider: string;
  model: string;
  modelVersion: string;
  generationDate: string;
  toolClause: string;
};

const TOKEN = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;

export function sanitizePlainText(value: string): string {
  return value
    .replace(/[<>{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function interpolationData(input: {
  provider: string;
  model: string;
  modelVersion: string;
  generationDate: string;
}): InterpolationData {
  const provider = sanitizePlainText(input.provider);
  const model = sanitizePlainText(input.model);
  const modelVersion = sanitizePlainText(input.modelVersion);
  const generationDate = sanitizePlainText(input.generationDate);
  const tool = [provider, model, modelVersion].filter(
    (part) => part.length > 0,
  );
  const toolClause = tool.length > 0 ? ` (${tool.join(", ")})` : "";
  return {
    provider,
    model,
    modelVersion,
    generationDate,
    toolClause,
  };
}

export function renderTemplate(
  templateId: DisclosureTemplateId,
  data: InterpolationData,
  locale: "en" = "en",
): string {
  const catalog = DISCLOSURE_TEMPLATES[templateId];
  const source = catalog[locale];
  return source.replace(TOKEN, (_match, key: string) => {
    const value = data[key as keyof InterpolationData];
    return typeof value === "string" ? value : "";
  });
}
