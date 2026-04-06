import React, { useState } from 'react';
import { Module } from '../../components/cockpit';
import { ENGINE_COUNT } from '../../sim/constants';
import { AIRCRAFT_LIMITS } from '../../sim/constants';

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

function TrendChart({ title, unit, values, min, max, colorClass }) {
  const width = 520;
  const height = 120;
  const points = buildLinePoints(values, min, max, width, height);
  const latest = values.length ? values[values.length - 1] : 0;

  return (
    <div className="telemetry-chart-card">
      <div className="telemetry-chart-head">
        <span>{title}</span>
        <strong>
          {latest.toFixed(0)} {unit}
        </strong>
      </div>
      <svg className={`telemetry-chart ${colorClass}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polyline points={points} />
      </svg>
      <div className="telemetry-chart-foot">
        <small>
          {min.toFixed(0)} {unit}
        </small>
        <small>
          {max.toFixed(0)} {unit}
        </small>
      </div>
    </div>
  );
}

export function TelemetryTab({ telemetryHistory = [], metrics }) {
  const [selectedEngineIdx, setSelectedEngineIdx] = useState(0);
  const speedSeries = telemetryHistory.map((p) => p.airspeedKt);
  const speedCapSeries = telemetryHistory.map((p) => p.throttleCapabilityKt);
  const fullCapSeries = telemetryHistory.map((p) => p.fullThrottleCapabilityKt);
  const thrustMarginSeries = telemetryHistory.map((p) => p.thrustMarginLbf);
  const altitudeSeries = telemetryHistory.map((p) => p.altitudeFt);
  const vsSeries = telemetryHistory.map((p) => p.verticalSpeedFpm);
  const totalFuelFlowSeries = telemetryHistory.map((p) => p.totalFuelFlow ?? 0);
  const fuelUsedSeries = telemetryHistory.map((p) => p.fuelUsedLb ?? 0);
  const selectedEgtSeries = telemetryHistory.map((p) => p.egt?.[selectedEngineIdx] ?? 0);
  const selectedRpmSeries = telemetryHistory.map((p) => p.rpm?.[selectedEngineIdx] ?? 0);
  const selectedFuelFlowSeries = telemetryHistory.map((p) => p.fuelFlowPerEngine?.[selectedEngineIdx] ?? 0);
  const fuelUsedMax = Math.max(1000, ...fuelUsedSeries, metrics.fuelUsedLb * 1.08);
  const totalFuelFlowMax = Math.max(16000, ...totalFuelFlowSeries, metrics.totalFuelFlow * 1.1);

  return (
    <div className="gauge-grid">
      <Module title="Telemetry - Performance Graphics" colorClass="blue">
        <TrendChart title="Airspeed" unit="kt" values={speedSeries} min={180} max={AIRCRAFT_LIMITS.maxSpeedKt} colorClass="teal" />
        <TrendChart
          title="Throttle Capability"
          unit="kt"
          values={speedCapSeries}
          min={180}
          max={AIRCRAFT_LIMITS.maxSpeedKt}
          colorClass="amber"
        />
        <TrendChart
          title="Full Throttle Capability"
          unit="kt"
          values={fullCapSeries}
          min={220}
          max={AIRCRAFT_LIMITS.maxSpeedKt}
          colorClass="ok"
        />
      </Module>

      <Module title="Telemetry - Thrust and Flight Profile" colorClass="orange">
        <TrendChart title="Thrust Margin" unit="lbf" values={thrustMarginSeries} min={-30000} max={60000} colorClass="warn" />
        <TrendChart title="Altitude" unit="ft" values={altitudeSeries} min={1000} max={AIRCRAFT_LIMITS.ceilingFt} colorClass="teal" />
        <TrendChart title="Vertical Speed" unit="fpm" values={vsSeries} min={-3000} max={3000} colorClass="danger" />
        <div className="summary-row">
          <span>Current Speed / Capability</span>
          <strong>
            {metrics.airspeedKt.toFixed(0)} / {metrics.telemetry.throttleCapabilityKt.toFixed(0)} kt
          </strong>
        </div>
        <div className="summary-row">
          <span>Current Thrust Margin</span>
          <strong className={metrics.telemetry.thrustMarginLbf < 0 ? 'warn-text' : ''}>{metrics.telemetry.thrustMarginLbf.toFixed(0)} lbf</strong>
        </div>
      </Module>

      <Module title="Telemetry - Fuel Consumption Session" colorClass="red">
        <TrendChart title="Total Fuel Flow" unit="lb/hr" values={totalFuelFlowSeries} min={0} max={totalFuelFlowMax} colorClass="warn" />
        <TrendChart title="Fuel Used (Session Total)" unit="lb" values={fuelUsedSeries} min={0} max={fuelUsedMax} colorClass="danger" />
        <div className="summary-row">
          <span>Current Flow / Fuel Used</span>
          <strong>
            {metrics.totalFuelFlow.toFixed(0)} lb/hr / {metrics.fuelUsedLb.toFixed(0)} lb
          </strong>
        </div>
      </Module>

      <Module title="Telemetry - Per Engine Session" colorClass="yellow">
        <div className="summary-row">
          <span>Engine Selector</span>
          <label className="telemetry-engine-select">
            <select value={selectedEngineIdx} onChange={(e) => setSelectedEngineIdx(Number(e.target.value))}>
              {Array.from({ length: ENGINE_COUNT }, (_, i) => (
                <option key={`telemetry-engine-${i}`} value={i}>
                  Engine {i + 1}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TrendChart title={`Engine ${selectedEngineIdx + 1} EGT`} unit="C" values={selectedEgtSeries} min={300} max={760} colorClass="danger" />
        <TrendChart title={`Engine ${selectedEngineIdx + 1} N2 RPM`} unit="rpm" values={selectedRpmSeries} min={6000} max={11500} colorClass="amber" />
        <TrendChart
          title={`Engine ${selectedEngineIdx + 1} Fuel Flow`}
          unit="lb/hr"
          values={selectedFuelFlowSeries}
          min={1000}
          max={5600}
          colorClass="teal"
        />
      </Module>
    </div>
  );
}
