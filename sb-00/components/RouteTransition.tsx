'use client';

import { usePathname } from 'next/navigation';

/**
 * Re-keys on the active route so each node mounts with the `nodeIn` HUD-panel
 * animation — a smooth, deliberate hand-off between nodes rather than a hard cut.
 */
export default function RouteTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <div key={path} className="route-fade">{children}</div>;
}
