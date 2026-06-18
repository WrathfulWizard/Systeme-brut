import { Insight } from '@/lib/types';

/** A single SB-Σ feed row — flag rows get the magenta spine. */
export function FeedRow({ insight, showTime = false, onResolve }: { insight: Insight; showTime?: boolean; onResolve?: (id: number) => void }) {
  const flag = insight.severity === 'flag';
  return (
    <div className={`row${flag ? ' is-flag' : ''}`}>
      <span className="t">{flag ? 'Flag' : 'Info'}</span>
      <p>{showTime ? `${insight.at} — ${insight.body}` : insight.body}</p>
      {onResolve && <button className="rowbtn del" title="Dismiss" onClick={() => onResolve(insight.id)}>✓ clear</button>}
    </div>
  );
}

/** A flat feed (the side rail uses this). */
export function Feed({ items, showTime = false, onResolve }: { items: Insight[]; showTime?: boolean; onResolve?: (id: number) => void }) {
  return (
    <div className="feed">
      {items.map((i) => (
        <FeedRow key={i.id} insight={i} showTime={showTime} onResolve={onResolve} />
      ))}
    </div>
  );
}

/** A titled feed section (the by-node Flags screen uses these). */
export function FeedSection({ title, items, onResolve }: { title: string; items: Insight[]; onResolve?: (id: number) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="feed-section">
      <div className="fhead">{title}</div>
      <Feed items={items} onResolve={onResolve} />
    </div>
  );
}
