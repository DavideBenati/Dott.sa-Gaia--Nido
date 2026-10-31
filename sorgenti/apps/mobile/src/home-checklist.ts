import type { Checklist, Stage } from "@nido/core";

/** Resume work already started before proposing a different published list. */
export function selectHomeChecklist(
  checklists: Checklist[],
  progress: Record<string, boolean>,
  stage: Stage,
): Checklist | undefined {
  const lists = checklists.filter((list) => list.items.length > 0);
  const completed = (list: Checklist) =>
    list.items.filter((item) => progress[item.id] === true).length;
  const started = (list: Checklist) => {
    const count = completed(list);
    return count > 0 && count < list.items.length;
  };
  const relevant = (list: Checklist) =>
    list.stage === stage || list.stage === "all";
  return (
    lists.find((list) => relevant(list) && started(list)) ??
    lists.find(started) ??
    lists.find(
      (list) => relevant(list) && completed(list) < list.items.length,
    ) ??
    lists.find((list) => completed(list) < list.items.length) ??
    lists.find(relevant) ??
    lists[0]
  );
}
