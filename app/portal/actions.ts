// app/portal/actions.ts
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateProfile(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/api/auth/signin");

  const firstName = (formData.get("firstName")?.toString() ?? "").trim();
  const lastName  = (formData.get("lastName")?.toString()  ?? "").trim();
  const phoneRaw  = (formData.get("phone")?.toString()     ?? "").trim();
  const addrRaw   = (formData.get("address")?.toString()   ?? "").trim();

  await prisma.patient.update({
    where: { email: session.user.email }, 
    data: {
      firstName,
      lastName,
      phone:   phoneRaw || null,
      address: addrRaw  || null,
    },
  });

  revalidatePath("/portal");
  redirect("/portal");
}

