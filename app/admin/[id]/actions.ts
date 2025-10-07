'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { RefillSchedule } from '@prisma/client';

// helpers
const s = (v: FormDataEntryValue | null, d = '') =>
  typeof v === 'string' ? v.trim() : d;
const n = (v: FormDataEntryValue | null, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};
const dte = (v: FormDataEntryValue | null) => (v ? new Date(String(v)) : null);

const backTo = (id: number) => `/admin/${id}`;

 function toScheduleEnum(v: string | undefined): RefillSchedule {
   const s = (v || '').toLowerCase();
   if (s === 'daily')  return RefillSchedule.daily;
   if (s === 'weekly') return RefillSchedule.weekly;
   return RefillSchedule.monthly;
 }

/* ---------------- Patient ---------------- */
export async function savePatient(formData: FormData) {
  const id = n(formData.get('id')); 
  await prisma.patient.update({
    where: { id },
    data: {
      firstName: s(formData.get('firstName')),
      lastName:  s(formData.get('lastName')),
      email:     s(formData.get('email')),
      phone:     s(formData.get('phone')) || null,
      address:   s(formData.get('address')) || null,
      dob:       dte(formData.get('dob')),
    },
  });
  revalidatePath(backTo(id));
  redirect(backTo(id));
}

/* ---------------- Prescriptions---------------- */


export async function addRx(formData: FormData) {
  const patientId = n(formData.get('patientId'));
  const medicationId = n(formData.get('medicationId'));

  await prisma.prescription.create({
    data: {
      patientId,
      medicationId,
      dosageText: s(formData.get('dosageText')),
      quantity:   n(formData.get('quantity'), 30),
      startDate:  dte(formData.get('startDate')) ?? new Date(), 
      schedule:   toScheduleEnum(s(formData.get('schedule'))),  
      refillUntil: dte(formData.get('refillUntil')),
  
    },
  });

  revalidatePath(backTo(patientId));
  redirect(backTo(patientId));
}

export async function updateRx(formData: FormData) {
  const id = n(formData.get('id'));
  const patientId = n(formData.get('patientId'));

  await prisma.prescription.update({
    where: { id },
    data: {
      dosageText:  s(formData.get('dosageText')),
      quantity:    n(formData.get('quantity')),
      ...(formData.get('schedule') ? { schedule: toScheduleEnum(s(formData.get('schedule'))) } : {}),
      ...(formData.get('startDate') ? { startDate: dte(formData.get('startDate'))! } : {}),
      refillUntil: dte(formData.get('refillUntil')),
   
    },
  });

  revalidatePath(backTo(patientId));
  redirect(backTo(patientId));
}

export async function deleteRx(formData: FormData) {
  const id = n(formData.get('id'));
  const patientId = n(formData.get('patientId'));
  await prisma.prescription.delete({ where: { id } });
  revalidatePath(backTo(patientId));
  redirect(backTo(patientId));
}

/* ---------------- Appointments ---------------- */

function toRRuleUntilUTC(dashDate: string) {
  const [y, m, d] = dashDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
  return `${ymd}T235959Z`;
}
function buildRRuleFromForm(form: FormData) {
  const freq = String(form.get('repeatFreq') || 'NONE');
  if (freq === 'NONE') return { rrule: null as string | null, until: null as Date | null };

  const interval = Math.max(1, Number(form.get('repeatInterval') || 1));
  const untilDash = String(form.get('repeatUntil') || '');
  const until = untilDash ? new Date(`${untilDash}T00:00:00`) : null;

  let rrule = `FREQ=${freq};INTERVAL=${interval}`;
  if (untilDash) rrule += `;UNTIL=${toRRuleUntilUTC(untilDash)}`;
  return { rrule, until };
}

export async function addAppt(formData: FormData) {
  const patientId = n(formData.get('patientId'));
  const providerName = s(formData.get('providerName'));
  const startDateTime = new Date(String(formData.get('startDateTime')));
  const durationMin = n(formData.get('durationMin'), 30);

  const { rrule, until } = buildRRuleFromForm(formData);

  await prisma.appointment.create({
    data: { patientId, providerName, startDateTime, durationMin, rrule, until },
  });

  revalidatePath(backTo(patientId));
  redirect(backTo(patientId));
}

export async function updateAppt(formData: FormData) {
  const id = n(formData.get('id'));
  const patientId = n(formData.get('patientId'));
  const providerName = s(formData.get('providerName'));
  const startDateTime = new Date(String(formData.get('startDateTime')));
  const durationMin = n(formData.get('durationMin'), 30);

  const { rrule, until } = buildRRuleFromForm(formData);

  await prisma.appointment.update({
    where: { id },
    data: { providerName, startDateTime, durationMin, rrule, until },
  });

  revalidatePath(backTo(patientId));
  redirect(backTo(patientId));
}

export async function deleteAppt(formData: FormData) {
  const id = n(formData.get('id'));
  const patientId = n(formData.get('patientId'));
  await prisma.appointment.delete({ where: { id } });
  revalidatePath(backTo(patientId));
  redirect(backTo(patientId));
}
