import '../globals.css';
import { ReactNode } from 'react';


export default function PortalLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><div className="">{children}</div></body></html>;
}
