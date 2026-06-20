/**
 * Node logos — systeme brut × ghost in the shell. Minimal monochrome line-art
 * (stroke = currentColor, no fill weight beyond the core dots), so each node
 * carries a HUD glyph without breaking the flat, one-flag-colour philosophy.
 * 16×16 grid, 1.2 stroke — reads at 12px in the nav and at 40px on a splash.
 */
export type GlyphKey =
  | 'synthesizer' | 'lifting' | 'cardio' | 'pharmacology' | 'substrate'
  | 'flags' | 'connections' | 'sb';

const P: Record<GlyphKey, React.ReactNode> = {
  // Σ-core — hexagonal synthesizer with a live center node
  synthesizer: (<>
    <path d="M8 1.6 L13.5 4.8 V11.2 L8 14.4 L2.5 11.2 V4.8 Z" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
  </>),
  // barbell
  lifting: (<>
    <path d="M1.5 8 H14.5" />
    <path d="M4 5.4 V10.6 M5.4 6.6 V9.4 M10.6 6.6 V9.4 M12 5.4 V10.6" />
  </>),
  // ECG pulse
  cardio: (<path d="M1 8 H4.6 L6.4 4 L8.2 12.4 L10 8 H15" />),
  // droplet (serum)
  pharmacology: (<>
    <path d="M8 1.8 C10.8 6 12 8 12 10 A4 4 0 0 1 4 10 C4 8 5.2 6 8 1.8 Z" />
    <path d="M5.4 10.4 A2.6 2.6 0 0 0 8 12.4" />
  </>),
  // flask (intake / mass)
  substrate: (<>
    <path d="M6.4 1.8 H9.6 M6.9 1.8 V5.4 L4.3 12.6 A1.5 1.5 0 0 0 5.7 14.6 H10.3 A1.5 1.5 0 0 0 11.7 12.6 L9.1 5.4 V1.8" />
    <path d="M5.4 10.2 H10.6" />
  </>),
  // flag
  flags: (<path d="M4 1.8 V14.4 M4 2.4 H12 L10 4.8 L12 7.2 H4" />),
  // linked nodes
  connections: (<>
    <circle cx="4.4" cy="11.4" r="2.1" /><circle cx="11.6" cy="4.6" r="2.1" />
    <path d="M5.9 9.9 L10.1 6.1" />
  </>),
  // app monogram — brackets around a Σ
  sb: (<>
    <path d="M5.2 2.6 H3 V13.4 H5.2 M10.8 2.6 H13 V13.4 H10.8" />
    <path d="M6.6 5.4 H9.6 L7.2 8 L9.6 10.6 H6.6" />
  </>),
};

export default function NodeGlyph({ name, size = 14, className }: { name: GlyphKey; size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden
      fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"
    >
      {P[name]}
    </svg>
  );
}

/** Map a nav href to its glyph. */
export const GLYPH_FOR: Record<string, GlyphKey> = {
  '/': 'synthesizer', '/lifts': 'lifting', '/cardio': 'cardio',
  '/pharmacology': 'pharmacology', '/nutrition': 'substrate', '/flags': 'flags', '/connections': 'connections',
};
