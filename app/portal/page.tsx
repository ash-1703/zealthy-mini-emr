import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { RRule } from "rrule";
import SignOutButton from "../api/auth/SignOutButton";
import { updateProfile } from "./actions";
// small qs helper
function qs(
  base: Record<string, string | undefined>,
  patch: Record<string, string | undefined>
) {
  const u = new URLSearchParams();

  for (const [k, v] of Object.entries(base)) {
    if (v != null) u.set(k, v);
  }

  Object.entries(patch).forEach(([k, v]) => (v == null ? u.delete(k) : u.set(k, v)));
  return `?${u.toString()}`;
}

/* ---- tiny inline icons ---- */
function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    </svg>
  );
}
function PillIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="7" width="10" height="10" rx="5" />
      <rect x="11" y="7" width="10" height="10" rx="5" />
      <path d="M8 12h8" />
    </svg>
  );
}
function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}
function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function PhoneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 2.5h5l1 4-3 2.5a16 16 0 0 0 6 6l2.5-3 4 1v5a2 2 0 0 1-2.2 2 19 19 0 0 1-8.3-3.1 19 19 0 0 1-6.9-6.9A19 19 0 0 1 3 4.7 2 2 0 0 1 5 2.5Z" />
    </svg>
  );
}
function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/* ---- helpers ---- */
function fmtDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function formatPhone(phone: string | null) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default async function Portal({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const sp = (await searchParams) ?? {};

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return <main className="px-6 py-10 text-sm text-neutral-700">Not authenticated.</main>;
  }

  const patient = await prisma.patient.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      address: true,
      appointments: true,
      prescriptions: {
        select: {
          id: true,
          startDate: true,
          refillUntil: true,
          dosageText: true,
          quantity: true,
          schedule: true,
          medication: { select: { name: true } },
        },
      },
    },
  });

  if (!patient) {
    return (
      <main className="px-6 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Welcome</h1>
          <p className="mt-2 text-sm text-neutral-600">We couldn’t find your patient record yet.</p>
        </div>
      </main>
    );
  }

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const appts = (patient.appointments ?? [])
  .flatMap((a) => {
    const first = new Date(a.startDateTime);

    let rest: Date[] = [];
    if (a.rrule) {
      // Parse the stored rule, but force the anchor to be startDateTime
      const parsed = RRule.fromString(a.rrule);
      const rule = new RRule({
        ...parsed.origOptions,
        dtstart: first, // <-- anchor expansion to the actual start
      });
      rest = rule.between(now, in7, true);
    }

   
    const all = [first, ...rest];
    const seen = new Set<number>();
    const uniq = all.filter(d => {
      const t = d.getTime();
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });

    return uniq
      .filter((d) => d >= now && d <= in7)
      .map((d) => ({ id: a.id, provider: a.providerName, at: d }));
  })
  .sort((x, y) => x.at.getTime() - y.at.getTime());

  const DAY_MS = 24 * 60 * 60 * 1000;

  function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

  function addDays(d: Date, n: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function nextWeekly(onOrAfter: Date, anchor: Date) {
  
    const lo = startOfDay(onOrAfter);
    const a = startOfDay(anchor);
    const diff = Math.floor((lo.getTime() - a.getTime()) / DAY_MS);
    const mod = ((diff % 7) + 7) % 7;
    return mod === 0 ? lo : addDays(lo, 7 - mod);
  }

  function nextMonthly(onOrAfter: Date, anchor: Date) {
    const lo = startOfDay(onOrAfter);
    const a = startOfDay(anchor);
    const targetDay = a.getDate();

    let cand = new Date(lo.getFullYear(), lo.getMonth(), targetDay);
    if (isNaN(cand.getTime())) {
      const last = new Date(lo.getFullYear(), lo.getMonth() + 1, 0).getDate();
      cand = new Date(lo.getFullYear(), lo.getMonth(), last);
    }
    if (cand < lo) {
      let m = lo.getMonth() + 1, y = lo.getFullYear();
      const last = new Date(y, m + 1, 0).getDate();
      const day = Math.min(targetDay, last);
      cand = new Date(y, m, day);
    }
    return cand;
  }

  function occurrencesNext7Days(rx: any, now: Date): Date[] {
    const lo = startOfDay(now);
    const hi = endOfDay(addDays(now, 7));

    const anchorRaw = rx.refill_on ?? rx.startDate ?? rx.refillOn ?? rx.start_date;
    const untilRaw = rx.refill_until ?? rx.refillUntil ?? rx.refill_end ?? null;
    const anchor = anchorRaw ? startOfDay(new Date(anchorRaw)) : null;
    const until = untilRaw ? endOfDay(new Date(untilRaw)) : null;

    if (!anchor || isNaN(anchor.getTime())) return [];
    if (anchor > hi) return [];

    const hardHi = until ? new Date(Math.min(hi.getTime(), until.getTime())) : hi;
    if (lo > hardHi) return [];
    function normFreq(raw: unknown): "daily" | "weekly" | "monthly" {
      const s = String(raw ?? "").trim().toLowerCase();
      if (s === "weekly" || s === "week" || s === "wk") return "weekly";
      if (s === "monthly" || s === "month" || s === "mo") return "monthly";
      return "daily";
    }
    const freq = normFreq(rx.schedule ?? rx.refill_schedule ?? rx.frequency ?? rx.refillSchedule);
    let cursor: Date;
    if (freq === "weekly") {
      cursor = nextWeekly(lo, anchor);
    } else if (freq === "monthly") {
      cursor = nextMonthly(lo, anchor);
    } else {
      // daily
      const days = Math.ceil((lo.getTime() - anchor.getTime()) / DAY_MS);
      cursor = addDays(anchor, Math.max(0, days));
    }

    const out: Date[] = [];
    while (cursor <= hardHi) {
      out.push(cursor);
      if (freq === "weekly") cursor = addDays(cursor, 7);
      else if (freq === "monthly") {
        const d = cursor.getDate(), y = cursor.getFullYear(), m = cursor.getMonth() + 1;
        const last = new Date(y, m + 1, 0).getDate();
        cursor = new Date(y, m, Math.min(d, last));
      } else cursor = addDays(cursor, 1);
    }
    return out;
  }


  // Build the refills list
  const refills = (patient.prescriptions ?? [])
    .flatMap((rx) =>
      occurrencesNext7Days(rx, now).map((d) => ({
        id: rx.id,
        med: rx.medication?.name ?? rx.medication ?? "Unknown",
        dosage: rx.dosageText ?? "",
        at: d,
      }))
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const topRefills = refills.slice(0, 5);


  return (
    <div className="min-h-screen bg-neutral-50">
      {/* NAVBAR */}
      <header className="top-0 z-10 w-full bg-gradient-to-r from-emerald-800 via-teal-700 to-sky-700 text-white shadow-sm">
        <div className="mx-auto w-[90%] md:w-[70%] flex h-16 items-center justify-between px-4">
          <div className="text-lg font-semibold tracking-[0.25em]">ZEALTHY</div>
          <div className="flex items-center gap-3">
            <Link
              href={qs(sp, { m: "signout" })}
              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 hover:text-emerald-700 transition"
              aria-label="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
                <path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
              </svg>
              <span className="text-white">Sign out</span>
            </Link>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="mx-auto w-[90%] md:w-[70%] py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-emerald-700">Welcome, {patient.firstName}</h1>
          <p className="mt-1 text-sm text-neutral-600">Here’s what’s coming up in the next 7 days.</p>
        </div>

        <section className="grid gap-6 md:grid-cols-2">
          {/* Appointments */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-700">
                <CalendarIcon className="h-5 w-5 text-emerald-700" />
                Appointments
              </h2>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                {appts.length} this week
              </span>
            </div>

            <ul className="mt-4 space-y-3">
              {appts.length === 0 && (
                <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
                  No upcoming appointments.
                </li>
              )}
              {appts.map((a) => (
                <li key={a.id + a.at.toISOString()} className="flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-medium text-neutral-900">{fmtDateTime(a.at)}</div>
                    <div className="text-neutral-400">{a.provider}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <Link href="/portal/appointments" className="text-sm font-medium text-emerald-700 hover:underline">
                View all →
              </Link>
            </div>
          </div>

          {/* Refills */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-700">
                <PillIcon className="h-5 w-5 text-emerald-700" />
                Medication refills
              </h2>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                {refills.length} due this week
              </span>
            </div>

            <ul className="mt-4 space-y-3">
              {topRefills.length === 0 && (
                <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
                  No refills due.
                </li>
              )}
              {topRefills.map((r) => (
                <li key={r.id + r.at.toISOString()} className="flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-medium text-neutral-900">{fmtDate(r.at)}</div>
                    <div className="text-neutral-600">
                      {r.med} <span className="text-neutral-400">•</span> {r.dosage}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <Link href="/portal/medications" className="text-sm font-medium text-emerald-700 hover:underline">
                View all →
              </Link>
            </div>
          </div>
        </section>

        {/* Your info */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-700">
              <UserIcon className="h-5 w-5 text-emerald-700" />
              Your info
            </h2>
            <Link
              href={qs(sp, { m: "edit-profile" })}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Edit profile
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="text-sm">
              <div className="font-medium text-neutral-900">
                {patient.firstName} {patient.lastName}
              </div>
              <div className="mt-1 flex items-center gap-2 text-neutral-400">
                <MailIcon className="h-4 w-4" />
                <span>{patient.email}</span>
              </div>
              {patient.phone && (
                <div className="mt-1 flex items-center gap-2 text-neutral-400">
                  <PhoneIcon className="h-4 w-4" />
                  <span>{formatPhone(patient.phone)}</span>

                </div>
              )}
              {patient.address && (
                <div className="mt-1 flex items-start gap-2 text-neutral-400">
                  <MapPinIcon className="mt-0.5 h-4 w-4" />
                  <span className="whitespace-pre-line">{patient.address}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {sp.m === "edit-profile" && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative mx-auto mt-20 w-[92%] max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Edit profile</h3>
              <Link href={qs(sp, { m: undefined })} aria-label="Close" className="rounded p-1 hover:bg-neutral-100">✕</Link>
            </div>

            <form action={updateProfile} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="id" value={patient.id} />

              <div>
                <label className="block text-sm font-medium">First name</label>
                <input name="firstName" defaultValue={patient.firstName ?? ""} className="input mt-1" required />
              </div>
              <div>
                <label className="block text-sm font-medium">Last name</label>
                <input name="lastName" defaultValue={patient.lastName ?? ""} className="input mt-1" required />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Email</label>
                <input name="email" type="email" defaultValue={patient.email ?? ""} className="input mt-1" readOnly />
                <p className="mt-1 text-xs text-neutral-500">Email can’t be changed here.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Phone</label>
                <input
                  name="phone"
                  type="tel"
                  maxLength={10}
                  defaultValue={patient.phone ?? ""}
                  className="input mt-1"

                  inputMode="numeric" // shows numeric keypad on mobile
                  pattern="\d{10}" // validates only digits

                />
                <p className="mt-1 text-xs text-neutral-500">Enter a 10-digit US number</p>
              </div>


              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Address</label>
                <textarea name="address" rows={3} defaultValue={patient.address ?? ""} className="input mt-1" />
              </div>

              <div className="md:col-span-2 mt-2 flex justify-end gap-2">
                <Link href={qs(sp, { m: undefined })} className="btn btn-ghost">Cancel</Link>
                <button className="btn btn-brand">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sign out modal */}
      {sp.m === "signout" && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative mx-auto mt-24 w-[92%] max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Sign out</h3>
              <Link href={qs(sp, { m: undefined })} aria-label="Close" className="rounded p-1 hover:bg-neutral-100">
                ✕
              </Link>
            </div>
            <p className="text-sm text-neutral-600">Are you sure you want to sign out?</p>
            <div className="mt-6 flex justify-end gap-2">
              <Link href={qs(sp, { m: undefined })} className="rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium hover:bg-neutral-50">
                Cancel
              </Link>
              <SignOutButton className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700" callbackUrl="/">
                Sign out
              </SignOutButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
