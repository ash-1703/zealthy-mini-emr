import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const form = await req.formData();
  const method = String(form.get("_method") || "POST").toUpperCase();
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid appointment id" }, { status: 400 });
  }

  if (method === "DELETE") {
    await prisma.appointment.delete({ where: { id } }); 
  } else if (method === "PUT") {
    const start = form.get("startDateTime") ? new Date(String(form.get("startDateTime"))) : null;
    const until = form.get("until") ? new Date(String(form.get("until"))) : null;

    await prisma.appointment.update({
      where: { id }, 
      data: {
        providerName: String(form.get("providerName") || ""),
        startDateTime: start ?? new Date(), 
        durationMin: Number(form.get("durationMin") || 30),
        rrule: (form.get("rrule") as string) || null,
        until: until ?? null,
      },
    });
  }

  const fallback = req.headers.get("referer") || "/admin";
  const redirectTo = (form.get("redirectTo") as string) || fallback;
  return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
}
