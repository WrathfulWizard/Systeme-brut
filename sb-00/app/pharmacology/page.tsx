import HubFrame from '@/components/HubFrame';
import { Feed } from '@/components/Feed';
import { administrations, insights, labResults, regimen, titration } from '@/lib/data';

export default function Pharmacology() {
  const pharmFlags = insights.filter((i) => i.nodes.includes('pharmacology'));

  return (
    <div className="page">
      <HubFrame
        status={<>SYNC OK · <span className="flag">{pharmFlags.length} OPEN FLAGS</span></>}
        foot={<span className="flag">Last flag — ALT, 9 days ago</span>}
        side={<Feed items={pharmFlags} />}
      >
        <div className="block">
          <p className="eyebrow">Active regimen</p>
          <table>
            <tbody>
              <tr><th>Compound</th><th>Daily dose</th><th>Route</th></tr>
              {regimen.map((r) => (
                <tr key={r.compound}><td>{r.compound}</td><td>{r.dose}</td><td>{r.route}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block">
          <p className="eyebrow">Daily administrations</p>
          <table>
            <tbody>
              <tr><th>Date</th><th>Compound</th><th>Dose</th><th>Route</th></tr>
              {administrations.map((a, i) => (
                <tr key={i}><td>{a.date}</td><td>{a.compound}</td><td>{a.dose}</td><td>{a.route}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block">
          <p className="eyebrow">Titration history</p>
          <table>
            <tbody>
              <tr><th>Date</th><th>Compound</th><th>Change</th><th>Trigger</th></tr>
              {titration.map((t, i) => (
                <tr key={i}><td>{t.date}</td><td>{t.compound}</td><td>{t.change}</td><td>{t.trigger}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block">
          <p className="eyebrow">Latest panel — lab results</p>
          <table>
            <tbody>
              <tr><th>Marker</th><th>Value</th><th>Range</th><th>Status</th></tr>
              {labResults.map((l) => (
                <tr key={l.marker} className={l.flagged ? 'flagrow' : undefined}>
                  <td>{l.marker}</td><td>{l.value}</td><td>{l.range}</td>
                  <td>{l.flagged ? 'FLAGGED' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HubFrame>
    </div>
  );
}
