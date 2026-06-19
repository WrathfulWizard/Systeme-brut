'use client';

import { useState } from 'react';
import HubFrame from '@/components/HubFrame';
import { useSb } from '../providers';
import type { ConnectionState, SourceId } from '@/lib/types';

const LABEL: Record<SourceId, string> = {
  strava: 'Strava', cronometer: 'Cronometer', apple_health: 'Apple Health',
};
const HOW: Record<SourceId, string> = {
  strava: 'Real API — OAuth, then runs/rides/swims pull on a 15-min schedule into Cardio.',
  cronometer: 'Import the CSV you export from Cronometer (reliable, no login). Or link credentials to auto-pull the daily export.',
  apple_health: 'Push only — point the Health Auto Export app (or a Shortcut) at the endpoint below. Phone and PC must be on the same Wi-Fi.',
};

function dot(status: ConnectionState['status']) {
  const color = status === 'connected' ? '#3ad07a' : status === 'error' ? 'var(--mag)' : 'var(--dim)';
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 7, background: color, marginRight: 8 }} />;
}

export default function Connections() {
  const { sync, isDesktop, connectStrava, connectCronometer, importCronometerCsv, disconnect, syncNow, saveStravaApp, agent, refreshAgent, setAgentModel } = useSb();
  const [cronUser, setCronUser] = useState('');
  const [cronPass, setCronPass] = useState('');
  const [cronNote, setCronNote] = useState('');
  const [stravaId, setStravaId] = useState('');
  const [stravaSecret, setStravaSecret] = useState('');
  const [busy, setBusy] = useState<SourceId | null>(null);

  const onCronCsv = async (file?: File) => {
    if (!file) return;
    setBusy('cronometer'); setCronNote('Reading CSV…');
    try {
      const text = await file.text();
      const r = await importCronometerCsv(text);
      setCronNote(r.ok ? `Imported ${r.days} day${r.days === 1 ? '' : 's'} from ${file.name}.` : `⚠ ${r.error ?? 'Import failed.'}`);
    } catch (e) {
      setCronNote(`⚠ ${(e as Error).message}`);
    } finally { setBusy(null); }
  };

  const get = (s: SourceId) => sync.connections.find((c) => c.source === s)
    ?? { source: s, status: 'disconnected' as const };

  const wrap = (s: SourceId, fn: () => Promise<unknown>) => async () => {
    setBusy(s); try { await fn(); } finally { setBusy(null); }
  };

  return (
    <div className="page">
      <HubFrame
        status={<>DATA SOURCES · {sync.connections.filter((c) => c.status === 'connected').length}/3 LINKED</>}
        foot={<span>Strava · Cronometer · Apple Health</span>}
      >
        {!isDesktop && (
          <div className="block" style={{ border: '1px solid var(--line)', padding: 14 }}>
            <p className="mono" style={{ margin: 0, fontSize: 12, color: 'var(--dim)' }}>
              Connections are managed by the desktop app. In a plain browser this screen is read-only —
              launch SB-00 as the standalone program to link sources.
            </p>
          </div>
        )}

        {(['strava', 'cronometer', 'apple_health'] as SourceId[]).map((s) => {
          const c = get(s);
          return (
            <div key={s} className="block" style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: 16 }}>
              <p className="eyebrow" style={{ marginBottom: 6 }}>
                {dot(c.status)}{LABEL[s]}
                <span style={{ color: 'var(--dim)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  {'  '}— {c.status}{c.detail ? ` · ${c.detail}` : ''}
                  {c.lastSyncAt ? ` · last sync ${new Date(c.lastSyncAt).toLocaleString()}` : ''}
                </span>
              </p>
              <p className="mono" style={{ fontSize: 11.5, color: 'var(--dim)', margin: '0 0 12px', lineHeight: 1.6 }}>{HOW[s]}</p>

              {s === 'strava' && (
                c.status === 'connected'
                  ? <div className="btnrow-inline">
                      <button className="btn" disabled={busy === s} onClick={wrap(s, () => syncNow('strava'))}>Sync now</button>
                      <button className="btn" disabled={busy === s} onClick={wrap(s, () => disconnect('strava'))}>Disconnect</button>
                    </div>
                  : !c.configured
                    ? <div>
                        <p className="mono" style={{ fontSize: 11, color: 'var(--dim)', margin: '0 0 8px' }}>
                          One-time setup: create a free personal API app at{' '}
                          <span style={{ color: 'var(--text)' }}>strava.com/settings/api</span>{' '}
                          (set <span style={{ color: 'var(--text)' }}>Authorization Callback Domain</span> to <span style={{ color: 'var(--text)' }}>127.0.0.1</span>),
                          then paste its Client ID and Secret here.
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input className="fld" placeholder="Client ID" value={stravaId} onChange={(e) => setStravaId(e.target.value)} />
                          <input className="fld" placeholder="Client Secret" type="password" value={stravaSecret} onChange={(e) => setStravaSecret(e.target.value)} />
                          <button className="btn" disabled={!isDesktop || busy === s || !stravaId || !stravaSecret}
                            onClick={wrap(s, async () => { await saveStravaApp(stravaId.trim(), stravaSecret.trim()); setStravaSecret(''); })}>
                            Save credentials
                          </button>
                        </div>
                      </div>
                    : <div className="btnrow-inline">
                        <button className="btn" disabled={!isDesktop || busy === s} onClick={wrap(s, connectStrava)}>
                          {busy === s ? 'Waiting for browser…' : 'Connect Strava'}
                        </button>
                        <button className="btn" disabled={busy === s} onClick={wrap(s, () => saveStravaApp('', ''))}>Reset credentials</button>
                      </div>
              )}

              {s === 'cronometer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Primary: credential auto-sync (enter once → pulls hourly). */}
                  {c.status === 'connected'
                    ? <div className="btnrow-inline">
                        <span className="mono" style={{ fontSize: 11, color: 'var(--dim)', alignSelf: 'center' }}>Auto-syncs hourly.</span>
                        <button className="btn" disabled={busy === s} onClick={wrap(s, () => syncNow('cronometer'))}>Sync now</button>
                        <button className="btn" disabled={busy === s} onClick={wrap(s, () => disconnect('cronometer'))}>Disconnect</button>
                      </div>
                    : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input className="fld" placeholder="email" value={cronUser} onChange={(e) => setCronUser(e.target.value)} />
                        <input className="fld" placeholder="password" type="password" value={cronPass} onChange={(e) => setCronPass(e.target.value)} />
                        <button className="btn" disabled={!isDesktop || busy === s || !cronUser || !cronPass}
                          onClick={wrap(s, async () => { await connectCronometer(cronUser, cronPass); setCronPass(''); })}>
                          {busy === s ? 'Linking…' : 'Link & auto-sync'}
                        </button>
                      </div>}
                  {c.status === 'error' && c.detail && (
                    <p className="mono" style={{ fontSize: 11, color: 'var(--mag)', margin: 0 }}>{c.detail}</p>
                  )}
                  {/* Fallback: import a CSV you exported yourself (always works). */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label className="btn" style={{ cursor: isDesktop ? 'pointer' : 'default' }}>
                      {busy === s ? 'Importing…' : 'Import CSV instead'}
                      <input type="file" accept=".csv,text/csv" disabled={!isDesktop || busy === s} style={{ display: 'none' }}
                        onChange={(e) => onCronCsv(e.target.files?.[0])} />
                    </label>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
                      Fallback if auto-sync is blocked: Account → Export Data → “Daily Nutrition”.
                    </span>
                  </div>
                  {cronNote && <p className="mono" style={{ fontSize: 11, color: 'var(--text)', margin: 0 }}>{cronNote}</p>}
                </div>
              )}

              {s === 'apple_health' && (
                <div className="mono" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
                  <div>
                    <span style={{ color: 'var(--dim)' }}>POST endpoint:&nbsp;</span>
                    <span style={{ color: 'var(--text)' }}>{sync.healthEndpoint ?? 'http://<this-machine>:8787/ingest/health'}</span>
                  </div>
                  <div style={{ color: 'var(--dim)', marginTop: 4 }}>
                    This is your PC&apos;s LAN address — paste it into Health Auto Export&apos;s REST API URL. If it shows
                    127.0.0.1 the PC has no Wi-Fi/LAN IP; connect to a network and re-open this screen.
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* SB-Σ — local AI brain (Ollama) */}
        <div className="block" style={{ paddingBottom: 16 }}>
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            {dot(agent?.reachable ? 'connected' : 'disconnected')}SB-Σ — Local AI (Ollama)
            <span style={{ color: 'var(--dim)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
              {'  '}— {agent?.reachable ? `running · ${agent.models.length} model${agent.models.length === 1 ? '' : 's'}` : 'offline'}
            </span>
          </p>
          <p className="mono" style={{ fontSize: 11.5, color: 'var(--dim)', margin: '0 0 12px', lineHeight: 1.6 }}>
            Private — runs on this machine, nothing leaves it. Install from ollama.com, then <span style={{ color: 'var(--text)' }}>ollama pull llama3.1</span>.
          </p>
          {agent?.reachable && agent.models.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>Model</span>
              <select className="fld" value={agent.model} onChange={(e) => setAgentModel(e.target.value)}>
                {agent.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <button className="btn" onClick={() => refreshAgent()}>Re-check</button>
            </div>
          ) : (
            <button className="btn" disabled={!isDesktop} onClick={() => refreshAgent()}>Re-check</button>
          )}
        </div>
      </HubFrame>

      <style>{`
        .fld { background:#070708; border:1px solid var(--line); color:var(--text); font-family:var(--font-mono);
          font-size:12px; padding:8px 10px; min-width:180px; }
        .btnrow-inline { display:flex; gap:8px; flex-wrap:wrap; }
        .btn { background:transparent; border:1px solid var(--line); color:var(--text); padding:9px 14px;
          font-family:var(--font-cap); font-weight:600; font-size:10.5px; letter-spacing:.07em;
          text-transform:uppercase; cursor:pointer; }
        .btn:hover:not(:disabled) { background:var(--line-soft); }
        .btn:disabled { opacity:.45; cursor:default; }
      `}</style>
    </div>
  );
}
