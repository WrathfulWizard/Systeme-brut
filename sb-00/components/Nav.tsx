'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * SB-00 navigation. Training is a grouped item that expands into Lifts /
 * Cardio; everything else is a flat node. Mirrors the closed IA.
 */
const ITEMS = [
  { href: '/', label: '00 Overview' },
  { group: 'Training', children: [
    { href: '/lifts', label: 'Lifts' },
    { href: '/cardio', label: 'Cardio' },
  ] },
  { href: '/pharmacology', label: 'Pharmacology' },
  { href: '/nutrition', label: 'Nutrition' },
  { href: '/flags', label: 'Flags, SB-Σ' },
  { href: '/connections', label: 'Connections' },
];

export default function Nav() {
  const path = usePathname();
  const on = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <nav className="nav">
      {ITEMS.map((item, i) =>
        'group' in item ? (
          <div key={i}>
            <div className="grouplbl">⌄ {item.group}</div>
            {item.children!.map((c) => (
              <Link key={c.href} href={c.href} className={`sub${on(c.href) ? ' on' : ''}`}>
                {c.label}
              </Link>
            ))}
          </div>
        ) : (
          <Link key={item.href} href={item.href!} className={on(item.href!) ? 'on' : ''}>
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
