// app/portal/medications/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import ProviderAutocomplete from "../appointments/autocomplete";
import SignOutButton from "../../api/auth/SignOutButton";

type Occurrence = {
  at: Date;
  med: string;
  dosage: string;
  qty: number | null;
};

/* ----------------------- QS helpers ----------------------- */
function qs(
  base: Record<string, string | undefined>,
  patch: Record<string, string | undefined>
) {
  const u = new URLSearchParams();
  Object.entries(base).forEach(([k, v]) => v != null && u.set(k, v));
  Object.entries(patch).forEach(([k, v]) => (v == null ? u.delete(k) : u.set(k, v)));
  return `?${u.toString()}`;
}

function makeQS(
  base: Record<string, string | undefined>,
  patch: Record<string, string | number | boolean | undefined>
) {
  const params = new URLSearchParams();
  const merged = {
    ...base,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
  };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  return `?${params.toString()}`;
}

function matchesQueryWordStart(label: string, q: string) {
  const hay = (label || "").toLowerCase();
  const needle = (q || "").trim().toLowerCase();
  if (!needle) return true;
  if (hay.split(/\s+/).some((w) => w.startsWith(needle))) return true;
  return hay.includes(needle);
}

/* ------------------ refill helpers (like portal) ------------------ */
const DAY_MS = 24 * 60 * 60 * 1000;

function startOf(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOf(d: Date)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function add(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function nextWeekly(onOrAfter: Date, anchor: Date) {
  const lo = startOf(onOrAfter);
  const a = startOf(anchor);
  const diff = Math.floor((lo.getTime() - a.getTime()) / DAY_MS);
  const mod = ((diff % 7) + 7) % 7;
  return mod === 0 ? lo : add(lo, 7 - mod);
}

function nextMonthly(onOrAfter: Date, anchor: Date) {
  const lo = startOf(onOrAfter);
  const a = startOf(anchor);
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

type Freq = "daily" | "weekly" | "monthly";
function normFreq(raw: unknown): Freq {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "weekly" || s === "week" || s === "wk") return "weekly";
  if (s === "monthly" || s === "month" || s === "mo") return "monthly";
  return "daily";
}

function occurrencesInWindow(opts: {
  startDate: Date;          // rx.startDate
  refillUntil?: Date | null;
  schedule: Freq;
  windowStart: Date;
  windowEnd: Date;
}) {
  const { startDate, refillUntil, schedule, windowStart, windowEnd } = opts;

  const lo = startOf(windowStart);
  const hi = endOf(windowEnd);
  const anchor = startOf(startDate);
  if (anchor > hi) return [] as Date[];

  const hardHi = refillUntil ? endOf(new Date(Math.min(hi.getTime(), refillUntil.getTime()))) : hi;
  if (lo > hardHi) return [] as Date[];

  let cursor: Date;
  if (schedule === "weekly") {
    cursor = nextWeekly(lo, anchor);
  } else if (schedule === "monthly") {
    cursor = nextMonthly(lo, anchor);
  } else {
    // daily
    const days = Math.ceil((lo.getTime() - anchor.getTime()) / DAY_MS);
    cursor = add(anchor, Math.max(0, days));
  }

  const out: Date[] = [];
  while (cursor <= hardHi) {
    out.push(cursor);
    if (schedule === "weekly")       cursor = add(cursor, 7);
    else if (schedule === "monthly") {
      const d = cursor.getDate(), y = cursor.getFullYear(), m = cursor.getMonth() + 1;
      const last = new Date(y, m + 1, 0).getDate();
      cursor = new Date(y, m, Math.min(d, last));
    } else                           cursor = add(cursor, 1);
  }
  return out;
}

/* ========================================================== */

export default async function Medications({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return (
      <main className="max-w-5xl mx-auto p-8">
        <div className="card p-6">
          <h1 className="text-xl font-semibold">Not authenticated</h1>
          <a href="/" className="btn mt-4">Go to login</a>
        </div>
      </main>
    );
  }

  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim().toLowerCase();

  // Pagination
  const limit = 10;
  const page = Math.max(1, Number(sp.page ?? 1));

 
  const rawRange = (sp.range ?? "7").toLowerCase();   
  const isAll = rawRange === "all";
  const allowed = [7, 14, 21, 30, 90];
  const rangeDays = isAll ? 90 : allowed.includes(Number(rawRange)) ? Number(rawRange) : 7;

  // Only show prescriptions that have an occurrence in the window
  const onlyUpcoming = (sp.upcoming ?? "yes") === "yes";

  const patient = await prisma.patient.findUnique({
    where: { email: session.user.email },
    include: {
      prescriptions: {
        include: { medication: true },
      },
    },
  });

  const now = new Date();
  const windowStart = startOfDay(now);
  const windowEnd = endOfDay(addDays(now, rangeDays));

  // Autocomplete options from all meds this patient has
  const medsSet = new Set<string>(
    (patient?.prescriptions ?? []).map((rx) => rx.medication?.name || "").filter(Boolean)
  );
  const medOptions = Array.from(medsSet).sort((a, b) => a.localeCompare(b));

  // Expand occurrences using schedule (daily/weekly/monthly)
  const occurrences: Occurrence[] = (patient?.prescriptions ?? [])
    .flatMap((rx) => {
      const schedule = normFreq((rx as any).schedule ?? (rx as any).refill_schedule);
      const startDate = new Date(rx.startDate);
      const untilCap = rx.refillUntil ? new Date(rx.refillUntil) : null;

      const inWindow = occurrencesInWindow({
        startDate,
        refillUntil: untilCap,
        schedule,
        windowStart,
        windowEnd,
      });

      if (onlyUpcoming && inWindow.length === 0) return [];

      return inWindow.map((d) => ({
        at: d,
        med: rx.medication?.name || "—",
        dosage: rx.dosageText || "—",
        qty: rx.quantity ?? null,
      }));
    })
    .filter((it) => matchesQueryWordStart(it.med, q))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  // Pagination bits
  const total = occurrences.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * limit;
  const pageItems = occurrences.slice(start, start + limit);

  const baseQS = {
    q: sp.q,
    range: isAll ? "all" : String(rangeDays),
    upcoming: onlyUpcoming ? "yes" : "no",
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* NAV */}
      <header className="top-0 z-10 w-full bg-gradient-to-r from-emerald-800 via-teal-700 to-sky-700 text-white shadow-sm">
        <div className="mx-auto w-[90%] md:w-[70%] flex h-16 items-center justify-between px-4">
          <div className="text-lg font-semibold tracking-[0.25em]">ZEALTHY</div>
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
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Title */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-emerald-700">Upcoming Refills</h1>
            <p className="subtle">
              {isAll ? "in the next 3 months" : `in the next ${rangeDays} days`} (
              {format(windowStart, "MMM d")} – {format(windowEnd, "MMM d")})
            </p>
          </div>
          <a href="/portal" className="btn btn-ghost border-none self-start md:self-auto">
            ← Back to portal
          </a>
        </header>

        {/* Filters */}
        <div className="card p-4">
          <form method="get" className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Search by medication */}
            <div className="md:col-span-7">
              <label id="med-label" className="block text-sm font-medium text-emerald-700">
                Search medication
              </label>
              <ProviderAutocomplete
                labelId="med-label"
                name="q"
                defaultValue={sp.q ?? ""}
                options={medOptions}
                placeholder="Medication name"
              />
            </div>

            {/* Time window */}
            <div className="md:col-span-5">
              <label className="block text-sm font-medium text-emerald-700">Time window</label>
              <div className="relative mt-1">
                <select
                  name="range"
                  defaultValue={isAll ? "all" : String(rangeDays)}
                  className="input h-11 pr-10 appearance-none"
                >
                  <option value="7">Next 7 days</option>
                  <option value="14">Next 14 days</option>
                  <option value="21">Next 21 days</option>
                  <option value="30">Next 30 days</option>
                  <option value="90">Next 90 days</option>
                  <option value="all">Next 3 months</option>
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.17l3.71-2.94a.75.75 0 11.92 1.18l-4.25 3.37a.75.75 0 01-.92 0L5.21 8.41a.75.75 0 01.02-1.2z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            

            {/* Actions */}
            <div className="md:col-span-12 flex gap-2">
              <button className="btn btn-brand h-11">Apply</button>
              <a href="/portal/medications" className="btn btn-ghost h-11">Reset</a>
            </div>
          </form>
        </div>

        {/* Table */}
        <section className="card overflow-hidden !p-0">
          {pageItems.length === 0 ? (
            <div className="p-8 text-center subtle">No refills in this window.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table">
                <thead className="bg-[var(--brand-100)]">
                  <tr>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Medication</th>
                    <th className="px-5 py-3 text-left">Dosage</th>
                    <th className="px-5 py-3 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pageItems.map((o, idx) => (
                    <tr key={o.med + o.at.toISOString() + idx} className="hover:bg-[#F7FAF9]">
                      <td className="px-5 py-3">{format(o.at, "EEE, MMM d yyyy")}</td>
                      <td className="px-5 py-3">{o.med}</td>
                      <td className="px-5 py-3">{o.dosage}</td>
                      <td className="px-5 py-3 text-right">{o.qty ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pagination */}
        <nav className="mt-4 flex items-center justify-between gap-4">
    
          <div className="inline-flex">
            <Link
              href={makeQS(baseQS, { page: 1 })}
              aria-label="First page"
              aria-disabled={clampedPage === 1}
              tabIndex={clampedPage === 1 ? -1 : 0}
              className={`grid place-items-center h-12 w-12 border border-emerald-600 text-emerald-600 text-xl hover:bg-emerald-50 rounded-l-lg rounded-r-none ${clampedPage === 1 ? "opacity-40 pointer-events-none" : ""}`}
            >
              &laquo;
            </Link>
            <Link
              href={makeQS(baseQS, { page: Math.max(1, clampedPage - 1) })}
              aria-label="Previous page"
              aria-disabled={clampedPage === 1}
              tabIndex={clampedPage === 1 ? -1 : 0}
              className={`grid place-items-center h-12 w-12 border-t border-b border-r border-emerald-600 text-emerald-600 text-xl hover:bg-emerald-50 rounded-l-none rounded-r-none -ml-px ${clampedPage === 1 ? "opacity-40 pointer-events-none" : ""}`}
            >
              &lsaquo;
            </Link>
          </div>

  
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - clampedPage) <= 2 || p === 1 || p === totalPages)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 ? <span className="mx-1 subtle">…</span> : null}
                  <Link
                    href={makeQS(baseQS, { page: p })}
                    className={`grid place-items-center h-10 min-w-10 px-3 border border-emerald-600 ${
                      p === clampedPage ? "bg-emerald-600 text-white" : "bg-white hover:bg-emerald-50"
                    } rounded-none`}
                    aria-current={p === clampedPage ? "page" : undefined}
                  >
                    {p}
                  </Link>
                </span>
              ))}
          </div>

          <div className="inline-flex">
            <Link
              href={makeQS(baseQS, { page: Math.min(totalPages, clampedPage + 1) })}
              aria-label="Next page"
              aria-disabled={clampedPage === totalPages}
              tabIndex={clampedPage === totalPages ? -1 : 0}
              className={`grid place-items-center h-12 w-12 border border-emerald-600 text-emerald-600 text-xl hover:bg-emerald-50 rounded-l-none rounded-r-none -mr-px ${clampedPage === totalPages ? "opacity-40 pointer-events-none" : ""}`}
            >
              &rsaquo;
            </Link>
            <Link
              href={makeQS(baseQS, { page: totalPages })}
              aria-label="Last page"
              aria-disabled={clampedPage === totalPages}
              tabIndex={clampedPage === totalPages ? -1 : 0}
              className={`grid place-items-center h-12 w-12 border-t border-b border-r border-emerald-600 text-emerald-600 text-xl hover:bg-emerald-50 rounded-r-lg rounded-l-none ${clampedPage === totalPages ? "opacity-40 pointer-events-none" : ""}`}
            >
              &raquo;
            </Link>
          </div>
        </nav>
      </div>

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
    </main>
  );
}
