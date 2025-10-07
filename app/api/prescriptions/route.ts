import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function toEndOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  let raw: Record<string, any>;

  if (ct.includes("application/json")) {
    raw = await req.json();
  } else {
    const form = await req.formData();
    raw = Object.fromEntries(
      Array.from(form.entries()).map(([k, v]) => [k, typeof v === "string" ? v : v.name])
    );
  }

  const patientId = Number(raw.patientId);
  const medicationId = Number(raw.medicationId);
  if (!Number.isFinite(patientId) || !Number.isFinite(medicationId)) {
    return NextResponse.json({ error: "Invalid patientId or medicationId" }, { status: 400 });
  }

  const dosageText = String(raw.dosageText ?? "");
  const quantity = Number(raw.quantity ?? 30);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const startDate =
    raw.startDate && !isNaN(new Date(String(raw.startDate)).getTime())
      ? new Date(String(raw.startDate))
      : new Date();

  const refillUntil =
    raw.refillUntil && !isNaN(new Date(String(raw.refillUntil)).getTime())
      ? toEndOfDay(new Date(String(raw.refillUntil)))
      : null;

  const scheduleRaw = (raw.schedule ?? raw.refillSchedule ?? "").toString().toLowerCase();
  const schedule =
    scheduleRaw === "daily" || scheduleRaw === "weekly" || scheduleRaw === "monthly"
      ? scheduleRaw
      : "monthly"; 

  await prisma.prescription.create({
    data: {
      patientId,         
      medicationId,      
      dosageText,
      quantity,
      startDate,
      refillUntil,   
      schedule: schedule as any,
    },
  });

  return NextResponse.redirect(new URL(`/admin/${patientId}`, req.url), { status: 303 });
}
