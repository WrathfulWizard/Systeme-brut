'use client';

import { ReactNode } from 'react';
import Nav from './Nav';
import { useSnapshot } from '@/app/providers';

/** The corner coordinate marks shared by every frame. */
export function Corners({ w = 1280, h = 640 }: { w?: number; h?: number }) {
  return (
    <>
      <span className="crn tl"><span>0,0</span></span>
      <span className="crn tr"><span>{w},0</span></span>
      <span className="crn bl"><span>0,{h}</span></span>
      <span className="crn br"><span>{w},{h}</span></span>
    </>
  );
}

interface HubFrameProps {
  /** right-hand text in the id row, e.g. "SYNC OK · 3 NODES · 4 OPEN FLAGS" */
  status: ReactNode;
  /** right-hand text in the footer, e.g. "Last flag — ALT, 9 days ago" */
  foot?: ReactNode;
  /** the SB-Σ side rail; omit to drop the third column */
  side?: ReactNode;
  children: ReactNode;
}

/**
 * The SB-00 master-hub chrome: corner-marked frame, id row, nav + body +
 * optional side rail, and the session footer.
 */
export default function HubFrame({ status, foot, side, children }: HubFrameProps) {
  const { session } = useSnapshot();
  return (
    <div className="hub frame">
      <Corners />
      <div className="id-row">
        <b>SYSTEME BRUT // SB-00</b>
        <span>{status}</span>
      </div>
      <div className={`hub-body${side ? '' : ' no-side'}`}>
        <Nav />
        <div>{children}</div>
        {side && (
          <div className="side">
            <p className="eyebrow">SB-Σ — quick feed</p>
            {side}
          </div>
        )}
      </div>
      <div className="foot">
        <span>Session {session.clock}</span>
        {foot && <span>{foot}</span>}
      </div>
    </div>
  );
}
