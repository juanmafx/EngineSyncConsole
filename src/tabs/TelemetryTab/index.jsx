import React from 'react';
import { Module } from '../../components/cockpit';
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
  const speedSeries = telemetryHistory.map((p) => p.airspeedKt);
  const speedCapSeries = telemetryHistory.map((p) => p.throttleCapabilityKt);
  const fullCapSeries = telemetryHistory.map((p) => p.fullThrottleCapabilityKt);
  const thrustMarginSeries = telemetryHistory.map((p) => p.thrustMarginLbf);
  const altitudeSeries = telemetryHistory.map((p) => p.altitudeFt);
  const vsSeries = telemetryHistory.map((p) => p.verticalSpeedFpm);

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
    </div>
  );
}

