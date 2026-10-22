import {
  loadEditorialContent,
  saveArticle,
  saveCategory,
  saveChecklist,
} from "@nido/data";
import {
  type Article,
  type Category,
  type Checklist,
  validateArticle,
} from "@nido/core";
import {
  ApiError,
  authorizedEditor,
  errorResponse,
  sameOrigin,
} from "../../../lib/server";
export async function GET() {
  try {
    const { client, user } = await authorizedEditor();
    const content = await loadEditorialContent(client);
    return Response.json(
      { ...content, email: user.email },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client } = await authorizedEditor();
    const body = await request.json();
    if (body.action === "article") {
      const article = body.value as Article;
      if (
        !article ||
        typeof article.title !== "string" ||
        article.title.trim().length < 3
      )
        throw new ApiError(
          400,
          "Il titolo deve contenere almeno tre caratteri.",
        );
      if (article.status === "published") {
        const issues = validateArticle(article);
        if (issues.length) throw new ApiError(400, issues.join(" "));
      }
      return Response.json({ value: await saveArticle(client, article) });
    }
    if (body.action === "checklist") {
      const checklist = body.value as Checklist;
      if (
        !checklist ||
        typeof checklist.title !== "string" ||
        checklist.title.trim().length < 3 ||
        !Array.isArray(checklist.items)
      )
        throw new ApiError(
          400,
          "Completa il titolo e le voci della checklist.",
        );
      return Response.json({ value: await saveChecklist(client, checklist) });
    }
    if (body.action === "category") {
      const category = body.value as Category;
      if (
        !category ||
        typeof category.name !== "string" ||
        !category.name.trim() ||
        typeof category.id !== "string" ||
        !/^[a-z0-9-]{2,80}$/.test(category.id)
      )
        throw new ApiError(
          400,
          "La categoria richiede un nome e un identificatore valido.",
        );
      return Response.json({ value: await saveCategory(client, category) });
    }
    throw new ApiError(400, "Operazione non riconosciuta.");
  } catch (error) {
    return errorResponse(error);
  }
}
