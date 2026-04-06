import React from 'react';
import { clamp } from '../../sim/flightModel';
import { DataRow, Module, StatusPill, ToggleButton } from '../../components/cockpit';

function buildLinePoints(values, minY, maxY, width, height) {
  if (!values.length) {
    return '';
  }

  const span = Math.max(1, maxY - minY);
  return values
    .map((value, i) => {
      const x = (i / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - minY) / span) * height;
      return `${x.toFixed(1)},${Math.max(0, Math.min(height, y)).toFixed(1)}`;
    })
    .join(' ');
}

function FuelCorrelationChart({ fuelFlowValues, enginesAtMaxValues }) {
  const width = 520;
  const height = 120;
  const flowMax = Math.max(12000, ...fuelFlowValues, 1);
  const flowMin = Math.max(0, Math.min(...fuelFlowValues, flowMax));
  const points = buildLinePoints(fuelFlowValues, flowMin, flowMax, width, height);
  const peakFullPower = Math.max(0, ...enginesAtMaxValues);
  const markerWidth = Math.max(1, width / Math.max(1, enginesAtMaxValues.length) - 1);

  return (
    <div className="telemetry-chart-card">
      <div className="telemetry-chart-head">
        <span>Fuel Consumption vs Engines at 100%</span>
        <strong>{fuelFlowValues.length ? fuelFlowValues[fuelFlowValues.length - 1].toFixed(0) : 0} lb/hr</strong>
      </div>
      <svg className="telemetry-chart fuel-correlation-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {enginesAtMaxValues.map((count, i) => {
          if (count <= 0) {
            return null;
          }
          const x = (i / Math.max(1, enginesAtMaxValues.length - 1)) * width;
          const opacity = 0.1 + (count / 8) * 0.4;
          return (
            <rect
              key={`max-power-${i}`}
              x={Math.max(0, x - markerWidth / 2)}
              y={0}
              width={markerWidth}
              height={height}
              fill={`rgba(228, 190, 92, ${opacity.toFixed(3)})`}
            />
          );
        })}
        <polyline points={points} />
      </svg>
      <div className="telemetry-chart-foot">
        <small>{flowMin.toFixed(0)} lb/hr</small>
        <small>Peak 100% Engines: {peakFullPower}</small>
        <small>{flowMax.toFixed(0)} lb/hr</small>
      </div>
    </div>
  );
}

function CapabilityTrendChart({ title, unit, values, min, max, colorClass = 'teal' }) {
  const width = 520;
  const height = 120;
  const points = buildLinePoints(values, min, max, width, height);
  const latest = values.length ? values[values.length - 1] : 0;

  return (
    <div className="telemetry-chart-card">
      <div className="telemetry-chart-head">
        <span>{title}</span>
        <strong>
          {latest.toFixed(1)} {unit}
        </strong>
      </div>
      <svg className={`telemetry-chart ${colorClass}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polyline points={points} />
      </svg>
      <div className="telemetry-chart-foot">
        <small>
          {min.toFixed(1)} {unit}
        </small>
        <small>
          {max.toFixed(1)} {unit}
        </small>
      </div>
    </div>
  );
}

export function FuelEmulationTab({
  metrics,
  telemetryHistory = [],
  crossfeed,
  setCrossfeed,
  boost,
  setBoost,
  transfer,
  setTransfer,
  toggleWithClick,
  formatDuration,
}) {
  const flowSeries = telemetryHistory.map((p) => p.totalFuelFlow ?? 0);
  const enginesAtMaxSeries = telemetryHistory.map((p) => p.enginesAtMaxCount ?? 0);
  const avgThrottleSeries = telemetryHistory.map((p) => p.avgThrottlePct ?? 0);
  const enduranceSeries = telemetryHistory.map((p) => p.enduranceHours ?? 0);
  const rangeSeries = telemetryHistory.map((p) => p.rangeNm ?? 0);
  const recentAvgThrottle =
    avgThrottleSeries.length > 0 ? avgThrottleSeries.slice(Math.max(0, avgThrottleSeries.length - 20)) : [];
  const avgThrottleWindow =
    recentAvgThrottle.length > 0
      ? recentAvgThrottle.reduce((sum, value) => sum + value, 0) / recentAvgThrottle.length
      : 0;
  const enduranceMax = Math.max(1, ...enduranceSeries, metrics.enduranceHours * 1.05);
  const rangeMax = Math.max(100, ...rangeSeries, metrics.rangeNm * 1.05);

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
          <StatusPill label="FUEL IMBALANCE" on={metrics.tankImbalancePct > 2.2} tone="warn" />
          <StatusPill label="THR ASYM" on={metrics.symmetryDelta > 2.2} tone="warn" />
        </div>
        <div className="summary-row">
          <span>Tank Imbalance (L/R Wing)</span>
          <strong className={metrics.tankImbalancePct > 2.2 ? 'warn-text' : ''}>
            {metrics.tankImbalanceLb.toFixed(0)} lb ({metrics.tankImbalancePct.toFixed(2)}%)
          </strong>
        </div>
        <div className="summary-row">
          <span>Throttle Asymmetry (L/R)</span>
          <strong className={metrics.symmetryDelta > 2.2 ? 'warn-text' : ''}>{metrics.symmetryDelta.toFixed(2)}%</strong>
        </div>
        <div className="switch-row">
          <ToggleButton active={crossfeed} onClick={() => toggleWithClick(setCrossfeed)} label="Crossfeed" />
          <ToggleButton active={boost} onClick={() => toggleWithClick(setBoost)} label="Boost" />
          <ToggleButton active={transfer} onClick={() => toggleWithClick(setTransfer)} label="Transfer" />
        </div>
      </Module>

      <Module title="Fuel Emulation - Session Consumption Graph" colorClass="blue">
        <FuelCorrelationChart fuelFlowValues={flowSeries} enginesAtMaxValues={enginesAtMaxSeries} />
        <CapabilityTrendChart
          title="Endurance Left (Current Burn Rate)"
          unit="hr"
          values={enduranceSeries}
          min={0}
          max={enduranceMax}
          colorClass="ok"
        />
        <CapabilityTrendChart
          title="Distance Capability"
          unit="nm"
          values={rangeSeries}
          min={0}
          max={rangeMax}
          colorClass="amber"
        />
        <div className="summary-row">
          <span>Current Engines at 100%</span>
          <strong>{enginesAtMaxSeries.length ? enginesAtMaxSeries[enginesAtMaxSeries.length - 1] : 0} / 8</strong>
        </div>
        <div className="summary-row">
          <span>Recent Avg Throttle (Window)</span>
          <strong>{avgThrottleWindow.toFixed(1)}%</strong>
        </div>
        <div className="summary-row">
          <span>Current Endurance / Capability</span>
          <strong>
            {metrics.enduranceHours.toFixed(2)} hr / {metrics.rangeNm.toFixed(0)} nm
          </strong>
        </div>
      </Module>
    </div>
  );
}
