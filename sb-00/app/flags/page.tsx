import HubFrame from '@/components/HubFrame';
import { FeedSection } from '@/components/Feed';
import { insights, isCrossNode, openFlags, NodeGroup } from '@/lib/data';

const single = (node: NodeGroup) =>
  insights.filter((i) => !isCrossNode(i) && i.nodes.includes(node));

export default function Flags() {
  return (
    <div className="page">
      <HubFrame
        status={<span className="flag">{openFlags().length} OPEN FLAGS</span>}
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
