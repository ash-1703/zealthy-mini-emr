import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  let data: Record<string, any>;

  if (ct.includes("application/json")) {
    data = await req.json();
  } else {
    const form = await req.formData();
    data = Object.fromEntries(
      Array.from(form.entries()).map(([k, v]) => [k, typeof v === "string" ? v : v.name])
    );
  }

  const patientIdNum = Number(data.patientId);
  if (!Number.isFinite(patientIdNum)) {
    return NextResponse.json({ error: "Invalid patientId" }, { status: 400 });
  }

  const providerName = String(data.providerName ?? "");
  const start = data.startDateTime ? new Date(String(data.startDateTime)) : null;
  if (!start || isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid startDateTime" }, { status: 400 });
  }

  const durationMin = Number(data.durationMin ?? 30);
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    return NextResponse.json({ error: "Invalid durationMin" }, { status: 400 });
  }

  const rrule = data.rrule ? String(data.rrule) : null;
  const until = data.until ? new Date(String(data.until)) : null;

  await prisma.appointment.create({
    data: {
      patientId: patientIdNum,       
      providerName,
      startDateTime: start,
      durationMin,
      rrule,
      until: until && !isNaN(until.getTime()) ? until : null,
    },
  });

  return NextResponse.redirect(new URL(`/admin/${patientIdNum}`, req.url), { status: 303 });
}
