import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

const select = { id: true, originalFileName: true, fileType: true, fileSize: true, environment: true, uploadedAt: true, certificateSubject: true, certificateIssuer: true, certificateSerial: true, certificateValidFrom: true, certificateValidTo: true, fingerprintSha256: true, active: true, uploadedBy: { select: { name: true } } } as const;

export async function GET() {
  try { await requirePermission("company.settings.manage"); return NextResponse.json({ data: await prisma.arcaCredentialFile.findMany({ select, orderBy: { uploadedAt: "desc" } }) }); }
  catch { return NextResponse.json({ error: "No autorizado" }, { status: 403 }); }
}
