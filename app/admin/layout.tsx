import '../globals.css';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><div className="">{children}</div></body></html>;
}
