import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const p = await prisma.patient.findUnique({ where: { id } });
  return NextResponse.json(p);
}

export async function POST(req: NextRequest, { params }: Params) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const form = await req.formData();
  const method = String(form.get("_method") ?? "PUT").toUpperCase();
  if (method !== "PUT") {
    return NextResponse.json({ error: "Unsupported method" }, { status: 405 });
  }

  const firstName = form.get("firstName")?.toString();
  const lastName  = form.get("lastName")?.toString();
  const email     = form.get("email")?.toString();

  await prisma.patient.update({
    where: { id },              
    data: { firstName, lastName, email },
  });

  return NextResponse.redirect(new URL(`/admin/${id}`, req.url), { status: 303 });
}
