import { beforeEach, expect, test, vi } from "vitest";

const backend = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../apps/mobile/src/state", () => ({
  client: { auth: { getUser: backend.getUser }, from: backend.from },
}));
import { listDocuments } from "../apps/mobile/src/session-documents";

const own = "98f20cb6-6aef-4eba-a611-757430273ac1";
const other = "98f20cb6-6aef-4eba-a611-757430273ac2";
const word =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const rows = [
  {
    id: "own-word",
    recipient: own,
    state: "ready",
    active: true,
    mime_type: word,
  },
  {
    id: "other-word",
    recipient: other,
    state: "ready",
    active: true,
    mime_type: word,
  },
  {
    id: "own-pdf",
    recipient: own,
    state: "ready",
    active: true,
    mime_type: "application/pdf",
  },
  {
    id: "archived",
    recipient: own,
    state: "ready",
    active: false,
    mime_type: word,
  },
  {
    id: "uploading",
    recipient: own,
    state: "uploading",
    active: true,
    mime_type: word,
  },
];
const identity = (id: string) => ({ data: { user: { id } }, error: null });

function fixture(error = false) {
  const filters: Record<string, unknown> = {};
  const or = vi.fn();
  const range = vi.fn();
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((key: string, value: unknown) => {
      filters[key] = value;
      return query;
    }),
    or: (value: string) => {
      or(value);
      return query;
    },
    order: () => query,
    range: (start: number, end: number) => {
      range(start, end);
      return query;
    },
    returns: vi.fn(async () => ({
      data: rows.filter((row) =>
        Object.entries(filters).every(
          ([key, value]) =>
            (key === "session_document_access.user_id"
              ? row.recipient
              : row[key as keyof typeof row]) === value,
        ),
      ),
      error: error ? { message: "Database error" } : null,
    })),
  };
  backend.from.mockReturnValue(query);
  return { filters, or, range, query };
}

beforeEach(() => {
  vi.clearAllMocks();
  backend.getUser.mockResolvedValue(identity(own));
});

test("patient search and format retain own-recipient, active and ready restrictions", async () => {
  const { filters, or, range } = fixture();
  const result = await listDocuments(1, false, {
    term: " guida ",
    format: "docx",
  });
  expect(result.map((row) => row.id)).toEqual(["own-word"]);
  expect(filters).toEqual({
    "session_document_access.user_id": own,
    state: "ready",
    active: true,
    mime_type: word,
  });
  expect(or).toHaveBeenCalledWith(
    'title.ilike."%guida%",file_name.ilike."%guida%"',
  );
  expect(range).toHaveBeenCalledWith(20, 39);
});

test("a session change while a private search loads never returns the old account's rows", async () => {
  fixture();
  backend.getUser
    .mockResolvedValueOnce(identity(own))
    .mockResolvedValueOnce(identity(other));
  await expect(listDocuments(0, false, { format: "docx" })).rejects.toThrow(
    "Sessione cambiata",
  );
});

test("database errors do not masquerade as an empty private folder", async () => {
  fixture(true);
  await expect(listDocuments(0)).rejects.toThrow(
    "Non riusciamo a caricare i documenti",
  );
});

test("unsupported format filters are rejected before querying document rows", async () => {
  const { query } = fixture();
  await expect(
    listDocuments(0, false, { format: "exe" as "pdf" }),
  ).rejects.toThrow("formato");
  expect(query.returns).not.toHaveBeenCalled();
});
