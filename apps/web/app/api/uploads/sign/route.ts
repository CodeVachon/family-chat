import { getSession } from "@/lib/dal";
import { isCloudinaryConfigured, signUpload } from "@/lib/cloudinary/server";

export const runtime = "nodejs";

export async function POST() {
    const session = await getSession();
    if (!session || session.user.approvalStatus !== "approved") {
        return new Response("Unauthorized", { status: 401 });
    }

    if (!isCloudinaryConfigured()) {
        return Response.json(
            { error: "Uploads are not configured. Set the CLOUDINARY_* env vars." },
            { status: 503 }
        );
    }

    const timestamp = Math.round(Date.now() / 1000);
    return Response.json(signUpload(timestamp, session.user.id));
}
