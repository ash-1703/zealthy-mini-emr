import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from "bcryptjs";


export async function POST(req: NextRequest) {
  
  let data: any;
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await req.json();
  else {
    const form = await req.formData();
    data = Object.fromEntries(form.entries());
  }
  const { email, password, firstName, lastName, dob, phone, address } = data;
  const passwordHash = await bcrypt.hash(String(password), 10);
  const patient = await prisma.patient.create({
    data: { email, passwordHash, firstName, lastName, dob: dob ? new Date(dob) : null, phone: phone ?? null, address: address ?? null },
  });
  return NextResponse.redirect(new URL('/admin', req.url));
}
