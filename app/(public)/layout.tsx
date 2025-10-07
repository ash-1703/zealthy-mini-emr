import '../globals.css';
import { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
