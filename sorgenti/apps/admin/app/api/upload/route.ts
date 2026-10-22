import { uploadEditorialImage } from "@nido/data";
import {
  ApiError,
  authorizedEditor,
  errorResponse,
  sameOrigin,
} from "../../../lib/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client } = await authorizedEditor();
    const data = await request.formData();
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      throw new ApiError(
        400,
        "Scegli un’immagine JPG, PNG o WebP di massimo 5 MB.",
      );
    return Response.json({
      url: await uploadEditorialImage(client, file, file.name),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
