'use client';

import { signOut } from 'next-auth/react';

export default function SignOutButton({
  children = 'Sign out',
  className = '',
  callbackUrl = '/',
}: { children?: React.ReactNode; className?: string; callbackUrl?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl })}
      className={className}
    >
      {children}
    </button>
  );
}
