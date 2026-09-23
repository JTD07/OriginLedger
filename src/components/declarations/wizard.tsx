"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  recordDeclarationReviewAction,
  saveDeclarationDraftAction,
  startDeclarationEditAction,
  submitDeclarationAction,
} from "@/server/declarations/actions";
import {
  ASSESSMENT_STATUS_LABELS,
  CATEGORY_LABELS,
  CREATION_MODE_LABELS,
  DEPICTION_LABELS,
  EDITORIAL_REVIEW_LABELS,
  HUMAN_EDIT_LABELS,
  PUBLIC_INTEREST_LABELS,
  REGION_LABELS,
  VERSION_STATUS_LABELS,
} from "@/server/declarations/labels";
import {
  CONTENT_CATEGORIES,
  CREATION_MODES,
  DISTRIBUTION_REGIONS,
  EDITORIAL_REVIEW_STATUSES,
  HUMAN_EDITS,
  PUBLIC_INTEREST_STATUSES,
  REALISTIC_DEPICTIONS,
  WIZARD_STEPS,
  emptyDraft,
  fieldErrorsFromZod,
  firstIncompleteStep,
  validateWizardStep,
  type DeclarationDraft,
  type DistributionRegion,
  type WizardStepId,
} from "@/server/declarations/schema";
import type {
  AssessmentView,
  DeclarationWorkspace,
} from "@/server/declarations/types";
import { HUMAN_REVIEW_NOTICE } from "@/server/declarations/version";

function currentAssessment(
  workspace: DeclarationWorkspace,
): AssessmentView | undefined {
  const versionId = workspace.currentVersion?.id;
  if (!versionId) {
    return undefined;
  }
  return workspace.assessments.find(
    (assessment) =>
      assessment.declarationVersionId === versionId &&
      assessment.status === "current",
  );
}

function staleAssessments(workspace: DeclarationWorkspace): AssessmentView[] {
  const versionId = workspace.currentVersion?.id;
  return workspace.assessments.filter(
    (assessment) =>
      assessment.declarationVersionId === versionId &&
      assessment.status !== "current",
  );
}

export function DeclarationWizard({
  assetId,
  fileName,
  workspace,
}: {
  assetId: string;
  fileName: string;
  workspace: DeclarationWorkspace;
}) {
  const router = useRouter();
  const initial = workspace.currentVersion?.draft ?? emptyDraft();
  const [values, setValues] = useState<DeclarationDraft>(initial);
  const [stepId, setStepId] = useState<WizardStepId>(
    workspace.currentVersion
      ? firstIncompleteStep(workspace.currentVersion.draft)
      : "creation",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [responseNotes, setResponseNotes] = useState("");
  const errorHeading = useRef<HTMLHeadingElement>(null);
  const formId = useId();

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      errorHeading.current?.focus();
    }
  }, [errors]);

  const stepIndex = WIZARD_STEPS.findIndex((step) => step.id === stepId);
  const step = WIZARD_STEPS[stepIndex] ?? WIZARD_STEPS[0];
  const status = workspace.currentVersion?.status;
  const recommendation = currentAssessment(workspace);
  const stale = staleAssessments(workspace);
  const readOnly =
    !workspace.canMutate ||
    status === "reviewed" ||
    status === "rejected" ||
    status === "pending_review";

  function update<K extends keyof DeclarationDraft>(
    key: K,
    value: DeclarationDraft[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function persist(next: DeclarationDraft) {
    const result = await saveDeclarationDraftAction(assetId, next);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    setMessage("Draft saved.");
    return true;
  }

  async function goNext() {
    const error = validateWizardStep(step.id, values);
    if (error) {
      setErrors(fieldErrorsFromZod(error));
      return;
    }
    setErrors({});
    setPending(true);
    const saved = await persist(values);
    setPending(false);
    if (!saved) {
      return;
    }
    const next = WIZARD_STEPS[stepIndex + 1];
    if (next) {
      setStepId(next.id);
    }
  }

  function goBack() {
    const previous = WIZARD_STEPS[stepIndex - 1];
    if (previous) {
      setErrors({});
      setStepId(previous.id);
    }
  }

  async function saveDraft() {
    setPending(true);
    await persist(values);
    setPending(false);
  }

  async function submit() {
    const error = validateWizardStep("review", values);
    if (error) {
      setErrors(fieldErrorsFromZod(error));
      setStepId("review");
      return;
    }
    setErrors({});
    setPending(true);
    const result = await submitDeclarationAction(assetId, {
      ...values,
      responseNotes,
    });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      }
      return;
    }
    router.refresh();
  }

  async function startEdit() {
    setPending(true);
    const result = await startDeclarationEditAction(assetId);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    router.refresh();
  }

  if (workspace.assetStatus !== "ready") {
    return (
      <p role="status">
        Provenance declarations can be created after this file is ready.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-zinc-700">
        File: {fileName}. OriginLedger supports documentation and transparency
        workflows. It does not certify legal or regulatory compliance.
      </p>

      {status ? (
        <p role="status" className="font-medium">
          {VERSION_STATUS_LABELS[status]}
          {workspace.currentVersion
            ? ` (version ${workspace.currentVersion.versionNumber})`
            : ""}
        </p>
      ) : (
        <p role="status" className="font-medium">
          Draft declaration
        </p>
      )}

      {recommendation ? (
        <section
          aria-labelledby="recommendation-heading"
          className="flex flex-col gap-2 border border-zinc-200 p-4"
        >
          <h2 id="recommendation-heading" className="text-lg font-semibold">
            Automated disclosure recommendation
          </h2>
          <p className="text-sm font-medium">
            {ASSESSMENT_STATUS_LABELS[recommendation.status]} — not a final
            compliance decision
          </p>
          <p>Recommended level: {recommendation.recommendationLevel}</p>
          <p className="whitespace-pre-wrap">
            {recommendation.visibleDisclosureText}
          </p>
          <p role="note" className="text-sm">
            {recommendation.humanReviewNotice || HUMAN_REVIEW_NOTICE}
          </p>
          <p className="text-sm text-zinc-600">
            Ruleset {recommendation.rulesetVersion}. Reason codes:{" "}
            {recommendation.reasonCodes.join(", ")}
          </p>
        </section>
      ) : null}

      {stale.map((assessment) => (
        <p key={assessment.id} role="status" className="text-sm text-zinc-700">
          {ASSESSMENT_STATUS_LABELS[assessment.status]} from ruleset{" "}
          {assessment.rulesetVersion} is not current and must not be used as the
          active recommendation.
        </p>
      ))}

      <p>
        <a className="underline" href={`/app/assets/${assetId}/history`}>
          Integrity-verified history
        </a>
        {" · "}
        <a className="underline" href={`/app/assets/${assetId}/exports`}>
          Evidence packets
        </a>
      </p>

      {workspace.reviews.length > 0 ? (
        <section className="flex flex-col gap-2 border border-zinc-200 p-4">
          <h2 className="text-lg font-semibold">Review history</h2>
          <ol className="flex flex-col gap-2">
            {workspace.reviews.map((review) => (
              <li key={review.id}>
                <p>
                  {review.decision === "accepted"
                    ? "Approved"
                    : review.decision === "rejected"
                      ? "Rejected"
                      : "Changes requested"}
                </p>
                {review.notes ? (
                  <p className="whitespace-pre-wrap">{review.notes}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {(status === "reviewed" || status === "rejected") &&
      workspace.canMutate ? (
        <button
          type="button"
          className="min-h-11 w-fit rounded-md border border-zinc-300 px-4 py-2"
          disabled={pending}
          onClick={() => void startEdit()}
        >
          Create a new version to edit
        </button>
      ) : null}

      {status === "pending_review" && workspace.canReview ? (
        <HumanReviewForm assetId={assetId} pending={pending} />
      ) : null}

      {status === "pending_review" &&
      workspace.canMutate &&
      !workspace.canReview ? (
        <p role="status">
          Waiting for an owner, admin, or reviewer to record the human review
          decision. Contributors cannot approve, reject, or request changes.
        </p>
      ) : null}

      {status === "changes_requested" ? (
        <p role="status">
          A reviewer requested changes. Contributors may edit this version and
          resubmit. The previous review history is kept.
        </p>
      ) : null}

      {readOnly && (status === "reviewed" || status === "rejected") ? (
        <DeclarationSummary
          values={workspace.currentVersion?.draft ?? values}
        />
      ) : null}

      {!readOnly ? (
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (step.id === "review") {
              void submit();
              return;
            }
            void goNext();
          }}
        >
          <div>
            <p id={`${formId}-progress`} className="mb-2 text-sm">
              Step {stepIndex + 1} of {WIZARD_STEPS.length}
            </p>
            <p className="mb-2 text-sm font-medium">{step.title}</p>
            <progress
              aria-labelledby={`${formId}-progress`}
              max={WIZARD_STEPS.length}
              value={stepIndex + 1}
            />
            <ol className="mt-3 flex flex-col gap-1 text-sm">
              {WIZARD_STEPS.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="underline disabled:no-underline disabled:text-zinc-500"
                    aria-current={item.id === step.id ? "step" : undefined}
                    disabled={index > stepIndex}
                    onClick={() => {
                      setErrors({});
                      setStepId(item.id);
                    }}
                  >
                    {index + 1}. {item.title}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {Object.keys(errors).length > 0 ? (
            <div className="border border-red-300 p-3" role="alert">
              <h2
                ref={errorHeading}
                tabIndex={-1}
                className="text-base font-semibold"
              >
                Fix the following errors
              </h2>
              <ul className="list-disc pl-5">
                {Object.entries(errors).map(([field, text]) => (
                  <li key={field}>
                    <a className="underline" href={`#${formId}-${field}`}>
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {message ? (
            <p role="status" className="text-sm">
              {message}
            </p>
          ) : null}

          {step.id === "creation" ? (
            <fieldset className="flex flex-col gap-2">
              <legend id={`${formId}-creationMode`} className="font-medium">
                Creation mode
              </legend>
              {CREATION_MODES.map((mode) => (
                <label key={mode} className="flex gap-2">
                  <input
                    type="radio"
                    name="creationMode"
                    value={mode}
                    checked={values.creationMode === mode}
                    onChange={() => update("creationMode", mode)}
                  />
                  {CREATION_MODE_LABELS[mode]}
                </label>
              ))}
            </fieldset>
          ) : null}

          {step.id === "tools" ? (
            <div className="flex flex-col gap-3">
              <Field
                id={`${formId}-provider`}
                label="Provider"
                value={values.provider ?? ""}
                error={errors.provider}
                onChange={(value) => update("provider", value)}
              />
              <Field
                id={`${formId}-model`}
                label="Model"
                value={values.model ?? ""}
                error={errors.model}
                onChange={(value) => update("model", value)}
              />
              <Field
                id={`${formId}-modelVersion`}
                label="Model version"
                value={values.modelVersion ?? ""}
                error={errors.modelVersion}
                onChange={(value) => update("modelVersion", value)}
              />
              <Field
                id={`${formId}-generationDate`}
                label="Generation date"
                type="date"
                value={values.generationDate ?? ""}
                error={errors.generationDate}
                onChange={(value) => update("generationDate", value)}
              />
            </div>
          ) : null}

          {step.id === "sources" ? (
            <div className="flex flex-col gap-3">
              <Field
                id={`${formId}-sourceNotes`}
                label="Source notes"
                multiline
                value={values.sourceNotes ?? ""}
                error={errors.sourceNotes}
                onChange={(value) => update("sourceNotes", value)}
              />
              <Field
                id={`${formId}-promptSummary`}
                label="Prompt summary"
                multiline
                value={values.promptSummary ?? ""}
                error={errors.promptSummary}
                hint="A short description is enough. You do not need to store a raw prompt."
                onChange={(value) => update("promptSummary", value)}
              />
              <label className="flex gap-2">
                <input
                  id={`${formId}-rawPromptCaptureEnabled`}
                  type="checkbox"
                  checked={values.rawPromptCaptureEnabled ?? false}
                  onChange={(event) =>
                    update("rawPromptCaptureEnabled", event.target.checked)
                  }
                />
                Store the raw prompt (optional)
              </label>
              <p className="text-sm text-zinc-600">
                Raw prompt capture is off by default. OriginLedger does not
                require it. If you turn it on, the raw text is stored with the
                same organization, project, and asset isolation as this
                declaration.
              </p>
              {values.rawPromptCaptureEnabled ? (
                <Field
                  id={`${formId}-rawPrompt`}
                  label="Raw prompt"
                  multiline
                  value={values.rawPrompt ?? ""}
                  error={errors.rawPrompt}
                  hint="This exact text will be stored. A prompt summary remains the ordinary field."
                  onChange={(value) => update("rawPrompt", value)}
                />
              ) : null}
            </div>
          ) : null}

          {step.id === "edits" ? (
            <fieldset className="flex flex-col gap-2">
              <legend id={`${formId}-humanEdits`} className="font-medium">
                Human edits
              </legend>
              {HUMAN_EDITS.map((value) => (
                <label key={value} className="flex gap-2">
                  <input
                    type="radio"
                    name="humanEdits"
                    value={value}
                    checked={values.humanEdits === value}
                    onChange={() => update("humanEdits", value)}
                  />
                  {HUMAN_EDIT_LABELS[value]}
                </label>
              ))}
            </fieldset>
          ) : null}

          {step.id === "distribution" ? (
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend
                  id={`${formId}-distributionRegions`}
                  className="font-medium"
                >
                  Distribution regions
                </legend>
                {DISTRIBUTION_REGIONS.map((region) => {
                  const selected = values.distributionRegions ?? [];
                  return (
                    <label key={region} className="flex gap-2">
                      <input
                        type="checkbox"
                        name="distributionRegions"
                        value={region}
                        checked={selected.includes(region)}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...selected, region]
                            : selected.filter(
                                (item: DistributionRegion) => item !== region,
                              );
                          update("distributionRegions", next);
                        }}
                      />
                      {REGION_LABELS[region]}
                    </label>
                  );
                })}
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend
                  id={`${formId}-contentCategory`}
                  className="font-medium"
                >
                  Content category
                </legend>
                {CONTENT_CATEGORIES.map((category) => (
                  <label key={category} className="flex gap-2">
                    <input
                      type="radio"
                      name="contentCategory"
                      value={category}
                      checked={values.contentCategory === category}
                      onChange={() => update("contentCategory", category)}
                    />
                    {CATEGORY_LABELS[category]}
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}

          {step.id === "context" ? (
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend
                  id={`${formId}-realisticDepiction`}
                  className="font-medium"
                >
                  Realistic-depiction status
                </legend>
                {REALISTIC_DEPICTIONS.map((value) => (
                  <label key={value} className="flex gap-2">
                    <input
                      type="radio"
                      name="realisticDepiction"
                      value={value}
                      checked={values.realisticDepiction === value}
                      onChange={() => update("realisticDepiction", value)}
                    />
                    {DEPICTION_LABELS[value]}
                  </label>
                ))}
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend id={`${formId}-publicInterest`} className="font-medium">
                  Public-interest information
                </legend>
                {PUBLIC_INTEREST_STATUSES.map((value) => (
                  <label key={value} className="flex gap-2">
                    <input
                      type="radio"
                      name="publicInterest"
                      value={value}
                      checked={values.publicInterest === value}
                      onChange={() => update("publicInterest", value)}
                    />
                    {PUBLIC_INTEREST_LABELS[value]}
                  </label>
                ))}
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend
                  id={`${formId}-editorialReview`}
                  className="font-medium"
                >
                  Editorial-review information
                </legend>
                {EDITORIAL_REVIEW_STATUSES.map((value) => (
                  <label key={value} className="flex gap-2">
                    <input
                      type="radio"
                      name="editorialReview"
                      value={value}
                      checked={values.editorialReview === value}
                      onChange={() => update("editorialReview", value)}
                    />
                    {EDITORIAL_REVIEW_LABELS[value]}
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}

          {step.id === "review" ? (
            <div className="flex flex-col gap-3">
              <DeclarationSummary values={values} />
              {status === "changes_requested" ? (
                <label className="flex flex-col gap-1">
                  <span>Response to the change request</span>
                  <textarea
                    className="rounded-md border border-zinc-300 px-3 py-2"
                    value={responseNotes}
                    onChange={(event) => setResponseNotes(event.target.value)}
                    required
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {stepIndex > 0 ? (
              <button
                type="button"
                className="min-h-11 rounded-md border border-zinc-300 px-4 py-2"
                onClick={goBack}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-4 py-2"
              disabled={pending}
              onClick={() => void saveDraft()}
            >
              Save draft
            </button>
            {step.id === "review" ? (
              <button
                type="submit"
                className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
                disabled={pending}
              >
                {status === "changes_requested"
                  ? "Submit response"
                  : "Submit for human review"}
              </button>
            ) : (
              <button
                type="submit"
                className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
                disabled={pending}
              >
                Continue
              </button>
            )}
          </div>
        </form>
      ) : null}

      {readOnly && status === "pending_review" ? (
        <DeclarationSummary
          values={workspace.currentVersion?.draft ?? values}
        />
      ) : null}

      {!workspace.canMutate && !workspace.currentVersion ? (
        <p role="status">
          Viewers can read declarations after an operator creates one.
        </p>
      ) : null}
    </div>
  );
}

function HumanReviewForm({
  assetId,
  pending,
}: {
  assetId: string;
  pending: boolean;
}) {
  const [action, setAction] = useState<
    "approve" | "reject" | "request_changes"
  >("approve");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 border border-zinc-200 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const result = await recordDeclarationReviewAction({
          assetId,
          action,
          notes,
        });
        setBusy(false);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.refresh();
      }}
    >
      <h2 className="text-lg font-semibold">Human review</h2>
      <p>
        A person must make the final disclosure decision. The automated
        recommendation is not a legal or compliance determination.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Review decision</legend>
        <label className="flex gap-2">
          <input
            type="radio"
            name="decision"
            checked={action === "approve"}
            onChange={() => setAction("approve")}
          />
          Approve this version
        </label>
        <label className="flex gap-2">
          <input
            type="radio"
            name="decision"
            checked={action === "request_changes"}
            onChange={() => setAction("request_changes")}
          />
          Request changes
        </label>
        <label className="flex gap-2">
          <input
            type="radio"
            name="decision"
            checked={action === "reject"}
            onChange={() => setAction("reject")}
          />
          Reject this version
        </label>
      </fieldset>
      <label className="flex flex-col gap-1" htmlFor="review-notes">
        <span>
          Review notes
          {action === "approve" ? " (optional)" : " (required)"}
        </span>
        <textarea
          id="review-notes"
          className="min-h-24 rounded-md border border-zinc-300 px-3 py-2"
          value={notes}
          required={action !== "approve"}
          aria-required={action !== "approve"}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {message ? (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        className="min-h-11 w-fit rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
        disabled={pending || busy}
      >
        Record human review
      </button>
    </form>
  );
}

function DeclarationSummary({ values }: { values: DeclarationDraft }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[12rem_1fr]">
      <dt>Creation mode</dt>
      <dd>
        {values.creationMode
          ? CREATION_MODE_LABELS[values.creationMode]
          : "Not set"}
      </dd>
      <dt>Provider</dt>
      <dd>{values.provider || "Not set"}</dd>
      <dt>Model</dt>
      <dd>{values.model || "Not set"}</dd>
      <dt>Model version</dt>
      <dd>{values.modelVersion || "Not set"}</dd>
      <dt>Generation date</dt>
      <dd>{values.generationDate || "Not set"}</dd>
      <dt>Source notes</dt>
      <dd>{values.sourceNotes || "Not set"}</dd>
      <dt>Prompt summary</dt>
      <dd>{values.promptSummary || "Not set"}</dd>
      <dt>Raw prompt stored</dt>
      <dd>{values.rawPromptCaptureEnabled ? "Yes" : "No"}</dd>
      <dt>Human edits</dt>
      <dd>
        {values.humanEdits ? HUMAN_EDIT_LABELS[values.humanEdits] : "Not set"}
      </dd>
      <dt>Distribution regions</dt>
      <dd>
        {(values.distributionRegions ?? [])
          .map((region) => REGION_LABELS[region])
          .join(", ") || "Not set"}
      </dd>
      <dt>Content category</dt>
      <dd>
        {values.contentCategory
          ? CATEGORY_LABELS[values.contentCategory]
          : "Not set"}
      </dd>
      <dt>Realistic-depiction status</dt>
      <dd>
        {values.realisticDepiction
          ? DEPICTION_LABELS[values.realisticDepiction]
          : "Not set"}
      </dd>
      <dt>Public-interest information</dt>
      <dd>
        {values.publicInterest
          ? PUBLIC_INTEREST_LABELS[values.publicInterest]
          : "Not set"}
      </dd>
      <dt>Editorial-review information</dt>
      <dd>
        {values.editorialReview
          ? EDITORIAL_REVIEW_LABELS[values.editorialReview]
          : "Not set"}
      </dd>
    </dl>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  multiline?: boolean;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="min-h-24 rounded-md border border-zinc-300 px-3 py-2"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          className="min-h-11 rounded-md border border-zinc-300 px-3 py-2"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint ? (
        <p id={hintId} className="text-sm text-zinc-700">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
