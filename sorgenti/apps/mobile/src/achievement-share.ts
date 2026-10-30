import type { Achievement } from "@nido/core";
import type { ContentShare } from "./share-content";

export function achievementShare(badge: Achievement): ContentShare {
  if (!badge.earned)
    throw new Error("Questo traguardo non è ancora completato.");
  return {
    title: `${badge.title} · MetiMaia`,
    text: `🌷 Un piccolo traguardo con MetiMaia: ${badge.title}.\nUn passo alla volta, con i miei tempi.`,
    url: badge.checklistId
      ? `https://metimaia.com/checklist?id=${encodeURIComponent(badge.checklistId)}`
      : "https://metimaia.com/welcome",
  };
}
