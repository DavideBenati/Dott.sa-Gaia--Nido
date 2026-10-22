import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  defaultUserState,
  type Article,
  type Category,
  type Checklist,
  type Preferences,
  type UserState,
} from "@nido/core";

export type { SupabaseClient };
export interface Content {
  articles: Article[];
  checklists: Checklist[];
  categories: Category[];
}
type StorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Absence opts into demo. A partially configured backend is an error, never a silent fallback. */
export function createNidoClient(
  url?: string,
  key?: string,
  options?: { storage?: StorageAdapter },
): SupabaseClient | null {
  if (!url && !key) return null;
  if (!url || !key)
    throw new Error(
      "Configurazione Supabase incompleta: specifica URL e chiave pubblica.",
    );
  if (key.startsWith("sb_secret_"))
    throw new Error(
      "Usa soltanto una chiave Supabase pubblica publishable/anon.",
    );
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ) as { role?: string };
      if (payload.role === "service_role")
        throw new Error(
          "Usa soltanto una chiave Supabase pubblica publishable/anon.",
        );
    } catch (error) {
      if (error instanceof Error && error.message.includes("publishable/anon"))
        throw error;
    }
  }
  if (
    !url.startsWith("https://") &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url)
  )
    throw new Error("Supabase richiede HTTPS.");
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: !options?.storage,
      ...(options?.storage ? { storage: options.storage } : {}),
    },
  });
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
async function userId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  check(error);
  if (!data.user)
    throw new Error("Accedi per salvare i tuoi dati sul tuo account.");
  return data.user.id;
}

const bucket = "editorial-images";
const prefix = `storage://${bucket}/`;
function storagePath(url: string): string | null {
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  const marker = `/storage/v1/object/sign/${bucket}/`;
  if (url.includes(marker))
    return decodeURIComponent(url.split(marker)[1].split("?")[0]);
  return null;
}
async function resolveArticle(
  client: SupabaseClient,
  article: Article,
): Promise<Article> {
  const path = storagePath(article.imageUrl);
  if (!path) return article;
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  check(error);
  return { ...article, imageUrl: data!.signedUrl };
}

async function readContent(
  client: SupabaseClient,
  editorial: boolean,
): Promise<Content> {
  let articleQuery = client.from("articles").select("payload");
  let checklistQuery = client.from("checklists").select("payload");
  if (!editorial) {
    articleQuery = articleQuery
      .eq("status", "published")
      .eq("approved", true)
      .eq("is_demo", false);
    checklistQuery = checklistQuery
      .eq("status", "published")
      .eq("approved", true)
      .eq("is_demo", false);
  }
  const [ar, cl, ca] = await Promise.all([
    articleQuery.order("updated_at", { ascending: false }),
    checklistQuery.order("created_at"),
    client.from("article_categories").select("id,name,icon").order("name"),
  ]);
  check(ar.error);
  check(cl.error);
  check(ca.error);
  return {
    articles: await Promise.all(
      (ar.data ?? []).map((row) =>
        resolveArticle(client, row.payload as Article),
      ),
    ),
    checklists: (cl.data ?? []).map((row) => row.payload as Checklist),
    categories: (ca.data ?? []) as Category[],
  };
}
export async function loadPublicContent(
  client: SupabaseClient,
): Promise<Content> {
  return readContent(client, false);
}
export async function loadEditorialContent(
  client: SupabaseClient,
): Promise<Content> {
  await assertEditor(client);
  return readContent(client, true);
}
export async function assertEditor(client: SupabaseClient): Promise<void> {
  await userId(client);
  const { data, error } = await client.rpc("is_editor");
  check(error);
  if (!data) throw new Error("Accesso riservato alla redazione autorizzata.");
}

export async function loadUserState(
  client: SupabaseClient,
): Promise<UserState> {
  const id = await userId(client);
  const [p, f, c, n] = await Promise.all([
    client
      .from("user_preferences")
      .select("payload")
      .eq("user_id", id)
      .maybeSingle(),
    client.from("user_favorites").select("article_id").eq("user_id", id),
    client
      .from("checklist_progress")
      .select("item_id,completed")
      .eq("user_id", id),
    client
      .from("notification_preferences")
      .select("enabled,marketing")
      .eq("user_id", id)
      .maybeSingle(),
  ]);
  check(p.error);
  check(f.error);
  check(c.error);
  check(n.error);
  return {
    preferences: {
      ...defaultUserState.preferences,
      ...(p.data?.payload ?? {}),
      notifications: n.data?.enabled ?? false,
      marketing: n.data?.marketing ?? false,
    },
    favorites: (f.data ?? []).map((row) => row.article_id as string),
    progress: Object.fromEntries(
      (c.data ?? []).map((row) => [
        row.item_id as string,
        row.completed as boolean,
      ]),
    ),
  };
}
export async function savePreferences(
  client: SupabaseClient,
  preferences: Preferences,
): Promise<void> {
  await userId(client);
  const sanitized = {
    ...preferences,
    date: preferences.sensitiveConsent ? preferences.date : null,
  };
  const { error } = await client.rpc("save_preferences", {
    preferences: sanitized,
  });
  check(error);
}
export async function setFavorite(
  client: SupabaseClient,
  articleId: string,
  active: boolean,
): Promise<void> {
  const id = await userId(client);
  const { error } = active
    ? await client
        .from("user_favorites")
        .upsert({ user_id: id, article_id: articleId })
    : await client
        .from("user_favorites")
        .delete()
        .eq("user_id", id)
        .eq("article_id", articleId);
  check(error);
}
export async function setChecklistProgress(
  client: SupabaseClient,
  itemId: string,
  completed: boolean,
): Promise<void> {
  const id = await userId(client);
  const { error } = await client
    .from("checklist_progress")
    .upsert({ user_id: id, item_id: itemId, completed });
  check(error);
}
export async function exportUserData(client: SupabaseClient): Promise<object> {
  await userId(client);
  const { data, error } = await client.rpc("export_my_data");
  check(error);
  return data as object;
}
export async function deleteAccount(client: SupabaseClient): Promise<void> {
  await userId(client);
  const { error } = await client.rpc("delete_my_account");
  check(error);
  await client.auth.signOut({ scope: "local" });
}
export async function saveArticle(
  client: SupabaseClient,
  article: Article,
): Promise<Article> {
  await assertEditor(client);
  const path = storagePath(article.imageUrl);
  const payload = {
    ...article,
    imageUrl: path ? `${prefix}${path}` : article.imageUrl,
  };
  const { data, error } = await client.rpc("save_article", {
    document: payload,
  });
  check(error);
  return resolveArticle(client, data as Article);
}
export async function saveChecklist(
  client: SupabaseClient,
  checklist: Checklist,
): Promise<Checklist> {
  await assertEditor(client);
  const { data, error } = await client.rpc("save_checklist", {
    document: checklist,
  });
  check(error);
  return data as Checklist;
}
export async function saveCategory(
  client: SupabaseClient,
  category: Category,
): Promise<Category> {
  await assertEditor(client);
  const { data, error } = await client
    .from("article_categories")
    .upsert(category)
    .select("id,name,icon")
    .single();
  check(error);
  return data as Category;
}
export async function uploadEditorialImage(
  client: SupabaseClient,
  file: Blob,
  fileName: string,
): Promise<string> {
  await assertEditor(client);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Scegli un’immagine JPEG, PNG o WebP.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("L’immagine deve essere inferiore a 5 MB.");
  const extension =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : "webp";
  const safeName =
    fileName.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 30) || "immagine";
  const path = `${await userId(client)}/${crypto.randomUUID()}-${safeName}.${extension}`;
  const { error } = await client.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  check(error);
  const { data, error: signError } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  check(signError);
  return data!.signedUrl;
}
