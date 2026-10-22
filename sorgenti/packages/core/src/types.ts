export type Stage = "pregnancy" | "postpartum" | "all";
export type JourneyType = "pregnancy" | "partner" | "postpartum";
export type PublicationStatus =
  "draft" | "in_review" | "published" | "archived";
export interface Category {
  id: string;
  name: string;
  icon: string;
}
export interface Reference {
  label: string;
  url: string;
}
export interface ArticleSection {
  heading: string;
  paragraphs: string[];
}
export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  categoryId: string;
  stage: Stage;
  weekFrom: number | null;
  weekTo: number | null;
  imageUrl: string;
  readingMinutes: number;
  authorName: string;
  authorRole: string;
  publishedAt: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  status: PublicationStatus;
  approved: boolean;
  isDemo: boolean;
  sections: ArticleSection[];
  references: Reference[];
  videoUrl: string | null;
}
export interface ChecklistItem {
  id: string;
  label: string;
  note?: string;
}
export interface Checklist {
  id: string;
  title: string;
  description: string;
  stage: Stage;
  status: PublicationStatus;
  approved: boolean;
  isDemo: boolean;
  items: ChecklistItem[];
}
export interface Preferences {
  journey: JourneyType;
  personalized: boolean;
  date: string | null;
  feedingTopics: string[];
  sensitiveConsent: boolean;
  notifications: boolean;
  marketing: boolean;
  onboarded: boolean;
}
export interface UserState {
  preferences: Preferences;
  favorites: string[];
  progress: Record<string, boolean>;
}
export interface JourneyInfo {
  stage: Stage;
  week: number | null;
  days: number | null;
  label: string;
  description: string;
}
export const defaultPreferences: Preferences = {
  journey: "pregnancy",
  personalized: false,
  date: null,
  feedingTopics: [],
  sensitiveConsent: false,
  notifications: false,
  marketing: false,
  onboarded: false,
};
export const defaultUserState: UserState = {
  preferences: defaultPreferences,
  favorites: [],
  progress: {},
};
