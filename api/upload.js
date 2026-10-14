/**
 * /api/upload — hands the browser a short-lived token so it can upload a video (or a
 * large image) straight into storage. Files that size can't pass through a function,
 * which caps request bodies at about 4.5 MB.
 */
import { handleUpload } from "@vercel/blob/client";

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Bad upload request." }, { status: 400 }); }
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "image/*"],
        maximumSizeInBytes: 500 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      // The creative itself is saved by the page once the upload finishes.
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
