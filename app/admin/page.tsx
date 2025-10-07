import prisma from "@/lib/prisma";
import Link from "next/link";
import ProviderAutocomplete from "../portal/appointments/autocomplete";
const PAGE_SIZE = 10;

export default async function Admin({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const dir = (sp.dir === "desc" ? "desc" : "asc") as "asc" | "desc";
  const page = Math.max(1, Number(sp.page ?? 1));
  const terms = q.split(/\s+/).filter(Boolean);
  let where: any = undefined;
  if (terms.length === 1 && terms[0]) {
    where = {
      OR: [
        { firstName: { contains: terms[0], mode: "insensitive" } },
        { lastName: { contains: terms[0], mode: "insensitive" } },
        { email: { contains: terms[0], mode: "insensitive" } },
      ],
    };
  } else if (terms.length > 1) {
    where = {
      AND: terms.map((t) => ({
        OR: [
          { firstName: { contains: t, mode: "insensitive" } },
          { lastName: { contains: t, mode: "insensitive" } },
          { email: { contains: t, mode: "insensitive" } },
        ],
      })),
    };
  }
  // Counts for pagination
  const total = await prisma.patient.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);

  // Page results (sorted by name)
  const patients = await prisma.patient.findMany({
    where,
    orderBy: [{ lastName: dir }, { firstName: dir }],
    skip: (clampedPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { _count: { select: { prescriptions: true, appointments: true } } },
  });

  // Autocomplete options 
  const nameRows = await prisma.patient.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 200,
    select: { firstName: true, lastName: true, email: true },
  });
  const patientOptions = Array.from(
    new Set(
      nameRows
        .map(n => `${n.firstName ?? ""} ${n.lastName ?? ""}`.trim())
        .filter(Boolean)
    )
  );

  // QS helper that preserves q & dir
  const mkQS = (patch: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    u.set("dir", dir);
    u.set("page", String(clampedPage));
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") u.delete(k);
      else u.set(k, String(v));
    }
    return `?${u.toString()}`;
  };
  <Link href="/admin" className="hidden" id="admin-root" />

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* NAV */}
      <header className=" top-0 z-10 w-full bg-gradient-to-r from-emerald-800 via-teal-700 to-sky-700 text-white shadow-sm">
        <div className="mx-auto w-[90%] md:w-[70%] flex h-16 items-center justify-between px-4">
          <div className="text-lg font-semibold tracking-[0.25em]">ZEALTHY</div>

        </div>
      </header>

      {/* CONTENT */}
      <div className="mx-auto w-[90%] md:w-[70%] px-4 py-8 space-y-6">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-emerald-700">EMR (Admin)</h1>
            <p className="text-sm text-emerald-700">Manage patients, prescriptions, and appointments.</p>
          </div>
          <Link
            href={mkQS({ m: "new" })}
            className="rounded-lg bpx-3.5 py-2 text-sm font-semibold text-emerald-700 "
          >
            + New Patient
          </Link>

        </div>

        {/* Filters (search + sort) — uses your autocomplete */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <form method="get" className="grid gap-3 sm:grid-cols-12 items-end" key={`${q || "∅"}|${dir}|${clampedPage}`}>
            <div className="sm:col-span-9">
              <label id="patient-label" className="block text-sm font-medium text-emerald-700">
                Search Patients
              </label>
              <ProviderAutocomplete
                labelId="patient-label"
                name="q"
                defaultValue={q}
                options={patientOptions}
                placeholder="Patient Name"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-emerald-700">Sort</label>
              <select
                name="dir"

                defaultValue={dir}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 "
              >
                <option value="asc">Name (A → Z)</option>
                <option value="desc">Name (Z → A)</option>
              </select>
            </div>
            <div className="sm:col-span-12 flex gap-2">
              <button className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Apply
              </button>
              <Link href="/admin" className="rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium hover:bg-neutral-50">
                Reset
              </Link>
            </div>
          </form>
        </section>

        {/* Table */}
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">


          <div className="overflow-x-auto">
            <table className="table min-w-full">

              <thead className="bg-[var(--brand-100)]">
                <tr className="text-left text-sm text-neutral-600">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3 text-center">Rx</th>
                  <th className="px-5 py-3 text-center">Appts</th>
                </tr>
              </thead>

              <tbody className="divide-y text-sm">
                {patients.map((p) => {
                  const href = `/admin/${p.id}`;
                  const label = `Open ${p.firstName} ${p.lastName}`;
                  return (
                    <tr key={p.id} className="hover:bg-[#F7FAF9]">
                      <td className="relative px-5 py-3">
                        <div className="font-medium text-neutral-900">
                          {p.firstName} {p.lastName}
                        </div>
                        <Link href={href} aria-label={label} className="absolute inset-0" />
                      </td>

                      <td className="relative px-5 py-3">
                        {p.email}
                        <Link href={href} aria-label={label} className="absolute inset-0" />
                      </td>

                      <td className="relative px-5 py-3 text-center">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-50 px-2 text-[13px] font-medium text-emerald-700">
                          {p._count.prescriptions}
                        </span>
                        <Link href={href} aria-label={label} className="absolute inset-0" />
                      </td>

                      <td className="relative px-5 py-3 text-center">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-sky-50 px-2 text-[13px] font-medium text-sky-700">
                          {p._count.appointments}
                        </span>
                        <Link href={href} aria-label={label} className="absolute inset-0" />
                      </td>
                    </tr>
                  );
                })}

                {patients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-neutral-500">
                      No patients match your search.
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          </div>

          {/* Pagination */}
          <nav className="mt-4 flex items-center justify-between gap-4 px-5 py-4">

            <div className="inline-flex">

              <Link
                href={mkQS({ page: 1 })}
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


              <Link
                href={mkQS({ page: Math.max(1, clampedPage - 1) })}
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


            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - clampedPage) <= 2 || p === 1 || p === totalPages)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 ? <span className="mx-1 subtle">…</span> : null}
                    <Link
                      href={mkQS({ page: p })}
                      className={`grid place-items-center h-10 min-w-10 px-3 border border-emerald-600
              ${p === clampedPage ? "bg-emerald-600 text-white" : "bg-white text-emerald-700 hover:bg-emerald-50"}
              rounded-none`}
                      aria-current={p === clampedPage ? "page" : undefined}
                    >
                      {p}
                    </Link>
                  </span>
                ))}
            </div>


            <div className="inline-flex">

              <Link
                href={mkQS({ page: Math.min(totalPages, clampedPage + 1) })}
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

            
              <Link
                href={mkQS({ page: totalPages })}
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

        </section>

        {/* Create Patient */}
        {sp.m === "new" && (
          <div className="fixed inset-0 z-50">
            {/* backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            {/* modal */}
            <div className="relative mx-auto mt-20 w-[92%] max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-emerald-700">Create New Patient</h3>
                <Link
                  href={mkQS({ m: undefined })}
                  aria-label="Close"
                  className="rounded p-1 hover:bg-neutral-100"
                >
                  ✕
                </Link>
              </div>

              <form action="/api/patients" method="post" className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">First name</label>
                  <input name="firstName" placeholder="Jane" className="input mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Last name</label>
                  <input name="lastName" placeholder="Doe" className="input mt-1" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Email</label>
                  <input name="email" type="email" placeholder="jane@example.com" className="input mt-1" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Temporary password</label>
                  <input name="password" type="text" placeholder="Choose a temp password" className="input mt-1" />
                </div>
                <input type="hidden" name="redirectTo" value="/admin" />
                <div className="md:col-span-2 mt-2 flex justify-end gap-2">
                  <Link href={mkQS({ m: undefined })} className="btn btn-ghost">Cancel</Link>
                  <button className="btn btn-brand">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
