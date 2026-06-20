'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NodeGlyph, { GLYPH_FOR } from './NodeGlyph';

/**
 * SB-00 navigation. SB-Σ (the agent) is home. Lifting and Cardio are their own
 * flat nodes; Substrate is intake + mass. Mirrors the closed IA.
 */
const ITEMS = [
  { href: '/', label: 'SB-Σ Synthesizer' },
  { href: '/lifts', label: 'Lifting' },
  { href: '/cardio', label: 'Cardio' },
  { href: '/pharmacology', label: 'Pharmacology' },
  { href: '/nutrition', label: 'Substrate' },
  { href: '/flags', label: 'Flags' },
  { href: '/connections', label: 'Connections' },
];

export default function Nav() {
  const path = usePathname();
  const on = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <nav className="nav">
      <Link href="/" className="nav-brand" aria-label="Systeme Brut">
        <NodeGlyph name="sb" size={18} />
        <span>SB-00</span>
      </Link>
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={on(item.href) ? 'on' : ''}>
          <NodeGlyph name={GLYPH_FOR[item.href]} size={13} className="nav-ico" />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
