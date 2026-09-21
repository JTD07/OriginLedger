export function isShareLinkCurrentlyValid(
  link: { status: string; expiresAt: string | null },
  nowMs: number = Date.now(),
): boolean {
  if (link.status !== "active") {
    return false;
  }
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= nowMs) {
    return false;
  }
  return true;
}
