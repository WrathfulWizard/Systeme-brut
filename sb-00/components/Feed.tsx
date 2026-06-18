import { Insight } from '@/lib/types';

/** A single SB-Σ feed row — flag rows get the magenta spine. */
export function FeedRow({ insight, showTime = false }: { insight: Insight; showTime?: boolean }) {
  const flag = insight.severity === 'flag';
  return (
    <div className={`row${flag ? ' is-flag' : ''}`}>
      <span className="t">{flag ? 'Flag' : 'Info'}</span>
      <p>{showTime ? `${insight.at} — ${insight.body}` : insight.body}</p>
    </div>
  );
}

/** A flat feed (the side rail uses this). */
export function Feed({ items, showTime = false }: { items: Insight[]; showTime?: boolean }) {
  return (
    <div className="feed">
      {items.map((i) => (
        <FeedRow key={i.id} insight={i} showTime={showTime} />
      ))}
    </div>
  );
}

/** A titled feed section (the by-node Flags screen uses these). */
export function FeedSection({ title, items }: { title: string; items: Insight[] }) {
  if (items.length === 0) return null;
  return (
    <div className="feed-section">
      <div className="fhead">{title}</div>
      <Feed items={items} />
    </div>
  );
}
