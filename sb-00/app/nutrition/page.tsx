'use client';

import HubFrame from '@/components/HubFrame';
import Ascii from '@/components/Ascii';
import { Feed } from '@/components/Feed';
import { asciiBars } from '@/lib/ascii';
import { useSnapshot } from '../providers';

export default function Substrate() {
  const { insights, dailyTotals, calories7d, vitamins, minerals, weightGoal } = useSnapshot();
  const calorieRows = asciiBars(calories7d.map((c) => ({ label: c.day, value: c.kcal, display: `${c.kcal}kcal` })));
  const nutritionFeed = insights.filter((i) => i.nodes.includes('nutrition'));

  const weightRows = weightGoal.trend.length
    ? asciiBars(weightGoal.trend.map((w) => ({ label: w.day, value: w.kg, display: `${w.kg}kg` })), 20, weightGoal.target)
    : [];
  const toGo = weightGoal.current != null ? Math.round((weightGoal.current - weightGoal.target) * 10) / 10 : null;

  return (
    <div className="page">
      <HubFrame side={<Feed items={nutritionFeed} showTime />}>
        <div className="block">
          <p className="eyebrow" style={{ fontSize: 13 }}>SUBSTRATE // intake + mass</p>
          <p className="synced-note">Intake synced from <span className="flag">Cronometer</span>; bodyweight from Apple Health or logged by hand.</p>
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
          <p className="eyebrow">Calories, 7d</p>
          <Ascii rows={calorieRows} />
        </div>

        <div className="block">
          <p className="eyebrow">Micronutrients — vitamins</p>
          <table>
            <tbody>
              <tr><th>Nutrient</th><th>Amount</th><th>% RDA</th><th>Status</th></tr>
              {vitamins.map((v) => (
                <tr key={v.nutrient} className={v.flagged ? 'flagrow' : undefined}>
                  <td>{v.nutrient}</td><td>{v.amount}</td><td>{v.rda}</td>
                  <td>{v.flagged ? 'FLAGGED' : '—'}</td>
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
                  <td>{m.mineral}</td><td>{m.amount}</td><td>{m.target}</td>
                  <td>{m.flagged ? 'FLAGGED' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HubFrame>
    </div>
  );
}
