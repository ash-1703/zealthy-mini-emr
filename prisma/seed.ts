/* prisma/seed.ts */
import { PrismaClient, Prisma } from "@prisma/client";



type RefillScheduleEnum = "daily" | "weekly" | "monthly";

function toScheduleEnum(v?: string): RefillScheduleEnum {
  const s = (v || "").toLowerCase();
  if (s === "daily") return "daily";
  if (s === "weekly") return "weekly";
  return "monthly";
}
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ===== sample data (yours) =====
const seedData = {
  users: [
    {
      name: "Mark Johnson",
      email: "mark@some-email-provider.net",
      password: "Password123!",
      appointments: [
        { provider: "Dr Kim West", datetime: "2025-09-16T16:30:00.000-07:00", repeat: "weekly" },
        { provider: "Dr Lin James", datetime: "2025-09-19T18:30:00.000-07:00", repeat: "monthly" },
      ],
      prescriptions: [
        { medication: "Lexapro",  dosage: "5mg",   quantity: 2, refill_on: "2025-10-05", refill_schedule: "monthly" },
        { medication: "Ozempic",  dosage: "1mg",   quantity: 1, refill_on: "2025-10-10", refill_schedule: "monthly" },
      ],
    },
    {
      name: "Lisa Smith",
      email: "lisa@some-email-provider.net",
      password: "Password123!",
      appointments: [
        { provider: "Dr Sally Field", datetime: "2025-09-22T18:15:00.000-07:00", repeat: "monthly" },
        { provider: "Dr Lin James",   datetime: "2025-09-25T20:00:00.000-07:00", repeat: "weekly" },
      ],
      prescriptions: [
        { medication: "Metformin", dosage: "500mg", quantity: 2, refill_on: "2025-10-15", refill_schedule: "monthly" },
        { medication: "Diovan",    dosage: "100mg", quantity: 1, refill_on: "2025-10-25", refill_schedule: "monthly" },
      ],
    },
  ],
  medications: ["Diovan", "Lexapro", "Metformin", "Ozempic", "Prozac", "Seroquel", "Tegretol"],
  dosages: ["1mg","2mg","3mg","5mg","10mg","25mg","50mg","100mg","250mg","500mg","1000mg"],
};
// =================================

function splitName(full: string) {
  const parts = (full || "").trim().split(/\s+/);
  const firstName = parts.shift() ?? "";
  const lastName = parts.join(" ");
  return { firstName, lastName };
}

// Only used for APPOINTMENTS (prescriptions do NOT use rrule)
function toRRule(repeat: string | undefined, dtstart: Date): string | null {
  const r = (repeat || "").toLowerCase();
  if (r === "weekly")  return `FREQ=WEEKLY;INTERVAL=1;DTSTART=${toIcs(dtstart)}`;
  if (r === "monthly") return `FREQ=MONTHLY;INTERVAL=1;DTSTART=${toIcs(dtstart)}`;
  return null;
}

function toIcs(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

async function main() {
  // console.log("🌱 Seeding…");

  // Clear tables (safe if you already ran migrate reset; otherwise this makes seeding idempotent)
  await prisma.appointment.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.dosage.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.patient.deleteMany();

  // Medications
  const medByName: Record<string, number> = {};
  for (const name of seedData.medications) {
    const med = await prisma.medication.create({ data: { name } });
    medByName[name] = med.id;
  }

  // Dosages
  for (const medicationId of Object.values(medByName)) {
    await prisma.dosage.createMany({
      data: seedData.dosages.map((strength) => ({ medicationId, strength })),
      skipDuplicates: true,
    });
  }

  // Patients + nested data
  for (const u of seedData.users) {
    const { firstName, lastName } = splitName(u.name);
    const passwordHash = await bcrypt.hash(u.password, 10);

    const patient = await prisma.patient.create({
      data: { email: u.email, passwordHash, firstName, lastName },
    });

    // Appointments
    for (const a of u.appointments ?? []) {
      const start = new Date(a.datetime);
      const rrule = toRRule(a.repeat, start);
      await prisma.appointment.create({
        data: {
          patientId: patient.id,
          providerName: a.provider,
          startDateTime: start,
          durationMin: 30,
          rrule: rrule ?? undefined,
        },
      });
    }

    // Prescriptions 
    for (const p of u.prescriptions ?? []) {
      const medId = medByName[p.medication];
      if (!medId) {
        console.warn(`Medication not found: ${p.medication} — skipping`);
        continue;
      }
      await prisma.prescription.create({
        data: {
          patientId: patient.id,
          medicationId: medId,
          dosageText: p.dosage,
          quantity: p.quantity,
          startDate: new Date(p.refill_on),
          schedule: toScheduleEnum(p.refill_schedule),
          refillUntil: null,
        },
      });
    }
  }

  // console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    // console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
