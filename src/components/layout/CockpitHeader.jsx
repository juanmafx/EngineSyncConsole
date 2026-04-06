import React from 'react';
import { StatusPill, ToggleButton } from '../cockpit';

export function CockpitHeader({
  metrics,
  antiIce,
  bleedAir,
  audioEnabled,
  onToggleAudio,
  onAcknowledge,
  masterVolume,
  onMasterVolumeChange,
  alertVolume,
  onAlertVolumeChange,
}) {
  return (
    <header className="hero">
      <div className="hero-main">
        <p className="eyebrow">Engineer Station Simulator</p>
        <h1>Multi-Engine Console</h1>
        <p className="lead">
          Eight-engine command and monitoring layout with throttle symmetry, condition trending, fuel routing, and
          aircraft service statuses.
        </p>
      </div>
      <div className="hero-side">
        <div className="annunciator-strip">
          <StatusPill label={`CAUTIONS ${metrics.cautionCount}`} on={metrics.cautionCount > 0} tone="warn" />
          <StatusPill label="MASTER CAUTION" on={metrics.hasMasterCaution} tone="warn" />
          <StatusPill label="MASTER WARNING" on={metrics.hasMasterWarning} tone="danger" />
          <StatusPill label="ICE ALARM" on={metrics.iceAlarmActive} tone="warn" />
          <StatusPill label="ANTI-ICE" on={antiIce} />
          <StatusPill label="ICE DEFROST" on={antiIce} />
          <StatusPill label="BLEED AIR" on={bleedAir} />
        </div>
        <div className="audio-panel">
          <div className="audio-panel-header">Cockpit Audio</div>
          <div className="audio-row">
            <ToggleButton active={audioEnabled} onClick={onToggleAudio} label={audioEnabled ? 'Audio On' : 'Audio Off'} />
            <button className="toggle" onClick={onAcknowledge}>
              Acknowledge / Silence
            </button>
          </div>
          <label className="audio-control">
            Master Volume
            <input
              type="range"
              min={0}
              max={100}
              value={masterVolume}
              onChange={(e) => onMasterVolumeChange(Number(e.target.value))}
              className="slider"
            />
            <strong>{masterVolume}%</strong>
          </label>
          <label className="audio-control">
            Alert Volume
            <input
              type="range"
              min={0}
              max={100}
              value={alertVolume}
              onChange={(e) => onAlertVolumeChange(Number(e.target.value))}
              className="slider"
            />
            <strong>{alertVolume}%</strong>
          </label>
        </div>
      </div>
    </header>
  );
}
