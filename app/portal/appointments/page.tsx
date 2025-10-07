import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { RRule } from "rrule";
import ProviderAutocomplete from "./autocomplete";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import SignOutButton from "../../api/auth/SignOutButton";
type Item = { at: Date; provider: string };

function makeQS(
  base: Record<string, string | undefined>,
  patch: Record<string, string | number | undefined>
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
function qs(
  base: Record<string, string | undefined>,
  patch: Record<string, string | undefined>
) {
  const u = new URLSearchParams();
  // add base params but skip undefined
  for (const [k, v] of Object.entries(base)) {
    if (v != null) u.set(k, v);
  }
  // apply patch (delete when null/undefined)
  Object.entries(patch).forEach(([k, v]) => (v == null ? u.delete(k) : u.set(k, v)));
  return `?${u.toString()}`;
}

export default async function Appointments({
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

  // Fixed 10/page
  const limit = 10;
  const page = Math.max(1, Number(sp.page ?? 1));

  // Range: "all" or 7/14/21/30 days. "all" = next 90 days.
  const rawRange = (sp.range ?? "7").toLowerCase();
  const isAll = rawRange === "all";
  const rangeDays = isAll ? 90 : [7, 14, 21, 30].includes(Number(rawRange)) ? Number(rawRange) : 30;

  const patient = await prisma.patient.findUnique({
    where: { email: session.user.email },
    include: { appointments: true },
  });

  const now = new Date();
  const windowStart = startOfDay(now);
  const windowEnd = endOfDay(addDays(now, rangeDays));

  // Provider suggestions from all patient appts
  const providerSet = new Set<string>(
    (patient?.appointments ?? [])
      .map((a) => a.providerName || "")
      .filter(Boolean)
  );
  const providerOptions = Array.from(providerSet).sort((a, b) => a.localeCompare(b));

  // Expand occurrences that fall inside the selected window
  const items: Item[] = (patient?.appointments ?? [])
  .flatMap((a) => {
    const first = new Date(a.startDateTime);

    let recurrences: Date[] = [];
    if (a.rrule) {
      // Parse stored rule, then re-build with the correct dtstart anchor
      const parsed = RRule.fromString(a.rrule);
      const rule = new RRule({
        ...parsed.origOptions,
        dtstart: first, // <-- anchor expansion to the appointment's start
      });
      recurrences = rule.between(windowStart, windowEnd, true);
    }

    // Combine + de-dupe (in case first also appears in recurrences)
    const all = [first, ...recurrences].filter(d => d >= windowStart && d <= windowEnd);
    const seen = new Set<number>();
    const uniq = all.filter(d => {
      const t = d.getTime();
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });

    return uniq.map((d) => ({ at: d, provider: a.providerName || "" }));
  })
  .filter(it => matchesQueryWordStart(it.provider, q))
  .sort((a, b) => a.at.getTime() - b.at.getTime());


  // Pagination
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * limit;
  const pageItems = items.slice(start, start + limit);

  const baseQS = { q: sp.q, range: isAll ? "all" : String(rangeDays) };
  function matchesQueryWordStart(label: string, q: string) {
    const hay = (label || '').toLowerCase();
    const needle = (q || '').trim().toLowerCase();
    if (!needle) return true;
    if (hay.split(/\s+/).some(w => w.startsWith(needle))) return true;
    return hay.includes(needle);
  }


  return (

    <main className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className=" top-0 z-10 w-full bg-gradient-to-r from-emerald-800 via-teal-700 to-sky-700 text-white shadow-sm">
        <div className="mx-auto w-[90%] md:w-[70%] flex h-16 items-center justify-between px-4">
          <div className="text-lg font-semibold tracking-[0.25em]">ZEALTHY</div>

          <div className="flex items-center gap-3">

            {/* simple GET sign-out to NextAuth endpoint with redirect */}
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
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6 ">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 ">
          <div>
            <h1 className="text-2xl font-semibold text-emerald-700">Your Upcoming Appointments</h1>
            <p className="subtle">
              in {`next ${rangeDays} days`}
            </p>
          </div>
          <a href="/portal" className="btn btn-ghost  border-none  self-start md:self-auto">
            ← Back to portal
          </a>
        </header>

        {/* Filters */}
        <div className="card p-4">
          {/* Use a tight grid and shared heights for perfect alignment */}
          <form method="get" className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Search by provider */}
            <div className="md:col-span-7">
              <label id="provider-label" className="block text-sm font-medium text-emerald-700">
                Search Provider Name
              </label>
              <ProviderAutocomplete
                labelId="provider-label"
                name="q"
                defaultValue={sp.q ?? ''}
                options={providerOptions}
                placeholder="Provider Name"
              />

            </div>

            {/* Time window with custom select UI */}
            <div className="md:col-span-3">
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
                  <option value="all">Next 3 months</option>
                </select>
                {/* chevron */}
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-70"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.17l3.71-2.94a.75.75 0 11.92 1.18l-4.25 3.37a.75.75 0 01-.92 0L5.21 8.41a.75.75 0 01.02-1.2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            {/* Actions */}
            <div className="md:col-span-2 flex md:justify-end gap-2">
              <button className="btn btn-brand text-emerald-700 h-11 w-full md:w-auto">Apply</button>
              <a href="/portal/appointments" className="btn btn-ghost h-11 w-full md:w-auto">
                Reset
              </a>
            </div>
          </form>
        </div>

        {/* Table */}
        <section className="card overflow-hidden !p-0">


          {pageItems.length === 0 ? (
            <div className="p-8 text-center subtle">No appointments in this window.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left">Date <span className="subtle text-sm">(
                      {format(windowStart, "MMM d")} – {format(windowEnd, "MMM d")})
                    </span></th>
                    <th className="px-5 py-3 text-left">Time</th>
                    <th className="px-5 py-3 text-left">Provider</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pageItems.map((i, idx) => (
                    <tr key={i.at.toISOString() + idx} className="hover:bg-[#F7FAF9]">
                      <td className="px-5 py-3">{format(i.at, "EEE, MMM d yyyy")}</td>
                      <td className="px-5 py-3">{format(i.at, "h:mm a")}</td>
                      <td className="px-5 py-3">{i.provider || "-"}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="badge badge-success">Confirmed</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pagination */}
        <nav className="mt-4 flex items-center justify-between gap-4">
          {/* First / Prev */}
          <div className="inline-flex">
            {/* FIRST « */}
            <Link
              href={makeQS(baseQS, { page: 1 })}
              aria-label="First page"
              aria-disabled={clampedPage === 1}
              tabIndex={clampedPage === 1 ? -1 : 0}
              className={`grid place-items-center h-12 w-12 border border-emerald-600
        text-emerald-600 text-xl hover:bg-emerald-50
        rounded-l-lg rounded-r-none
        ${clampedPage === 1 ? "opacity-40 pointer-events-none" : ""}`}
            >
              &laquo;
            </Link>

            {/* PREV ‹ */}
            <Link
              href={makeQS(baseQS, { page: Math.max(1, clampedPage - 1) })}
              aria-label="Previous page"
              aria-disabled={clampedPage === 1}
              tabIndex={clampedPage === 1 ? -1 : 0}
              className={`grid place-items-center h-12 w-12 border-t border-b border-r border-emerald-600
        text-emerald-600 text-xl hover:bg-emerald-50
        rounded-l-none rounded-r-none -ml-px
        ${clampedPage === 1 ? "opacity-40 pointer-events-none" : ""}`}
            >
              &lsaquo;
            </Link>
          </div>

          {/* Page numbers */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => Math.abs(p - clampedPage) <= 2 || p === 1 || p === totalPages)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 ? <span className="mx-1 subtle">…</span> : null}
                  <Link
                    href={makeQS(baseQS, { page: p })}
                    className={`grid place-items-center h-10 min-w-10 px-3 border border-emerald-600
              ${p === clampedPage ? "bg-emerald-600 text-white" : "bg-white hover:bg-emerald-50"}
              rounded-none`}
                  >
                    {p}
                  </Link>
                </span>
              ))}
          </div>

          {/* Next / Last */}
          <div className="inline-flex">
            {/* NEXT › */}
            <Link
              href={makeQS(baseQS, { page: Math.min(totalPages, clampedPage + 1) })}
              aria-label="Next page"
              aria-disabled={clampedPage === totalPages}
              tabIndex={clampedPage === totalPages ? -1 : 0}
              className={`grid place-items-center h-12 w-12 border border-emerald-600
        text-emerald-600 text-xl hover:bg-emerald-50
        rounded-l-none rounded-r-none -mr-px
        ${clampedPage === totalPages ? "opacity-40 pointer-events-none" : ""}`}
            >
              &rsaquo;
            </Link>

            {/* LAST » */}
            <Link
              href={makeQS(baseQS, { page: totalPages })}
              aria-label="Last page"
              aria-disabled={clampedPage === totalPages}
              tabIndex={clampedPage === totalPages ? -1 : 0}
              className={`grid place-items-center h-12 w-12 border-t border-b border-r border-emerald-600
        text-emerald-600 text-xl hover:bg-emerald-50
        rounded-r-lg rounded-l-none
        ${clampedPage === totalPages ? "opacity-40 pointer-events-none" : ""}`}
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
