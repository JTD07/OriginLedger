/** @vitest-environment node */
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { SAMPLE_ASSET_FILENAME, SAMPLE_PROJECT_NAME } from "./constants";
import { createSampleProject, removeSampleProject } from "./service";

const { getOrgAccess } = vi.hoisted(() => ({
  getOrgAccess: vi.fn(),
}));

vi.mock("@/server/tenancy/access", () => ({
  getOrgAccess,
}));

vi.mock("@/server/assets/object-store", () => ({
  supabaseAssetObjectStore: {
    createSignedUpload: vi.fn(),
    download: vi.fn(),
    sizeOf: vi.fn(),
    remove: vi.fn(async () => undefined),
    createSignedPreview: vi.fn(),
  },
}));

type Row = Record<string, unknown>;

function createFakeClient(state: {
  projects: Row[];
  assets: Row[];
  insertError?: { message: string } | null;
  rpcError?: { message: string } | null;
}) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string, value: unknown) {
              return {
                eq(column2: string, value2: unknown) {
                  return {
                    async maybeSingle() {
                      const rows =
                        table === "projects" ? state.projects : state.assets;
                      const found = rows.find(
                        (row) =>
                          row[column] === value && row[column2] === value2,
                      );
                      return { data: found ?? null };
                    },
                    order() {
                      const rows = state.assets.filter(
                        (row) => row[column] === value,
                      );
                      return Promise.resolve({ data: rows });
                    },
                  };
                },
                order() {
                  const rows = (
                    table === "projects" ? state.projects : state.assets
                  ).filter((row) => row[column] === value);
                  return Promise.resolve({ data: rows });
                },
                async maybeSingle() {
                  const rows =
                    table === "projects" ? state.projects : state.assets;
                  const found = rows.find((row) => row[column] === value);
                  return { data: found ?? null };
                },
                async in() {
                  return { data: [] };
                },
              };
            },
            in() {
              return Promise.resolve({ data: [] });
            },
          };
        },
        insert(values: Row) {
          return {
            select() {
              return {
                async single() {
                  if (state.insertError) {
                    return { data: null, error: state.insertError };
                  }
                  const row = {
                    id: "11111111-1111-4111-8111-111111111111",
                    ...values,
                  };
                  state.projects.push(row);
                  return { data: row, error: null };
                },
              };
            },
          };
        },
      };
    },
    async rpc() {
      if (state.rpcError) {
        return { error: state.rpcError };
      }
      state.projects = state.projects.filter((row) => !row.is_sample);
      state.assets = [];
      return { error: null };
    },
    storage: {
      from() {
        return {
          async remove() {
            return { error: null };
          },
        };
      },
    },
  };
}

describe("sample project service", () => {
  beforeEach(() => {
    getOrgAccess.mockReset();
    getOrgAccess.mockResolvedValue({ canMutate: true, role: "owner" });
  });

  test("returns an existing ready sample instead of creating another file", async () => {
    const state = {
      projects: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: SAMPLE_PROJECT_NAME,
          is_sample: true,
        },
      ],
      assets: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          project_id: "11111111-1111-4111-8111-111111111111",
          status: "ready",
          storage_key: "org/project/asset",
          client_filename: SAMPLE_ASSET_FILENAME,
        },
      ],
    };
    const client = createFakeClient(state);
    const createUploadSession = vi.fn();
    const result = await createSampleProject({
      userClient: client as never,
      serviceClient: client as never,
      userId: "33333333-3333-4333-8333-333333333333",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ports: {
        createUploadSession,
        processAsset: vi.fn(),
        saveDeclarationDraft: vi.fn(),
        putObject: vi.fn(),
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sample.reused).toBe(true);
      expect(result.sample.assetId).toBe(
        "22222222-2222-4222-8222-222222222222",
      );
    }
    expect(createUploadSession).not.toHaveBeenCalled();
  });

  test("keeps the labeled project when processing fails", async () => {
    const state = {
      projects: [] as Row[],
      assets: [] as Row[],
    };
    const client = createFakeClient(state);
    const result = await createSampleProject({
      userClient: client as never,
      serviceClient: client as never,
      userId: "33333333-3333-4333-8333-333333333333",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ports: {
        createUploadSession: vi.fn(async () => ({
          ok: true as const,
          session: {
            asset: {
              id: "22222222-2222-4222-8222-222222222222",
              organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              project_id: "11111111-1111-4111-8111-111111111111",
              storage_key: "org/project/asset",
              status: "pending_upload" as const,
            },
            ticket: {
              bucket: "origin-assets",
              path: "org/project/asset",
              token: "ticket",
              signedUrl: "https://storage.example/upload",
            },
            expiresInSeconds: 60,
          },
        })),
        putObject: vi.fn(async () => undefined),
        processAsset: vi.fn(async () => ({
          ok: false as const,
          code: "invalid_signature" as const,
        })),
        saveDeclarationDraft: vi.fn(),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("processing_failed");
      expect(result.sample?.projectId).toBe(
        "11111111-1111-4111-8111-111111111111",
      );
    }
    expect(state.projects[0]?.name).toBe(SAMPLE_PROJECT_NAME);
    expect(state.projects[0]?.is_sample).toBe(true);
  });

  test("refuses sample creation without mutate access", async () => {
    getOrgAccess.mockResolvedValue({ canMutate: false, role: "viewer" });
    const client = createFakeClient({ projects: [], assets: [] });
    const result = await createSampleProject({
      userClient: client as never,
      serviceClient: client as never,
      userId: "33333333-3333-4333-8333-333333333333",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("forbidden");
    }
  });

  test("sample removal is idempotent when no sample exists", async () => {
    const client = createFakeClient({ projects: [], assets: [] });
    const first = await removeSampleProject({
      userClient: client as never,
      serviceClient: client as never,
      userId: "33333333-3333-4333-8333-333333333333",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const second = await removeSampleProject({
      userClient: client as never,
      serviceClient: client as never,
      userId: "33333333-3333-4333-8333-333333333333",
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
  });
});
