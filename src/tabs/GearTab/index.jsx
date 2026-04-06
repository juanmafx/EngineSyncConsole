import React from 'react';
import { Module, StatusPill, ToggleButton } from '../../components/cockpit';

export function GearTab({ gearDown, setGearDown, gearTransit, gearUnsafe, gearLocked, metrics, antiIce, playUiClick }) {
  return (
    <div className="gauge-grid">
      <Module title="Gear - Landing System" colorClass="orange">
        <div className="switch-row">
          <ToggleButton
            active={gearDown}
            onClick={() => {
              playUiClick();
              setGearDown((value) => !value);
            }}
            label={gearDown ? 'Gear Lever Down' : 'Gear Lever Up'}
          />
        </div>
        <div className="summary-row">
          <span>Gear State</span>
          <strong className={gearUnsafe ? 'warn-text' : ''}>{gearTransit ? 'In Transit' : gearDown ? 'Down & Locked' : 'Up & Locked'}</strong>
        </div>
        <div className="annunciator-grid">
          <StatusPill label="NOSE LOCK" on={gearLocked.nose} tone="ok" />
          <StatusPill label="LEFT LOCK" on={gearLocked.left} tone="ok" />
          <StatusPill label="RIGHT LOCK" on={gearLocked.right} tone="ok" />
          <StatusPill label="GEAR UNSAFE" on={gearUnsafe} tone="danger" />
        </div>
        <div className="summary-row">
          <span>Flight Deck Callout</span>
          <strong>{gearDown ? 'Three Green' : 'Gear Up'}</strong>
        </div>
      </Module>

      <Module title="Gear - Advisory" colorClass="yellow">
        <div className="annunciator-grid">
          <StatusPill label="MASTER WARNING" on={metrics.hasMasterWarning} tone="danger" />
          <StatusPill label="MASTER CAUTION" on={metrics.hasMasterCaution} tone="warn" />
          <StatusPill label="ICE DEFROST" on={antiIce} tone="ok" />
          <StatusPill label="AIRFRAME ICE" on={metrics.iceAlarmActive} tone="warn" />
        </div>
        <div className="summary-row">
          <span>Hydraulic Pressure</span>
          <strong className={metrics.hydraulicPressure < 2100 ? 'warn-text' : ''}>{metrics.hydraulicPressure.toFixed(0)} psi</strong>
        </div>
      </Module>
    </div>
  );
}
