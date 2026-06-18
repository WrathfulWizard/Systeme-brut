'use client';

import HubFrame from '@/components/HubFrame';
import { Feed } from '@/components/Feed';
import { AdminLogForm, TitrationLogForm, LabPanelLogForm } from '@/components/LogForms';
import { useSb } from '../providers';
import { useState } from 'react';
import type { AdminRow } from '@/lib/types';

export default function Pharmacology() {
  const { snapshot, deleteAdministration, deleteTitration, deleteLabPanel, isDesktop } = useSb();
  const { insights, regimen, administrations, titration, labResults, labPanelId } = snapshot;
  const pharmFlags = insights.filter((i) => i.nodes.includes('pharmacology'));
  const [editing, setEditing] = useState<AdminRow | null>(null);

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
          <AdminLogForm key={editing?.id ?? 'new'} editing={editing} onDone={() => setEditing(null)} />
          <p className="eyebrow">Daily administrations</p>
          <table>
            <tbody>
              <tr><th>Date</th><th>Compound</th><th>Dose</th><th>Route</th>{isDesktop && <th />}</tr>
              {administrations.map((a) => (
                <tr key={a.id} className={editing?.id === a.id ? 'prrow' : undefined}>
                  <td>{a.date}</td><td>{a.compound}</td><td>{a.dose}</td><td>{a.route}</td>
                  {isDesktop && (
                    <td className="rowact">
                      <button className="rowbtn" onClick={() => setEditing(a)}>edit</button>
                      <button className="rowbtn del" onClick={() => deleteAdministration(a.id)}>del</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block">
          <TitrationLogForm />
          <p className="eyebrow">Titration history</p>
          <table>
            <tbody>
              <tr><th>Date</th><th>Compound</th><th>Change</th><th>Trigger</th>{isDesktop && <th />}</tr>
              {titration.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td><td>{t.compound}</td><td>{t.change}</td><td>{t.trigger}</td>
                  {isDesktop && (
                    <td className="rowact">
                      <button className="rowbtn del" onClick={() => deleteTitration(t.id)}>del</button>
                    </td>
                  )}
                </tr>
              ))}
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
