export type OnboardingStepId =
  "project" | "upload" | "declaration" | "review" | "export";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  done: boolean;
  href: string | null;
  nextAction: string;
};

export type OnboardingProgressInput = {
  projectId: string | null;
  assetId: string | null;
  assetReady: boolean;
  declarationStatus: string | null;
  hasExport: boolean;
};

export function onboardingSteps(
  input: OnboardingProgressInput,
): OnboardingStep[] {
  const projectHref = input.projectId
    ? `/app/projects/${input.projectId}`
    : "/app";
  const assetHref = input.assetId
    ? `/app/assets/${input.assetId}`
    : projectHref;
  const declarationHref = input.assetId
    ? `/app/assets/${input.assetId}/declaration`
    : assetHref;
  const exportHref = input.assetId
    ? `/app/assets/${input.assetId}/exports`
    : declarationHref;

  const projectDone = Boolean(input.projectId);
  const uploadDone = Boolean(input.assetId && input.assetReady);
  const declarationDone = Boolean(
    input.declarationStatus && input.declarationStatus !== "draft",
  );
  const reviewDone = input.declarationStatus === "reviewed";

  return [
    {
      id: "project",
      title: "Create or select a project",
      done: projectDone,
      href: projectHref,
      nextAction: "Create an organization project or the synthetic sample.",
    },
    {
      id: "upload",
      title: "Upload a file",
      done: uploadDone,
      href: projectHref,
      nextAction: "Upload the synthetic sample or another allowed file.",
    },
    {
      id: "declaration",
      title: "Complete the declaration",
      done: declarationDone,
      href: declarationHref,
      nextAction: "Finish the provenance declaration and submit it for review.",
    },
    {
      id: "review",
      title: "Record the human review",
      done: reviewDone,
      href: declarationHref,
      nextAction:
        "A person must approve, reject, or request changes. The automated recommendation is not the decision.",
    },
    {
      id: "export",
      title: "Generate an evidence packet",
      done: input.hasExport,
      href: exportHref,
      nextAction:
        "Generate a JSON or PDF evidence packet from the reviewed snapshot.",
    },
  ];
}

export function firstIncompleteStep(
  steps: OnboardingStep[],
): OnboardingStep | undefined {
  return steps.find((step) => !step.done);
}
