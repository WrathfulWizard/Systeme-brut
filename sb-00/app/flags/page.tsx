'use client';

import HubFrame from '@/components/HubFrame';
import { FeedSection } from '@/components/Feed';
import { useSb } from '../providers';
import type { Insight, NodeGroup } from '@/lib/types';

const isCrossNode = (i: Insight) => i.nodes.length > 1;

export default function Flags() {
  const { snapshot, resolveInsight, isDesktop } = useSb();
  const { insights } = snapshot;
  const single = (node: NodeGroup) => insights.filter((i) => !isCrossNode(i) && i.nodes.includes(node));
  const flagCount = insights.filter((i) => i.severity === 'flag').length;
  const resolve = isDesktop ? resolveInsight : undefined;
  // Catch-all: a flag the agent left untagged (no recognized node) would
  // otherwise count toward the total but appear in no section — surface it.
  const GROUPS: NodeGroup[] = ['training', 'pharmacology', 'nutrition'];
  const unfiled = insights.filter((i) => !isCrossNode(i) && !i.nodes.some((n) => GROUPS.includes(n)));

  return (
    <div className="page">
      <HubFrame foot={flagCount > 0 ? <span className="flag">{flagCount} open</span> : <span>All clear</span>}>
        <div className="block">
          <p className="eyebrow">SB-Σ flags — {insights.length === 0 ? 'all clear' : `${flagCount} flag${flagCount === 1 ? '' : 's'}, ${insights.length - flagCount} info`}</p>
          {insights.length === 0 && <p className="synced-note">Nothing open. SB-Σ surfaces cross-node concerns here; clear them as you act.</p>}
        </div>
        <FeedSection title="Cross-node" items={insights.filter(isCrossNode)} onResolve={resolve} />
        <FeedSection title="Lifting & Cardio" items={single('training')} onResolve={resolve} />
        <FeedSection title="Pharmacology" items={single('pharmacology')} onResolve={resolve} />
        <FeedSection title="Substrate" items={single('nutrition')} onResolve={resolve} />
        {unfiled.length > 0 && <FeedSection title="Unfiled" items={unfiled} onResolve={resolve} />}
      </HubFrame>
    </div>
  );
}
