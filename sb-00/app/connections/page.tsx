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
  cronometer: 'Most reliable: enable Apple Health sync in Cronometer (Gold) — diet then rides the Apple Health push below, no login, fully automatic. Browser sign-in and CSV import are alternates.',
  apple_health: 'Push only — point the Health Auto Export app (or a Shortcut) at the endpoint below. Phone and PC must be on the same Wi-Fi.',
};

function dot(status: ConnectionState['status']) {
  const color = status === 'connected' ? '#3ad07a' : status === 'error' ? 'var(--mag)' : 'var(--dim)';
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 7, background: color, marginRight: 8 }} />;
}

export default function Connections() {
  const { sync, isDesktop, connectStrava, connectCronometerBrowser, importCronometerCsv, disconnect, syncNow, startHealthTunnel, stopHealthTunnel, saveStravaApp, agent, refreshAgent, setAgentModel } = useSb();
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
                  {/* Recommended path: no scraping, no credentials, never breaks on a Cronometer redeploy. */}
                  <p className="mono" style={{ fontSize: 11, color: 'var(--dim)', margin: 0, borderLeft: '2px solid var(--line)', paddingLeft: 10 }}>
                    <span style={{ color: 'var(--text)' }}>Recommended ·</span> in the Cronometer app: Settings → Apple Health → enable.
                    Cronometer writes your calories, macros, vitamins, minerals and weight into Apple Health, and the
                    Apple Health push above carries them here automatically — no login, nothing to break.
                  </p>
                  {/* Alternate: sign in once in a real browser window → session persists, pulls hourly. */}
                  {c.status === 'connected'
                    ? <div className="btnrow-inline">
                        <span className="mono" style={{ fontSize: 11, color: 'var(--dim)', alignSelf: 'center' }}>Signed in · auto-syncs hourly.</span>
                        <button className="btn" disabled={busy === s} onClick={wrap(s, () => syncNow('cronometer'))}>Sync now</button>
                        <button className="btn" disabled={busy === s} onClick={wrap(s, () => disconnect('cronometer'))}>Disconnect</button>
                      </div>
                    : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input className="fld" placeholder="email (optional — for auto re-link)" value={cronUser} onChange={(e) => setCronUser(e.target.value)} />
                        <input className="fld" placeholder="password (optional)" type="password" value={cronPass} onChange={(e) => setCronPass(e.target.value)} />
                        <button className="btn" disabled={!isDesktop || busy === s}
                          onClick={wrap(s, async () => { await connectCronometerBrowser(cronUser || undefined, cronPass || undefined); setCronPass(''); })}>
                          {busy === s ? 'Opening sign-in…' : 'Sign in to Cronometer'}
                        </button>
                      </div>}
                  {c.status !== 'connected' && (
                    <p className="mono" style={{ fontSize: 11, color: 'var(--dim)', margin: 0 }}>
                      A Cronometer window opens — sign in once. The session is remembered, so you won&apos;t sign in again unless it expires.
                      Saving email/password lets it re-link itself silently.
                    </p>
                  )}
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
                      No-login fallback: Account → Export Data → “Daily Nutrition”.
                    </span>
                  </div>
                  {cronNote && <p className="mono" style={{ fontSize: 11, color: 'var(--text)', margin: 0 }}>{cronNote}</p>}
                </div>
              )}

              {s === 'apple_health' && (
                <div className="mono" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
                  {(sync.healthCandidates?.length ? sync.healthCandidates : sync.healthEndpoint ? [sync.healthEndpoint] : []).length ? (
                    <>
                      <div style={{ color: 'var(--dim)', marginBottom: 4 }}>POST endpoint — paste into Health Auto Export&apos;s REST API URL (token included, no header needed):</div>
                      {(sync.healthCandidates?.length ? sync.healthCandidates : [sync.healthEndpoint!]).map((url) => {
                        const full = sync.healthToken ? `${url}?token=${sync.healthToken}` : url;
                        return (
                          <div key={url} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                            <span style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{full}</span>
                            <button className="btn" style={{ padding: '3px 8px', fontSize: 9 }}
                              onClick={() => navigator.clipboard?.writeText(full)}>copy</button>
                          </div>
                        );
                      })}
                      <div style={{ color: 'var(--dim)', marginTop: 6 }}>
                        At home: use a LAN address above (phone + PC on the same network, usually 192.168.x).
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--dim)' }}>
                      No LAN address — at home, connect this PC to Wi-Fi/Ethernet. Or use the internet tunnel below.
                    </div>
                  )}

                  {/* Header alternative — the ?token= URL above is the reliable path. */}
                  {sync.healthToken && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                      <span style={{ color: 'var(--dim)' }}>Or header:</span>
                      <span style={{ color: 'var(--text)' }}>Authorization: Bearer {sync.healthToken}</span>
                      <button className="btn" style={{ padding: '3px 8px', fontSize: 9 }}
                        onClick={() => navigator.clipboard?.writeText(`Bearer ${sync.healthToken}`)}>copy</button>
                    </div>
                  )}
                  <div style={{ color: 'var(--dim)', marginTop: 2 }}>
                    Use the <span style={{ color: 'var(--text)' }}>?token=</span> URL <em>or</em> this header — not both. A 401 means neither reached the server.
                  </div>

                  {/* Internet tunnel — sync over cellular when away from home. */}
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
                    <div style={{ color: 'var(--text)', marginBottom: 6 }}>Internet sync (away from home)</div>
                    {sync.healthTunnel?.running && sync.healthTunnel.url ? (
                      <>
                        {(() => {
                          const turl = `${sync.healthTunnel.url}/ingest/health${sync.healthToken ? `?token=${sync.healthToken}` : ''}`;
                          return (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{turl}</span>
                              <button className="btn" style={{ padding: '3px 8px', fontSize: 9 }}
                                onClick={() => navigator.clipboard?.writeText(turl)}>copy</button>
                            </div>
                          );
                        })()}
                        <div style={{ color: 'var(--dim)', marginTop: 4 }}>
                          Use this URL on the phone to sync over cellular. It changes if the app restarts — re-copy then.
                        </div>
                        <button className="btn" style={{ marginTop: 8 }} disabled={!isDesktop} onClick={() => stopHealthTunnel()}>Disable internet sync</button>
                      </>
                    ) : sync.healthTunnel?.running ? (
                      <div style={{ color: 'var(--dim)' }}>Starting tunnel…</div>
                    ) : (
                      <>
                        <button className="btn" disabled={!isDesktop} onClick={() => startHealthTunnel()}>Enable internet sync</button>
                        {sync.healthTunnel?.installed === false ? (
                          <div style={{ color: 'var(--mag)', marginTop: 6 }}>
                            Needs the free <span style={{ color: 'var(--text)' }}>cloudflared</span> tool. Install it once
                            (<span style={{ color: 'var(--text)' }}>winget install Cloudflare.cloudflared</span>), then enable again.
                          </div>
                        ) : sync.healthTunnel?.error ? (
                          <div style={{ color: 'var(--mag)', marginTop: 6 }}>{sync.healthTunnel.error}</div>
                        ) : (
                          <div style={{ color: 'var(--dim)', marginTop: 6 }}>
                            Opens a secure Cloudflare tunnel to this PC (no router setup). Requires the free cloudflared tool
                            and the PC left on while away.
                          </div>
                        )}
                      </>
                    )}
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
