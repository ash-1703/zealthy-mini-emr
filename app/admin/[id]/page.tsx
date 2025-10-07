import Link from "next/link";
import prisma from "@/lib/prisma";
import {
  savePatient,
  addRx, updateRx, deleteRx,
  addAppt, updateAppt, deleteAppt,
} from "./actions";

function qs(
  base: Record<string, string | undefined>,
  patch: Record<string, string | number | undefined>
) {
  const u = new URLSearchParams();
  const merged = {
    ...base,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
  };
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "") u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "?";
}

export default async function AdminPatient({
  params,
  searchParams,
}: {
  params: { id: string }; 
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const m = sp.m ?? "";

  const pid = Number(params.id);
  if (!Number.isFinite(pid)) {
    return <main className="p-8">Invalid patient id.</main>;
  }

  const patient = await prisma.patient.findUnique({
    where: { id: pid }, 
    include: {
      prescriptions: { include: { medication: true } },
      appointments: true,
    },
  });
  if (!patient) return <main className="p-8">Patient not found.</main>;

  const providerOptions = Array.from(
    new Set<string>([
      ...((patient.appointments ?? []).map(a => a.providerName || "").filter(Boolean)),
      "Dr Sally Field",
      "Dr Lin James",
      "Dr John Doe",
      "Dr Kim West"
    ])
  ).sort((a, b) => a.localeCompare(b));

  const meds = await prisma.medication.findMany({ include: { strengths: true } });

  // Modal route helpers
  const isAddRx = m === "add-rx";
  const isAddAppt = m === "add-appt";
  const isEditRx = m.startsWith("edit-rx:");
  const isEditAppt = m.startsWith("edit-appt:");
  const isConfirmRx = m.startsWith("confirm-rx:");
  const isConfirmAppt = m.startsWith("confirm-appt:");

  const confirmRxId = isConfirmRx ? m.split(":")[1] : undefined;
  const confirmApptId = isConfirmAppt ? m.split(":")[1] : undefined;

  const rxToDelete = isConfirmRx
    ? patient.prescriptions.find(r => String(r.id) === String(confirmRxId))
    : undefined;

  const apptToDelete = isConfirmAppt
    ? patient.appointments.find(a => String(a.id) === String(confirmApptId))
    : undefined;

  const editRxId = isEditRx ? m.split(":")[1] : undefined;
  const editApptId = isEditAppt ? m.split(":")[1] : undefined;

  const rxToEdit = isEditRx
    ? patient.prescriptions.find((r) => String(r.id) === String(editRxId))
    : undefined;

  const apptToEdit = isEditAppt
    ? patient.appointments.find((a) => String(a.id) === String(editApptId))
    : undefined;

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Navbar */}
      <header className="top-0 z-10 w-full bg-gradient-to-r from-emerald-800 via-teal-700 to-sky-700 text-white shadow-sm">
        <div className="mx-auto w-[90%] md:w-[70%] flex h-16 items-center justify-between px-4">
          <div className="text-lg font-semibold tracking-[0.25em]">ZEALTHY</div>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto w-[90%] md:w-[70%] px-4 py-8 space-y-8">
        {/* Title / back */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-emerald-700">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="text-sm text-neutral-600">{patient.email}</p>
          </div>
          <Link href="/admin" className="text-sm font-medium text-emerald-700 hover:underline">
            ← Back to Patients
          </Link>
        </div>

        {/* Patient info */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-emerald-700">Patient Info</h2>
            <Link
              href={qs({}, { m: "edit-patient" })}
              className="rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Edit
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-neutral-500">Name</div>
              <div className="font-medium">
                {patient.firstName} {patient.lastName}
              </div>
            </div>
            <div>
              <div className="text-neutral-500">DOB</div>
              <div className="font-medium">
                {patient.dob
                  ? new Date(patient.dob).toLocaleDateString(undefined, { timeZone: "UTC" })
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-neutral-500">Email</div>
              <div className="font-medium">{patient.email}</div>
            </div>
            <div>
              <div className="text-neutral-500">Phone</div>
              <div className="font-medium">{patient.phone || "—"}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-neutral-500">Address</div>
              <div className="font-medium whitespace-pre-wrap">{patient.address || "—"}</div>
            </div>
          </div>
        </section>

        {/* Two-column: Prescriptions / Appointments */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Prescriptions */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-emerald-700">Prescriptions</h2>
              <Link
                href={qs({}, { m: "add-rx" })}
                className="rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Add
              </Link>
            </div>

            <ul className="mt-4 divide-y">
              {patient.prescriptions.map((rx) => (
                <li key={rx.id} className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm">
                      <div className="font-medium text-neutral-900">
                        {rx.medication.name} <span className="text-neutral-400">•</span> {rx.dosageText}
                      </div>
                      <div className="text-neutral-600">
                        Qty {rx.quantity}
                        {rx.startDate && (
                          <>
                            {" "}
                            <span className="text-neutral-400">•</span> Starts{" "}
                            {new Date(rx.startDate).toLocaleDateString()}
                          </>
                        )}
                        {rx.refillUntil && (
                          <>
                            {" "}
                            <span className="text-neutral-400">•</span> Refill until{" "}
                            {new Date(rx.refillUntil).toLocaleDateString()}
                          </>
                        )}
                        {" "}
                        <span className="text-neutral-400">•</span> {rx.schedule}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={qs({}, { m: `edit-rx:${rx.id}` })}
                        className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm hover:bg-neutral-50"
                      >
                        Edit
                      </Link>
                      <Link
                        href={qs({}, { m: `confirm-rx:${rx.id}` })}
                        className="btn btn-danger px-2.5 py-1.5 text-sm"
                      >
                        Delete
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
              {patient.prescriptions.length === 0 && (
                <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
                  No prescriptions on file.
                </li>
              )}
            </ul>
          </div>

          {/* Appointments */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-emerald-700">Appointments</h2>
              <Link
                href={qs({}, { m: "add-appt" })}
                className="rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Add
              </Link>
            </div>

            <ul className="mt-4 divide-y">
              {patient.appointments.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm">
                      <div className="font-medium text-neutral-900">
                        {new Date(a.startDateTime).toLocaleString()}
                      </div>
                      <div className="text-neutral-600">{a.providerName}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={qs({}, { m: `edit-appt:${a.id}` })}
                        className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm hover:bg-neutral-50"
                      >
                        Edit
                      </Link>
                      <Link
                        href={qs({}, { m: `confirm-appt:${a.id}` })}
                        className="btn btn-danger px-2.5 py-1.5 text-sm"
                      >
                        Delete
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
              {patient.appointments.length === 0 && (
                <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
                  No appointments scheduled.
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>

      {/* ---------- ROUTED MODALS ---------- */}
      {(isAddRx || isEditRx || isAddAppt || isEditAppt || m === "edit-patient" || isConfirmRx || isConfirmAppt) && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative mx-auto mt-20 w-[92%] max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {m === "edit-patient" && "Edit Patient Info"}
                {isAddRx && "Add Prescription"}
                {isEditRx && rxToEdit && `Edit Prescription: ${rxToEdit.medication.name} – ${rxToEdit.dosageText}`}
                {isAddAppt && "Add Appointment"}
                {isEditAppt && "Edit Appointment"}
                {isConfirmRx && "Delete Prescription"}
                {isConfirmAppt && "Delete Appointment"}
              </h3>
              <Link href="?" aria-label="Close" className="rounded p-1 hover:bg-neutral-100">✕</Link>
            </div>

            {/* EDIT PATIENT */}
            {m === "edit-patient" && (
              <form action={savePatient} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="id" value={patient.id} />

                <div>
                  <label className="block text-sm font-medium">First name</label>
                  <input name="firstName" defaultValue={patient.firstName ?? ""} className="input mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Last name</label>
                  <input name="lastName" defaultValue={patient.lastName ?? ""} className="input mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Date of birth</label>
                  <input
                    name="dob"
                    type="date"
                    defaultValue={patient.dob ? new Date(patient.dob).toISOString().slice(0, 10) : ""}
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Phone</label>
                  <input name="phone" defaultValue={patient.phone ?? ""} className="input mt-1" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Email</label>
                  <input name="email" defaultValue={patient.email ?? ""} className="input mt-1" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Address</label>
                  <textarea name="address" defaultValue={patient.address ?? ""} className="input mt-1" />
                </div>

                <div className="md:col-span-2 mt-2 flex justify-end gap-2">
                  <Link href="?" className="btn btn-ghost">Cancel</Link>
                  <button className="btn btn-brand">Save Changes</button>
                </div>
              </form>
            )}

            {/* ADD RX */}
            {isAddRx && (
              <form action={addRx} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="patientId" value={patient.id} />

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Medication</label>
                  <select name="medicationId" className="input mt-1" defaultValue="">
                    <option value="" disabled>Select a medication</option>
                    {meds.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Dosage</label>
                  <select name="dosageText" className="input mt-1" defaultValue="500mg">
                    {["1mg","2mg","3mg","5mg","10mg","25mg","50mg","100mg","250mg","500mg","1000mg"].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Quantity</label>
                  <input name="quantity" type="number" defaultValue={30} className="input mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-medium">Refill schedule</label>
                  <select name="schedule" className="input mt-1" defaultValue="weekly">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Start date</label>
                  <input name="startDate" type="date" className="input mt-1" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Refill until (optional)</label>
                  <input name="refillUntil" type="date" className="input mt-1" />
                </div>

                <div className="md:col-span-2 mt-2 flex justify-end gap-2">
                  <Link href="?" className="btn btn-ghost">Cancel</Link>
                  <button className="btn btn-success">Add Prescription</button>
                </div>
              </form>
            )}

            {/* EDIT RX */}
            {isEditRx && rxToEdit && (
              <form action={updateRx} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="id" value={rxToEdit.id} />
                <input type="hidden" name="patientId" value={patient.id} />

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Medication</label>
                  <input className="input mt-1" value={rxToEdit.medication.name} readOnly />
                </div>

                <div>
                  <label className="block text-sm font-medium">Dosage</label>
                  <select name="dosageText" className="input mt-1" defaultValue={rxToEdit.dosageText}>
                    {["1mg","2mg","3mg","5mg","10mg","25mg","50mg","100mg","250mg","500mg","1000mg"].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Quantity</label>
                  <input name="quantity" type="number" defaultValue={rxToEdit.quantity} className="input mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-medium">Refill schedule</label>
                  <select name="schedule" className="input mt-1" defaultValue={rxToEdit.schedule}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Start date</label>
                  <input
                    name="startDate"
                    type="date"
                    defaultValue={rxToEdit.startDate ? new Date(rxToEdit.startDate).toISOString().slice(0,10) : ""}
                    className="input mt-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Refill until</label>
                  <input
                    name="refillUntil"
                    type="date"
                    defaultValue={rxToEdit.refillUntil ? new Date(rxToEdit.refillUntil).toISOString().slice(0,10) : ""}
                    className="input mt-1"
                  />
                </div>

                <div className="md:col-span-2 mt-2 flex justify-end gap-2">
                  <Link href="?" className="btn btn-ghost">Cancel</Link>
                  <button className="btn btn-brand">Save Changes</button>
                </div>
              </form>
            )}

            {/* ADD APPT  */}
            {isAddAppt && (
              <form action={addAppt} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="patientId" value={patient.id} />

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Provider</label>
                  <select name="providerName" className="input mt-1" defaultValue="">
                    <option value="" disabled>Select a provider</option>
                    {providerOptions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Start date/time</label>
                  <input name="startDateTime" type="datetime-local" className="input mt-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Duration (min)</label>
                  <input name="durationMin" type="number" defaultValue={30} className="input mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-medium">Repeats</label>
                  <select name="repeatFreq" className="input mt-1" defaultValue="NONE">
                    <option value="NONE">Does not repeat</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Every</label>
                  <input name="repeatInterval" type="number" min={1} defaultValue={1} className="input mt-1" />
                  <p className="mt-1 text-xs text-neutral-500">
                    e.g. “Every 2 weeks” → Repeats: Weekly, Every: 2
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Ends (optional)</label>
                  <input name="repeatUntil" type="date" className="input mt-1" />
                  <p className="mt-1 text-xs text-neutral-500">Leave blank to repeat indefinitely.</p>
                </div>

                <div className="md:col-span-2 mt-2 flex justify-end gap-2">
                  <Link href="?" className="btn btn-ghost">Cancel</Link>
                  <button className="btn btn-brand">Add appointment</button>
                </div>
              </form>
            )}

            {/* EDIT APPT */}
            {isEditAppt && apptToEdit && (
              <form action={updateAppt} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="id" value={apptToEdit.id} />
                <input type="hidden" name="patientId" value={patient.id} />

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Provider</label>
                  <select name="providerName" className="input mt-1" defaultValue={apptToEdit.providerName || ""}>
                    {providerOptions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Start date/time</label>
                  <input
                    name="startDateTime"
                    type="datetime-local"
                    defaultValue={new Date(apptToEdit.startDateTime).toISOString().slice(0, 16)}
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Duration (min)</label>
                  <input name="durationMin" type="number" defaultValue={apptToEdit.durationMin ?? 30} className="input mt-1" />
                </div>

                {(() => {
                  const matchFreq = apptToEdit.rrule?.match(/FREQ=([A-Z]+)/)?.[1] ?? "NONE";
                  const matchInterval = apptToEdit.rrule?.match(/INTERVAL=(\d+)/)?.[1] ?? "1";
                  const matchUntil = apptToEdit.until ? new Date(apptToEdit.until).toISOString().slice(0, 10) : "";
                  return (
                    <>
                      <div>
                        <label className="block text-sm font-medium">Repeats</label>
                        <select name="repeatFreq" className="input mt-1" defaultValue={matchFreq}>
                          <option value="NONE">Does not repeat</option>
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                          <option value="YEARLY">Yearly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Every</label>
                        <input name="repeatInterval" type="number" min={1} defaultValue={matchInterval} className="input mt-1" />
                        <p className="mt-1 text-xs text-neutral-500">
                          e.g. “Every 2 weeks” → Repeats: Weekly, Every: 2
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium">Ends (optional)</label>
                        <input name="repeatUntil" type="date" defaultValue={matchUntil} className="input mt-1" />
                      </div>
                    </>
                  );
                })()}

                <div className="md:col-span-2 mt-2 flex justify-end gap-2">
                  <Link href="?" className="btn btn-ghost">Cancel</Link>
                  <button className="btn btn-brand">Save changes</button>
                </div>
              </form>
            )}

            {/* CONFIRM DELETE — RX */}
            {isConfirmRx && rxToDelete && (
              <div className="space-y-4">
                <p className="text-sm text-neutral-700">
                  Are you sure you want to delete this prescription?
                </p>
                <div className="rounded-md bg-neutral-50 p-3 text-sm">
                  <div className="font-medium text-neutral-900">
                    {rxToDelete.medication.name} <span className="text-neutral-400">•</span> {rxToDelete.dosageText}
                  </div>
                  <div className="text-neutral-600">Qty {rxToDelete.quantity}</div>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Link href="?" className="btn btn-ghost">Cancel</Link>
                  <form action={deleteRx}>
                    <input type="hidden" name="id" value={rxToDelete.id} />
                    <input type="hidden" name="patientId" value={patient.id} />
                    <button className="btn btn-danger">Delete</button>
                  </form>
                </div>
              </div>
            )}

            {/* CONFIRM DELETE — APPOINTMENT */}
            {isConfirmAppt && apptToDelete && (
              <div className="space-y-4">
                <p className="text-sm text-neutral-700">
                  Are you sure you want to delete this appointment?
                </p>
                <div className="rounded-md bg-neutral-50 p-3 text-sm">
                  <div className="font-medium text-neutral-900">
                    {new Date(apptToDelete.startDateTime).toLocaleString()}
                  </div>
                  <div className="text-neutral-600">{apptToDelete.providerName}</div>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Link href="?" className="btn btn-ghost">Cancel</Link>
                  <form action={deleteAppt}>
                    <input type="hidden" name="id" value={apptToDelete.id} />
                    <input type="hidden" name="patientId" value={patient.id} />
                    <button className="btn btn-danger">Delete</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
