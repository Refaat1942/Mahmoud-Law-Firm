import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, getCurrentUser } from "@/lib/session";
import { getFileBuffer } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { canPreview, documentScope } from "@/server/documents/queries";

/** Streams one stored version after checking the viewer may see the document. `?inline=1` opens PDFs and images in the browser. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.clientId || !can(user, "documents")) return new NextResponse(null, { status: 403 });
  const { versionId } = await params;
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, document: documentScope(user) },
  });
  if (!version) return new NextResponse(null, { status: 404 });

  let body: Buffer;
  try {
    body = await getFileBuffer(version.storageKey);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  await audit({ userId: user.id, action: "download", entity: "Document", entityId: version.documentId, data: { version: version.version } });

  const inline = req.nextUrl.searchParams.get("inline") === "1" && canPreview(version.mimeType);
  const disposition = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(version.fileName)}`;
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": inline ? version.mimeType : "application/octet-stream",
      "Content-Disposition": disposition,
      "Content-Length": String(body.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
