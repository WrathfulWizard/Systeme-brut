'use client';

import { useState } from 'react';
import HubFrame from '@/components/HubFrame';
import Ascii from '@/components/Ascii';
import { Feed } from '@/components/Feed';
import { BodyMetricLogForm } from '@/components/LogForms';
import { asciiBars } from '@/lib/ascii';
import { useSb } from '../providers';

export default function Substrate() {
  const { snapshot, isDesktop, deleteBodyMetric } = useSb();
  const { insights, dailyTotals, calories7d, caloriesByWeek, vitamins, minerals, essentialFats, bodyComposition, weightGoal } = snapshot;
  const nutritionFeed = insights.filter((i) => i.nodes.includes('nutrition'));
  const [calWin, setCalWin] = useState<number>(0); // 0 = 7d daily; else weeks

  const calRows = calWin === 0
    ? asciiBars(calories7d.map((c) => ({ label: c.day, value: c.kcal, display: `${c.kcal}kcal` })))
    : asciiBars(caloriesByWeek.slice(-calWin).map((c) => ({ label: c.day, value: c.kcal, display: `${c.kcal}kcal` })));

  const weightRows = weightGoal.trend.length
    ? asciiBars(weightGoal.trend.map((w) => ({ label: w.day, value: w.kg, display: `${w.kg}kg` })), 20, weightGoal.target)
    : [];
  const toGo = weightGoal.current != null ? Math.round((weightGoal.current - weightGoal.target) * 10) / 10 : null;
  const latest = bodyComposition[0];

  const CAL_VIEWS: { label: string; weeks: number }[] = [
    { label: '7D', weeks: 0 }, { label: '4W', weeks: 4 }, { label: '8W', weeks: 8 }, { label: '12W', weeks: 12 },
  ];

  return (
    <div className="page">
      <HubFrame side={<Feed items={nutritionFeed} showTime />}>
        <div className="block">
          <p className="eyebrow" style={{ fontSize: 13 }}>SUBSTRATE // intake + mass</p>
          <p className="synced-note">Intake &amp; bodyweight synced from <span className="flag">Cronometer</span> (CSV import on Connections); body composition logged by hand.</p>
        </div>

        <div className="block">
          <p className="eyebrow">Mass — bodyweight</p>
          {weightGoal.current != null ? (
            <>
              <Ascii rows={weightRows} />
              <div className="goalline">
                CURRENT {weightGoal.current}{weightGoal.unit} · GOAL {weightGoal.target}{weightGoal.unit} ·{' '}
                {toGo != null && toGo > 0 ? `${toGo}${weightGoal.unit} TO GO` : toGo != null && toGo < 0 ? `${Math.abs(toGo)}${weightGoal.unit} UNDER` : 'AT GOAL'}
              </div>
            </>
          ) : <p className="synced-note">No bodyweight logged yet.</p>}
        </div>

        <div className="block">
          <BodyMetricLogForm />
          <p className="eyebrow">Body composition</p>
          {latest ? (
            <>
              <div className="bodycomp-now">
                {latest.bodyFatPct != null && <span><b>{latest.bodyFatPct}%</b> body fat</span>}
                {latest.waistCm != null && <span><b>{latest.waistCm}</b> waist</span>}
                {latest.chestCm != null && <span><b>{latest.chestCm}</b> chest</span>}
                {latest.armCm != null && <span><b>{latest.armCm}</b> arm</span>}
                {latest.thighCm != null && <span><b>{latest.thighCm}</b> thigh</span>}
              </div>
              <table>
                <tbody>
                  <tr><th>Date</th><th>BF%</th><th>Chest</th><th>Arm</th><th>Thigh</th><th>Waist</th>{isDesktop && <th />}</tr>
                  {bodyComposition.map((b) => (
                    <tr key={b.id}>
                      <td>{b.date}</td><td>{b.bodyFatPct ?? '—'}</td><td>{b.chestCm ?? '—'}</td>
                      <td>{b.armCm ?? '—'}</td><td>{b.thighCm ?? '—'}</td><td>{b.waistCm ?? '—'}</td>
                      {isDesktop && <td className="rowact"><button className="rowbtn del" onClick={() => deleteBodyMetric(b.id)}>del</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : <p className="synced-note">No measurements yet — log caliper body-fat % and tape measurements above.</p>}
        </div>

        <div className="block">
          <p className="eyebrow">Daily totals — today</p>
          <table>
            <tbody>
              <tr><th>Nutrient</th><th>Today</th><th>Target</th><th>Δ</th></tr>
              {dailyTotals.map((d) => (
                <tr key={d.nutrient}><td>{d.nutrient}</td><td>{d.today}</td><td>{d.target}</td><td>{d.delta}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block">
          <div className="logbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="eyebrow" style={{ margin: 0 }}>Calories — {calWin === 0 ? 'last 7 days' : `${calWin} weeks (avg/wk)`}</p>
            <div className="win-toggle">
              {CAL_VIEWS.map((v) => (
                <button key={v.label} className={`wbtn${calWin === v.weeks ? ' on' : ''}`} onClick={() => setCalWin(v.weeks)}>{v.label}</button>
              ))}
            </div>
          </div>
          <Ascii rows={calRows} />
        </div>

        <div className="block">
          <p className="eyebrow">Micronutrients — vitamins</p>
          <table>
            <tbody>
              <tr><th>Nutrient</th><th>Amount</th><th>% RDA</th><th>Status</th></tr>
              {vitamins.map((v) => (
                <tr key={v.nutrient} className={v.flagged ? 'flagrow' : undefined}>
                  <td>{v.nutrient}</td><td>{v.amount}</td><td>{v.rda}</td><td>{v.flagged ? 'FLAGGED' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block">
          <p className="eyebrow">Minerals &amp; electrolytes</p>
          <table>
            <tbody>
              <tr><th>Mineral</th><th>Amount</th><th>Target</th><th>Status</th></tr>
              {minerals.map((m) => (
                <tr key={m.mineral} className={m.flagged ? 'flagrow' : undefined}>
                  <td>{m.mineral}</td><td>{m.amount}</td><td>{m.target}</td><td>{m.flagged ? 'FLAGGED' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {essentialFats.length > 0 && (
          <div className="block">
            <p className="eyebrow">Essential fats — omega-3 / 6</p>
            <table>
              <tbody>
                <tr><th>Fat</th><th>Amount</th><th>Target</th><th>Status</th></tr>
                {essentialFats.map((f) => (
                  <tr key={f.mineral} className={f.flagged ? 'flagrow' : undefined}>
                    <td>{f.mineral}</td><td>{f.amount}</td><td>{f.target}</td><td>{f.flagged ? 'LOW' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HubFrame>

      <style>{`
        .bodycomp-now { display: flex; gap: 18px; flex-wrap: wrap; font-family: var(--font-mono);
          font-size: 12px; color: var(--dim); margin-bottom: 12px; }
        .bodycomp-now b { color: var(--text); font-size: 15px; }
      `}</style>
    </div>
  );
}
