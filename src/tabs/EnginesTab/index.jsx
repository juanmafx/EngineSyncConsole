import React from 'react';
import { ENGINE_COUNT } from '../../sim/constants';
import { DataRow, Module, ToggleButton } from '../../components/cockpit';

export function EnginesTab({
  throttles,
  setThrottleAt,
  targetEpr,
  setTargetEpr,
  metrics,
  faultEngine,
  setFaultEngine,
  faultEnabled,
  setFaultEnabled,
  toggleWithClick,
}) {
  return (
    <div className="gauge-grid">
      <Module title="Module A - Thrust / Engine Command" colorClass="yellow">
        <div className="throttle-grid">
          {throttles.map((value, i) => (
            <label key={`thr-${i}`} className="lever">
              <span>E{i + 1}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) => setThrottleAt(i, Number(e.target.value))}
                className="slider yellow"
              />
              <strong>{value}%</strong>
            </label>
          ))}
        </div>
        <div className="inline-control">
          <label>
            EPR Target / Demand
            <input
              type="range"
              min={1.2}
              max={2.2}
              step={0.01}
              value={targetEpr}
              onChange={(e) => setTargetEpr(Number(e.target.value))}
              className="slider"
            />
          </label>
          <strong>{targetEpr.toFixed(2)} EPR</strong>
        </div>
        <DataRow
          label="EPR Actual"
          values={metrics.epr}
          unit="epr"
          precision={2}
          getTone={(v) => (v > 2.24 ? 'danger' : v > 2.16 ? 'warn' : '')}
        />
        <DataRow
          label="N1"
          values={metrics.n1Pct}
          unit="%"
          precision={1}
          getTone={(v) => (v > 99 ? 'danger' : v > 95 ? 'warn' : '')}
        />
        <DataRow
          label="N2"
          values={metrics.n2Pct}
          unit="%"
          precision={1}
          getTone={(v) => (v > 99 ? 'danger' : v > 95 ? 'warn' : '')}
        />
        <DataRow
          label="N2 RPM"
          values={metrics.n2Rpm}
          unit="rpm"
          getTone={(v) => (v > 11150 ? 'danger' : v > 10800 ? 'warn' : '')}
        />
        <div className="symmetry-wrap">
          <span>Throttle Symmetry Delta</span>
          <strong className={metrics.symmetryDelta > 2.2 ? 'danger-text' : metrics.symmetryDelta > 1.4 ? 'warn-text' : ''}>
            {metrics.symmetryDelta.toFixed(2)}%
          </strong>
        </div>
        <div className="fault-row">
          <label>
            Fault Engine
            <select value={faultEngine} onChange={(e) => setFaultEngine(Number(e.target.value))}>
              {Array.from({ length: ENGINE_COUNT }, (_, i) => (
                <option key={`fault-option-${i}`} value={i}>
                  Engine {i + 1}
                </option>
              ))}
            </select>
          </label>
          <ToggleButton
            active={faultEnabled}
            onClick={() => toggleWithClick(setFaultEnabled)}
            label={faultEnabled ? 'Fault Active' : 'Inject Fault'}
          />
        </div>
      </Module>

      <Module title="Module B - Engine Condition" colorClass="blue">
        <DataRow label="EGT" values={metrics.egt} unit="C" getTone={(v) => (v > 760 ? 'danger' : v > 700 ? 'warn' : '')} />
        <DataRow
          label="Oil Pressure"
          values={metrics.oilPressure}
          unit="psi"
          precision={1}
          getTone={(v) => (v < 30 ? 'danger' : v < 35 ? 'warn' : '')}
        />
        <DataRow
          label="Oil Temp"
          values={metrics.oilTemp}
          unit="C"
          precision={1}
          getTone={(v) => (v > 130 ? 'danger' : v > 122 ? 'warn' : '')}
        />
        <div className="trend-grid">
          {metrics.trend.map((t, i) => {
            const isAbnormal = Math.abs(t) > 7;
            const dir = t >= 0 ? 'Rising' : 'Falling';
            return (
              <div key={`trend-${i}`} className={`trend-chip ${isAbnormal ? 'abnormal' : ''}`}>
                E{i + 1} {dir} {Math.abs(t).toFixed(1)} C/s
              </div>
            );
          })}
        </div>
      </Module>
    </div>
  );
}
