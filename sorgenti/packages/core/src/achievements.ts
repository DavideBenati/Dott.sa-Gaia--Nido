import type { Checklist, Preferences } from "./types";
import { hasCompletedProfileType } from "./profile-types";

export interface Achievement {
  id: string;
  kind: "account" | "profile" | "saved" | "selection" | "checklist";
  title: string;
  description: string;
  earned: boolean;
  checklistId?: string;
  completed?: number;
  total?: number;
}

/** These milestones reflect owned saved state; none claims to verify purchases. */
export function memberAchievements(input: {
  authenticated: boolean;
  firstRecommendationSelected?: boolean;
  preferences: Preferences;
  favorites: readonly string[];
  checklists: readonly Checklist[];
  progress: Readonly<Record<string, boolean>>;
}): Achievement[] {
  return [
    {
      id: "welcome",
      kind: "account",
      title: "Benvenuto in MetiMaia",
      description: "Hai creato il tuo account e fatto il primo accesso.",
      earned: input.authenticated,
    },
    {
      id: "profile-ready",
      kind: "profile",
      title: "Il mio spazio è pronto",
      description:
        "Hai scelto il tipo di profilo e completato il percorso iniziale.",
      earned: input.authenticated && hasCompletedProfileType(input.preferences),
    },
    {
      id: "first-saved-reading",
      kind: "saved",
      title: "Una lettura da ritrovare",
      description: "Hai iniziato a salvare le letture che vuoi ritrovare.",
      earned: input.favorites.length > 0,
    },
    {
      id: "first-selection",
      kind: "selection",
      title: "Prima selezione",
      description: "Hai scelto il tuo primo consiglio d’acquisto su MetiMaia.",
      earned: input.authenticated && input.firstRecommendationSelected === true,
    },
    ...input.checklists.map((checklist) => {
      const completed = checklist.items.filter(
        (item) => input.progress[item.id] === true,
      ).length;
      return {
        id: `checklist:${checklist.id}`,
        kind: "checklist" as const,
        title: checklist.title,
        description:
          "Hai completato tutte le attività di questa checklist, con i tuoi tempi.",
        earned:
          checklist.items.length > 0 && completed === checklist.items.length,
        checklistId: checklist.id,
        completed,
        total: checklist.items.length,
      };
    }),
  ];
}
