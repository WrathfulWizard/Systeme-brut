import { AsciiRow } from '@/lib/ascii';

/**
 * Renders ASCII bar rows as real monospace text. Spacing is preserved via
 * `white-space: pre` on `.ascii`, so the bars line up the way the mockups do.
 */
export default function Ascii({ rows }: { rows: AsciiRow[] }) {
  return (
    <div className="ascii">
      {rows.map((r, i) => (
        <div key={i}>
          {r.label}  {r.bar} <span className="v">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
