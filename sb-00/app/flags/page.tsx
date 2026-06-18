'use client';

import HubFrame from '@/components/HubFrame';
import { FeedSection } from '@/components/Feed';
import { useSnapshot } from '../providers';
import type { Insight, NodeGroup } from '@/lib/types';

const isCrossNode = (i: Insight) => i.nodes.length > 1;

export default function Flags() {
  const { insights } = useSnapshot();
  const single = (node: NodeGroup) => insights.filter((i) => !isCrossNode(i) && i.nodes.includes(node));
  const flagCount = insights.filter((i) => i.severity === 'flag').length;

  return (
    <div className="page">
      <HubFrame
        status={<span className="flag">{flagCount} OPEN FLAGS</span>}
        foot={<span className="flag">Last flag — Sodium, today</span>}
      >
        {/* Cross-node — insights whose node_refs span more than one node group */}
        <FeedSection title="Cross-node" items={insights.filter(isCrossNode)} />
        <FeedSection title="Training" items={single('training')} />
        <FeedSection title="Pharmacology" items={single('pharmacology')} />
        <FeedSection title="Nutrition" items={single('nutrition')} />
      </HubFrame>
    </div>
  );
}
