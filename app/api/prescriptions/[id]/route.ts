import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: { id: string } };

function endOfDayUTC(d: Date) {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const form = await req.formData();
    const method = String(form.get("_method") || "POST").toUpperCase();

    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid prescription id" }, { status: 400 });
    }

    if (method === "DELETE") {
      await prisma.prescription.delete({ where: { id } });
    } else if (method === "PUT") {
   
      const dosageText = String(form.get("dosageText") ?? "");
      const quantityRaw = form.get("quantity");
      const quantity = Number(quantityRaw ?? 30);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
      }

      const startDateStr = form.get("startDate")?.toString() ?? "";
      const refillUntilStr = form.get("refillUntil")?.toString() ?? "";
      const scheduleRaw = (form.get("schedule") ?? "").toString().toLowerCase();
  
      const schedule =
        scheduleRaw === "daily" ? "daily" :
        scheduleRaw === "weekly" ? "weekly" :
        scheduleRaw === "monthly" ? "monthly" :
        undefined; 

      const startDate = startDateStr ? new Date(startDateStr) : undefined;
      const refillUntil = refillUntilStr ? endOfDayUTC(new Date(refillUntilStr)) : undefined;


      const data: any = { dosageText, quantity };
      if (schedule) data.schedule = schedule;     
      if (startDate && !isNaN(startDate.getTime())) data.startDate = startDate;
      data.refillUntil = refillUntil && !isNaN(refillUntil.getTime()) ? refillUntil : null;

      await prisma.prescription.update({
        where: { id },
        data,
      });
    } else {
      return NextResponse.json({ error: "Unsupported method" }, { status: 405 });
    }

    const fallback = req.headers.get("referer") || "/admin";
    const redirectTo = (form.get("redirectTo") as string) || fallback;
    return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
  } catch (err) {
    console.error("Prescription update/delete error:", err);
    return NextResponse.json({ error: "Failed to modify prescription" }, { status: 500 });
  }
}
