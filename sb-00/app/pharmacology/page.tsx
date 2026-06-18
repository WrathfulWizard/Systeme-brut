'use client';

import { useState, Fragment } from 'react';
import HubFrame from '@/components/HubFrame';
import { Feed } from '@/components/Feed';
import { ProtocolAddForm, TitrateForm, LabPanelLogForm } from '@/components/LogForms';
import SerumLiquidRender from '@/components/SerumLiquidRender';
import SerumDetail from '@/components/SerumDetail';
import { useSb } from '../providers';

export default function Pharmacology() {
  const { snapshot, endProtocol, deleteProtocol, deleteTitration, deleteLabPanel, resolveInsight, isDesktop } = useSb();
  const { insights, protocols, titration, labResults, labPanelId, serumByCompound } = snapshot;
  const pharmFlags = insights.filter((i) => i.nodes.includes('pharmacology'));
  const [titrating, setTitrating] = useState<number | null>(null);

  const totalCurrent = serumByCompound.reduce((m, c) => m + c.current, 0);

  return (
    <div className="page">
      <HubFrame
        foot={pharmFlags.length ? <span className="flag">{pharmFlags.length} pharma flag{pharmFlags.length === 1 ? '' : 's'}</span> : undefined}
        side={<Feed items={pharmFlags} onResolve={isDesktop ? resolveInsight : undefined} />}
      >
        <div className="block">
          <ProtocolAddForm />
          <p className="eyebrow">Continuous protocol</p>
          <table>
            <tbody>
              <tr><th>Compound</th><th>Daily dose</th><th>Route</th><th>Since</th>{isDesktop && <th />}</tr>
              {protocols.map((p) => (
                <Fragment key={p.id}>
                  <tr>
                    <td>{p.compound}</td><td>{p.dose}</td><td>{p.route}</td><td>{p.since}</td>
                    {isDesktop && (
                      <td className="rowact">
                        <button className="rowbtn" onClick={() => setTitrating(titrating === p.id ? null : p.id)}>titrate</button>
                        <button className="rowbtn" onClick={() => endProtocol(p.id)}>end</button>
                        <button className="rowbtn del" onClick={() => deleteProtocol(p.id)}>del</button>
                      </td>
                    )}
                  </tr>
                  {titrating === p.id && (
                    <tr><td colSpan={5} style={{ padding: 0 }}>
                      <TitrateForm id={p.id} current={p.doseMg} compound={p.compound} onDone={() => setTitrating(null)} />
                    </td></tr>
                  )}
                </Fragment>
              ))}
              {protocols.length === 0 && <tr><td colSpan={isDesktop ? 5 : 4}>No active protocol. Add a compound to begin.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="block">
          <p className="eyebrow">Serum dynamics — estimated, half-life model</p>
          <div className="liquid-card tall">
            <span className="tag">Serum Dynamics</span>
            <SerumLiquidRender compounds={serumByCompound} />
            <div className="read">{totalCurrent}<span className="v">mg total in system</span></div>
          </div>
          <p className="synced-note">
            Estimated from your log + each compound&apos;s half-life. Relative units for trend &amp; accumulation — not a blood assay.
          </p>
          <p className="eyebrow" style={{ marginTop: 16 }}>Per-compound — tap to chart</p>
          <SerumDetail compounds={serumByCompound} />
        </div>

        <div className="block">
          <p className="eyebrow">Titration history</p>
          <table>
            <tbody>
              <tr><th>Date</th><th>Compound</th><th>Change</th><th>Trigger</th>{isDesktop && <th />}</tr>
              {titration.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td><td>{t.compound}</td><td><b className="flag">{t.change}</b></td><td>{t.trigger}</td>
                  {isDesktop && <td className="rowact"><button className="rowbtn del" onClick={() => deleteTitration(t.id)}>del</button></td>}
                </tr>
              ))}
              {titration.length === 0 && <tr><td colSpan={isDesktop ? 5 : 4}>No changes logged. Titrating a protocol records the change here.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="block">
          <LabPanelLogForm />
          <div className="logbar" style={{ justifyContent: 'space-between' }}>
            <p className="eyebrow" style={{ margin: 0 }}>Latest panel — lab results</p>
            {isDesktop && labPanelId != null && labResults.length > 0 && (
              <button className="rowbtn del" onClick={() => deleteLabPanel(labPanelId)}>delete panel</button>
            )}
          </div>
          <table>
            <tbody>
              <tr><th>Marker</th><th>Value</th><th>Range</th><th>Status</th></tr>
              {labResults.map((l) => (
                <tr key={l.marker} className={l.flagged ? 'flagrow' : undefined}>
                  <td>{l.marker}</td><td>{l.value}</td><td>{l.range}</td><td>{l.flagged ? 'FLAGGED' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HubFrame>
    </div>
  );
}
