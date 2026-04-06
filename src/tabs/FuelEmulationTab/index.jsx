import React from 'react';
import { clamp } from '../../sim/flightModel';
import { DataRow, Module, StatusPill, ToggleButton } from '../../components/cockpit';

export function FuelEmulationTab({ metrics, crossfeed, setCrossfeed, boost, setBoost, transfer, setTransfer, toggleWithClick, formatDuration }) {
  return (
    <div className="gauge-grid">
      <Module title="Fuel Emulation - Transfer Model" colorClass="red">
        <div className="summary-row">
          <span>Total Fuel Remaining</span>
          <strong>
            {metrics.totalFuelRemaining.toFixed(0)} lb ({metrics.fuelRemainingPct.toFixed(1)}%)
          </strong>
        </div>
        <div className="summary-row">
          <span>Total Capacity (Model)</span>
          <strong>{metrics.totalFuelCapacity.toFixed(0)} lb</strong>
        </div>
        <div className="summary-row">
          <span>Fuel Used Since Startup</span>
          <strong>{metrics.fuelUsedLb.toFixed(0)} lb</strong>
        </div>
        <div className="summary-row">
          <span>Trip Time / Distance</span>
          <strong>
            {formatDuration(metrics.tripHours)} / {metrics.tripDistanceNm.toFixed(1)} nm
          </strong>
        </div>
        <div className="summary-row">
          <span>Endurance / Predicted Range</span>
          <strong>
            {formatDuration(metrics.enduranceHours)} / {metrics.rangeNm.toFixed(0)} nm
          </strong>
        </div>
        <div className="tank-gauge-grid">
          <div className="tank-gauge">
            <div className="tank-gauge-head">FWD</div>
            <div className="tank-bar">
              <span style={{ width: `${clamp(metrics.tankPct.fwd, 0, 100)}%` }} />
            </div>
            <div className="tank-gauge-foot">{metrics.tankQty.fwd.toFixed(0)} lb</div>
          </div>
          <div className="tank-gauge">
            <div className="tank-gauge-head">AFT</div>
            <div className="tank-bar">
              <span style={{ width: `${clamp(metrics.tankPct.aft, 0, 100)}%` }} />
            </div>
            <div className="tank-gauge-foot">{metrics.tankQty.aft.toFixed(0)} lb</div>
          </div>
          <div className="tank-gauge">
            <div className="tank-gauge-head">LEFT WING</div>
            <div className="tank-bar">
              <span style={{ width: `${clamp(metrics.tankPct.leftWing, 0, 100)}%` }} />
            </div>
            <div className="tank-gauge-foot">{metrics.tankQty.leftWing.toFixed(0)} lb</div>
          </div>
          <div className="tank-gauge">
            <div className="tank-gauge-head">RIGHT WING</div>
            <div className="tank-bar">
              <span style={{ width: `${clamp(metrics.tankPct.rightWing, 0, 100)}%` }} />
            </div>
            <div className="tank-gauge-foot">{metrics.tankQty.rightWing.toFixed(0)} lb</div>
          </div>
        </div>
      </Module>

      <Module title="Fuel Emulation - Feed and Transfer" colorClass="orange">
        <DataRow
          label="Fuel Flow by Engine"
          values={metrics.fuelFlowPerEngine}
          unit="lb/hr"
          getTone={(v) => (v > 5000 ? 'danger' : v > 4600 ? 'warn' : '')}
        />
        <div className="summary-row">
          <span>Total Fuel Flow</span>
          <strong>{metrics.totalFuelFlow.toFixed(0)} lb/hr</strong>
        </div>
        <div className="summary-row">
          <span>Cruise Estimate</span>
          <strong>{metrics.cruiseKts.toFixed(0)} kt</strong>
        </div>
        <div className="summary-row">
          <span>Engine Thrust (Est)</span>
          <strong>
            {metrics.telemetry.thrustAvailableLbf.toFixed(0)} / {metrics.telemetry.thrustRequiredLbf.toFixed(0)} lbf
          </strong>
        </div>
        <div className="summary-row">
          <span>Thrust Margin</span>
          <strong className={metrics.telemetry.thrustMarginLbf < 0 ? 'warn-text' : ''}>
            {metrics.telemetry.thrustMarginLbf.toFixed(0)} lbf
          </strong>
        </div>
        <div className="summary-row">
          <span>Speed Capability (Now / Full)</span>
          <strong>
            {metrics.telemetry.throttleCapabilityKt.toFixed(0)} / {metrics.telemetry.fullThrottleCapabilityKt.toFixed(0)} kt
          </strong>
        </div>
        <div className="summary-row">
          <span>Airspeed vs Max Capability</span>
          <strong>{metrics.telemetry.speedUtilizationPct.toFixed(1)}%</strong>
        </div>
        <div className="annunciator-grid">
          <StatusPill label="CROSSFEED" on={crossfeed} tone="warn" />
          <StatusPill label="BOOST PUMP" on={boost} tone="ok" />
          <StatusPill label="TRANSFER" on={transfer} tone="ok" />
          <StatusPill label="FUEL IMBALANCE" on={metrics.symmetryDelta > 2.2} tone="warn" />
        </div>
        <div className="summary-row">
          <span>Left/Right Imbalance</span>
          <strong className={metrics.symmetryDelta > 2.2 ? 'warn-text' : ''}>{metrics.symmetryDelta.toFixed(2)}%</strong>
        </div>
        <div className="switch-row">
          <ToggleButton active={crossfeed} onClick={() => toggleWithClick(setCrossfeed)} label="Crossfeed" />
          <ToggleButton active={boost} onClick={() => toggleWithClick(setBoost)} label="Boost" />
          <ToggleButton active={transfer} onClick={() => toggleWithClick(setTransfer)} label="Transfer" />
        </div>
      </Module>
    </div>
  );
}
