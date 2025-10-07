'use client';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useState, useTransition } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signIn('credentials', {
        email,
        password: pw,
        redirect: false,
        callbackUrl: '/portal',
      });
      if (res?.ok) window.location.href = '/portal';
      else setError('Invalid email or password');
    });
  };

  return (
    // Grid ensures a true split: left = gradient, right = pale pane
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[56%_44%]">
      {/* LEFT: gradient hero */}
      <section className="relative hidden items-center justify-center bg-gradient-to-br from-emerald-800 via-teal-700 to-sky-700 md:flex">
        {/* subtle polygon texture lives INSIDE left only */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
          viewBox="0 0 1200 900"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g fill="url(#g)">
            <polygon points="0,0 400,0 200,260" />
            <polygon points="1200,0 800,0 1000,260" />
            <polygon points="0,900 380,900 200,620" />
            <polygon points="1200,900 820,900 1000,620" />
            <polygon points="240,200 720,200 480,520" />
            <polygon points="600,360 1060,360 830,640" />
          </g>
        </svg>

        <div className="relative mx-auto max-w-2xl px-8 text-center text-white">
          <p className="text-xl font-semibold uppercase tracking-[0.35em] text-emerald-100">Welcome to</p>
          <h1 className="mt-2 text-7xl font-extrabold tracking-tight">ZEALTHY</h1>
          <div className="mx-auto mt-8 h-[56px] w-[320px]">
            <EKG />
          </div>
          <p className="mx-auto mt-8 max-w-xl text-base text-emerald-50">
            Secure patient access for appointments, prescriptions, and care information.
          </p>
          <p className="mx-auto mt-10 max-w-xl text-[11px] text-emerald-100/80">
            Authorized use only. Activity may be monitored and audited.
          </p>
        </div>
      </section>

      {/* RIGHT: now pure white */}
      <section className="flex items-center justify-center bg-white px-6 py-12 md:border-l md:border-neutral-200">
        <div className="w-full max-w-md">
          <div className="p-8">
            <h2 className="text-center text-2xl font-semibold text-neutral-900">Sign Into Your Account</h2>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-900">Email address *</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-500 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-900">Password *</label>
                <div className="relative mt-1">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 pr-10 text-sm text-neutral-900 placeholder-neutral-500 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute inset-y-0 right-0 px-3 text-neutral-600 hover:text-neutral-800"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" aria-live="polite" className="text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {isPending ? 'Logging in…' : 'Log in'}
              </button>

              <p className="mt-6 text-center text-xs text-neutral-400">
                © {new Date().getFullYear()}{' '}
                <Link href="https://www.getzealthy.com/" className="hover:underline">
                  Zealthy
                </Link>
                . All rights reserved.
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

/* tiny inline icons */
function EyeIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}
function EyeOffIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A3.5 3.5 0 0 0 12 15.5M7.4 7.6C5.2 8.8 3.7 10.6 3 12c0 0 4 7 11 7 2 0 3.7-.6 5.1-1.6M14.1 9.9A3.5 3.5 0 0 0 8.5 12" />
      <path d="M20.9 8.6c-2-3.2-5.9-5.6-9.9-5.6-1.1 0-2.1.2-3 .5" />
    </svg>
  );
}
function EKG() {
  return (
    <svg viewBox="0 0 320 56" className="h-full w-full" aria-hidden="true" fill="none">
      <path
        d="M0 28h80l16-18 18 34 24-42 26 44 18-12 16 6h122"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
