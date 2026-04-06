import React from 'react';
import { DataRow, Module, StatusPill, ToggleButton } from '../../components/cockpit';

export function FlightCommandsTab({
  metrics,
  crossfeed,
  setCrossfeed,
  boost,
  setBoost,
  transfer,
  setTransfer,
  bleedAir,
  setBleedAir,
  antiIce,
  setAntiIce,
  faultEngine,
  faultEnabled,
  toggleWithClick,
}) {
  return (
    <div className="gauge-grid">
      <Module title="Module C - Fuel" colorClass="red">
        <DataRow
          label="Fuel Flow"
          values={metrics.fuelFlowPerEngine}
          unit="lb/hr"
          getTone={(v) => (v > 5000 ? 'danger' : v > 4600 ? 'warn' : '')}
        />
        <div className="summary-row">
          <span>Total Fuel Flow</span>
          <strong>{metrics.totalFuelFlow.toFixed(0)} lb/hr</strong>
        </div>
        <div className="tank-grid">
          <div className="tank-cell">FWD {metrics.tankQty.fwd.toFixed(0)} lb</div>
          <div className="tank-cell">AFT {metrics.tankQty.aft.toFixed(0)} lb</div>
          <div className="tank-cell">L WING {metrics.tankQty.leftWing.toFixed(0)} lb</div>
          <div className="tank-cell">R WING {metrics.tankQty.rightWing.toFixed(0)} lb</div>
        </div>
        <div className="switch-row">
          <ToggleButton active={crossfeed} onClick={() => toggleWithClick(setCrossfeed)} label="Crossfeed" />
          <ToggleButton active={boost} onClick={() => toggleWithClick(setBoost)} label="Boost" />
          <ToggleButton active={transfer} onClick={() => toggleWithClick(setTransfer)} label="Transfer" />
        </div>
      </Module>

      <Module title="Module D - Aircraft Services" colorClass="orange">
        <div className="summary-row">
          <span>Hydraulic Pressure</span>
          <strong className={metrics.hydraulicPressure < 2100 ? 'warn-text' : ''}>{metrics.hydraulicPressure.toFixed(0)} psi</strong>
        </div>
        <div className="summary-row">
          <span>Electrical Bus A / B</span>
          <strong className={metrics.busA < 25 || metrics.busB < 25 ? 'warn-text' : ''}>
            {metrics.busA.toFixed(1)}V / {metrics.busB.toFixed(1)}V
          </strong>
        </div>
        <div className="trend-grid">
          {metrics.generatorOnline.map((on, i) => (
            <StatusPill key={`gen-${i}`} label={`GEN ${i + 1}`} on={on} tone={on ? 'ok' : 'warn'} />
          ))}
        </div>
        <div className="switch-row">
          <ToggleButton active={bleedAir} onClick={() => toggleWithClick(setBleedAir)} label="Bleed Air" />
          <ToggleButton active={antiIce} onClick={() => toggleWithClick(setAntiIce)} label="Ice Defrost" />
        </div>
        <div className="annunciator-grid">
          <StatusPill label="LOW OIL PRESS" on={metrics.oilPressure.some((v) => v < 35)} tone="warn" />
          <StatusPill label="EGT HIGH" on={metrics.egt.some((v) => v > 700)} tone="danger" />
          <StatusPill label="FUEL IMBALANCE" on={metrics.tankImbalancePct > 2.2} tone="warn" />
          <StatusPill label="THR ASYM" on={metrics.symmetryDelta > 2.2} tone="warn" />
          <StatusPill label="ELEC BUS LOW" on={metrics.busA < 25 || metrics.busB < 25} tone="warn" />
          <StatusPill label="AIRFRAME ICE" on={metrics.iceAlarmActive} tone="warn" />
          <StatusPill label={`ENG ${faultEngine + 1} DEGRADED`} on={faultEnabled} tone="danger" />
        </div>
      </Module>
    </div>
  );
}
