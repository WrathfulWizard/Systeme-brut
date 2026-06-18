'use client';

import { useState } from 'react';
import { useSb } from '@/app/providers';
import type { SetKind, SetRow, AdminRow } from '@/lib/types';

const today = () => new Date().toISOString().slice(0, 10);

function Toggle({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <div className="logbar">
      <button className="btn" onClick={onClick}>{open ? '× Close' : `＋ ${label}`}</button>
    </div>
  );
}

function DesktopNote() {
  return <p className="synced-note">Manual logging runs in the desktop app — launch SB-00 to add entries.</p>;
}

/* ---- Training: log / edit a set ----------------------------------------- */
export function LiftLogForm({ editing, onDone }: { editing?: SetRow | null; onDone?: () => void }) {
  const { snapshot, addSet, updateSet, isDesktop } = useSb();
  const isEdit = !!editing;
  const [open, setOpen] = useState(isEdit);
  const [date, setDate] = useState(editing?.iso ?? today());
  const [exercise, setExercise] = useState(editing?.exercise ?? '');
  const [setKind, setSetKind] = useState<SetKind>(editing?.setKind ?? 'straight');
  const [weight, setWeight] = useState(editing ? String(editing.weightKg) : '');
  const [reps, setReps] = useState(editing ? String(editing.repsN) : '');
  const [busy, setBusy] = useState(false);

  if (!isDesktop) return <DesktopNote />;
  const valid = !!exercise.trim() && Number(weight) > 0 && Number(reps) > 0;
  const submit = async () => {
    setBusy(true);
    try {
      const input = { date, exercise: exercise.trim(), setKind, weightKg: Number(weight), reps: Number(reps) };
      if (isEdit && editing) await updateSet(editing.id, input);
      else { await addSet(input); setExercise(''); setWeight(''); setReps(''); setOpen(false); }
      onDone?.();
    } finally { setBusy(false); }
  };

  const body = (
    <div className="logform">
      <div className="field"><label>Date</label>
        <input className="fld" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label>Exercise</label>
        <input className="fld" list="exercise-list" placeholder="Squat" value={exercise} onChange={(e) => setExercise(e.target.value)} />
        <datalist id="exercise-list">{snapshot.catalog.exercises.map((x) => <option key={x} value={x} />)}</datalist>
      </div>
      <div className="field"><label>Set</label>
        <select className="fld" value={setKind} onChange={(e) => setSetKind(e.target.value as SetKind)}>
          <option value="straight">Straight</option><option value="rp1">RP1</option><option value="rp_burst">RP burst</option>
        </select></div>
      <div className="field"><label>Weight (kg)</label>
        <input className="fld w-narrow" type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
      <div className="field"><label>Reps</label>
        <input className="fld w-narrow" type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></div>
      <button className="btn primary" disabled={!valid || busy} onClick={submit}>{busy ? 'Saving…' : isEdit ? 'Save' : 'Add set'}</button>
      {isEdit && <button className="btn" disabled={busy} onClick={onDone}>Cancel</button>}
    </div>
  );

  if (isEdit) return <><p className="editing-banner">Editing set</p>{body}</>;
  return <><Toggle open={open} onClick={() => setOpen((v) => !v)} label="Log set" />{open && body}</>;
}

/* ---- Pharmacology: administration (log / edit) -------------------------- */
export function AdminLogForm({ editing, onDone }: { editing?: AdminRow | null; onDone?: () => void }) {
  const { snapshot, addAdministration, updateAdministration, isDesktop } = useSb();
  const isEdit = !!editing;
  const [open, setOpen] = useState(isEdit);
  const [date, setDate] = useState(editing?.iso ?? today());
  const [compound, setCompound] = useState(editing?.compound ?? '');
  const [dose, setDose] = useState(editing ? String(editing.doseMg) : '');
  const [route, setRoute] = useState(editing?.routeRaw ?? 'IM');
  const [busy, setBusy] = useState(false);

  if (!isDesktop) return <DesktopNote />;
  const valid = !!compound.trim() && Number(dose) > 0;
  const submit = async () => {
    setBusy(true);
    try {
      const input = { compound: compound.trim(), doseMg: Number(dose), route, administeredAt: `${date}T08:00:00` };
      if (isEdit && editing) await updateAdministration(editing.id, input);
      else { await addAdministration(input); setDose(''); setOpen(false); }
      onDone?.();
    } finally { setBusy(false); }
  };

  const body = (
    <div className="logform">
      <div className="field"><label>Date</label>
        <input className="fld" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label>Compound</label>
        <input className="fld" list="compound-list" placeholder="Testosterone Cyp" value={compound} onChange={(e) => setCompound(e.target.value)} />
        <datalist id="compound-list">{snapshot.catalog.compounds.map((x) => <option key={x} value={x} />)}</datalist>
      </div>
      <div className="field"><label>Dose (mg)</label>
        <input className="fld w-narrow" type="number" inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} /></div>
      <div className="field"><label>Route</label>
        <select className="fld" value={route} onChange={(e) => setRoute(e.target.value)}>
          <option>IM</option><option>SubQ</option><option value="oral">Oral</option></select></div>
      <button className="btn primary" disabled={!valid || busy} onClick={submit}>{busy ? 'Saving…' : isEdit ? 'Save' : 'Add dose'}</button>
      {isEdit && <button className="btn" disabled={busy} onClick={onDone}>Cancel</button>}
    </div>
  );

  if (isEdit) return <><p className="editing-banner">Editing dose</p>{body}</>;
  return <><Toggle open={open} onClick={() => setOpen((v) => !v)} label="Log dose" />{open && body}</>;
}

/* ---- Pharmacology: start a continuous protocol -------------------------- */
export function ProtocolAddForm() {
  const { snapshot, addProtocol, isDesktop } = useSb();
  const [open, setOpen] = useState(false);
  const [compound, setCompound] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('IM');
  const [started, setStarted] = useState(today());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isDesktop) return <DesktopNote />;
  const valid = !!compound.trim() && Number(dose) > 0;
  const submit = async () => {
    setBusy(true);
    try {
      await addProtocol({ compound: compound.trim(), doseMg: Number(dose), route, note: note.trim() || undefined, startedAt: started });
      setCompound(''); setDose(''); setNote(''); setStarted(today()); setOpen(false);
    } finally { setBusy(false); }
  };

  return (
    <>
      <Toggle open={open} onClick={() => setOpen((v) => !v)} label="Add compound" />
      {open && (
        <div className="logform">
          <div className="field"><label>Compound</label>
            <input className="fld" list="compound-list" placeholder="Deca" value={compound} onChange={(e) => setCompound(e.target.value)} />
            <datalist id="compound-list">{snapshot.catalog.compounds.map((x) => <option key={x} value={x} />)}</datalist>
          </div>
          <div className="field"><label>Daily dose (mg)</label>
            <input className="fld w-narrow" type="number" inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} /></div>
          <div className="field"><label>Route</label>
            <select className="fld" value={route} onChange={(e) => setRoute(e.target.value)}>
              <option>IM</option><option>SubQ</option><option value="oral">Oral</option></select></div>
          <div className="field"><label>Started</label>
            <input className="fld" type="date" max={today()} value={started} onChange={(e) => setStarted(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>Note</label>
            <input className="fld" style={{ width: '100%' }} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button className="btn primary" disabled={!valid || busy} onClick={submit}>{busy ? 'Saving…' : 'Start protocol'}</button>
        </div>
      )}
    </>
  );
}

/* ---- Pharmacology: in-line titrate (change a running protocol's dose) ---- */
export function TitrateForm({ id, current, compound, onDone }: { id: number; current: number; compound: string; onDone: () => void }) {
  const { titrateProtocol } = useSb();
  const [dose, setDose] = useState(String(current));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = Number(dose) > 0 && Number(dose) !== current;
  return (
    <div className="logform" style={{ marginTop: 8 }}>
      <p className="editing-banner" style={{ width: '100%' }}>Titrate {compound} — {current}mg → ?</p>
      <div className="field"><label>New daily dose (mg)</label>
        <input className="fld w-narrow" type="number" inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} autoFocus /></div>
      <div className="field" style={{ flex: 1 }}><label>Note (trigger)</label>
        <input className="fld" style={{ width: '100%' }} placeholder="e.g. trough low, labs clean" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <button className="btn primary" disabled={!valid || busy}
        onClick={async () => { setBusy(true); try { await titrateProtocol(id, Number(dose), note.trim() || undefined); onDone(); } finally { setBusy(false); } }}>
        {busy ? 'Saving…' : 'Apply titration'}
      </button>
      <button className="btn" disabled={busy} onClick={onDone}>Cancel</button>
    </div>
  );
}

/* ---- Pharmacology: titration change ------------------------------------- */
export function TitrationLogForm() {
  const { snapshot, addTitration, isDesktop } = useSb();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [compound, setCompound] = useState('');
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isDesktop) return <DesktopNote />;
  const valid = !!compound.trim() && Number(after) > 0;
  const submit = async () => {
    setBusy(true);
    try {
      await addTitration({ compound: compound.trim(), before: before ? Number(before) : undefined, after: Number(after), notes: notes.trim() || undefined, changedAt: date });
      setBefore(''); setAfter(''); setNotes(''); setOpen(false);
    } finally { setBusy(false); }
  };

  return (
    <>
      <Toggle open={open} onClick={() => setOpen((v) => !v)} label="Log titration" />
      {open && (
        <div className="logform">
          <div className="field"><label>Date</label>
            <input className="fld" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>Compound</label>
            <input className="fld" list="compound-list" value={compound} onChange={(e) => setCompound(e.target.value)} />
            <datalist id="compound-list">{snapshot.catalog.compounds.map((x) => <option key={x} value={x} />)}</datalist>
          </div>
          <div className="field"><label>From (mg)</label>
            <input className="fld w-narrow" type="number" value={before} onChange={(e) => setBefore(e.target.value)} /></div>
          <div className="field"><label>To (mg)</label>
            <input className="fld w-narrow" type="number" value={after} onChange={(e) => setAfter(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>Trigger / note</label>
            <input className="fld" style={{ width: '100%' }} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <button className="btn primary" disabled={!valid || busy} onClick={submit}>{busy ? 'Saving…' : 'Add change'}</button>
        </div>
      )}
    </>
  );
}

/* ---- Pharmacology: lab panel (multiple results) ------------------------- */
type Row = { marker: string; value: string; unit: string; low: string; high: string };
const emptyRow = (): Row => ({ marker: '', value: '', unit: '', low: '', high: '' });

export function LabPanelLogForm() {
  const { addLabPanel, isDesktop } = useSb();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [labName, setLabName] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);

  if (!isDesktop) return <DesktopNote />;
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const valid = rows.some((r) => r.marker.trim() && r.value !== '' && !Number.isNaN(Number(r.value)));
  const submit = async () => {
    setBusy(true);
    try {
      await addLabPanel({
        drawnAt: date, labName: labName.trim() || undefined,
        results: rows.filter((r) => r.marker.trim() && r.value !== '').map((r) => ({
          marker: r.marker.trim(), value: Number(r.value), unit: r.unit.trim() || undefined,
          low: r.low ? Number(r.low) : undefined, high: r.high ? Number(r.high) : undefined,
        })),
      });
      setRows([emptyRow()]); setLabName(''); setOpen(false);
    } finally { setBusy(false); }
  };

  return (
    <>
      <Toggle open={open} onClick={() => setOpen((v) => !v)} label="Log lab panel" />
      {open && (
        <div className="logform" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field"><label>Drawn</label>
              <input className="fld" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label>Lab</label>
              <input className="fld" style={{ width: '100%' }} placeholder="Quest" value={labName} onChange={(e) => setLabName(e.target.value)} /></div>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="field"><label>Marker</label>
                <input className="fld" placeholder="ALT" value={r.marker} onChange={(e) => setRow(i, { marker: e.target.value })} /></div>
              <div className="field"><label>Value</label>
                <input className="fld w-narrow" type="number" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} /></div>
              <div className="field"><label>Unit</label>
                <input className="fld w-narrow" placeholder="U/L" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} /></div>
              <div className="field"><label>Low</label>
                <input className="fld w-narrow" type="number" value={r.low} onChange={(e) => setRow(i, { low: e.target.value })} /></div>
              <div className="field"><label>High</label>
                <input className="fld w-narrow" type="number" value={r.high} onChange={(e) => setRow(i, { high: e.target.value })} /></div>
            </div>
          ))}
          <div className="btnrow-inline">
            <button className="btn" onClick={() => setRows((rs) => [...rs, emptyRow()])}>＋ Marker</button>
            <button className="btn primary" disabled={!valid || busy} onClick={submit}>{busy ? 'Saving…' : 'Save panel'}</button>
          </div>
        </div>
      )}
    </>
  );
}
