import { expect, test } from "vitest";
import type { Checklist } from "../packages/core/src/types";
import { selectHomeChecklist } from "../apps/mobile/src/home-checklist";

function list(
  id: string,
  stage: Checklist["stage"] = "pregnancy",
  count = 2,
): Checklist {
  return {
    id,
    title: id,
    description: id,
    stage,
    status: "published",
    approved: true,
    items: Array.from({ length: count }, (_, i) => ({
      id: `${id}-${i}`,
      label: `Activity ${i}`,
    })),
  };
}
test("resumes the current phase's started list before a new list or one from another phase", () => {
  const fresh = list("fresh"),
    started = list("started"),
    other = list("other", "postpartum");
  expect(
    selectHomeChecklist(
      [fresh, other, started],
      { "started-0": true, "other-0": true },
      "pregnancy",
    ),
  ).toBe(started);
});
test("a started list remains reachable when the user changes their selected phase", () => {
  const fresh = list("fresh"),
    started = list("started", "postpartum");
  expect(
    selectHomeChecklist([fresh, started], { "started-0": true }, "pregnancy"),
  ).toBe(started);
});
test("skips empty and completed lists before suggesting unfinished work relevant to the path", () => {
  const empty = list("empty", "pregnancy", 0),
    done = list("done"),
    general = list("general", "all");
  expect(
    selectHomeChecklist(
      [empty, done, general],
      { "done-0": true, "done-1": true },
      "pregnancy",
    ),
  ).toBe(general);
});
test("keeps completed lists available to review, ignores unrelated progress and never mutates inputs", () => {
  const done = list("done");
  const lists = [done];
  const progress = { "done-0": true, "done-1": true, unrelated: true };
  const snapshot = JSON.stringify({ lists, progress });
  expect(selectHomeChecklist(lists, progress, "pregnancy")).toBe(done);
  expect(JSON.stringify({ lists, progress })).toBe(snapshot);
  expect(selectHomeChecklist([], progress, "pregnancy")).toBeUndefined();
});
