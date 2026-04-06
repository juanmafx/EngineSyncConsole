import React, { useState } from 'react';
import { StatusPill, ToggleButton } from '../cockpit';

export function CockpitHeader({
  metrics,
  activeAlerts,
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
  const [alertsPinned, setAlertsPinned] = useState(false);
  const [alertsHover, setAlertsHover] = useState(false);
  const alertsOpen = alertsPinned || alertsHover;

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
        <div
          className="annunciator-wrap"
          onMouseEnter={() => setAlertsHover(true)}
          onMouseLeave={() => setAlertsHover(false)}
        >
          <div className="annunciator-strip">
            <button
              type="button"
              className={`pill pill-button ${metrics.cautionCount > 0 ? 'warn' : 'off'}`}
              onClick={() => setAlertsPinned((value) => !value)}
            >
              {`CAUTIONS ${metrics.cautionCount}`}
            </button>
          <StatusPill label="MASTER CAUTION" on={metrics.hasMasterCaution} tone="warn" />
          <StatusPill label="MASTER WARNING" on={metrics.hasMasterWarning} tone="danger" />
          <StatusPill label="ICE ALARM" on={metrics.iceAlarmActive} tone="warn" />
          <StatusPill label="ANTI-ICE" on={antiIce} />
          <StatusPill label="ICE DEFROST" on={antiIce} />
          <StatusPill label="BLEED AIR" on={bleedAir} />
          </div>
          {alertsOpen && (
            <div className="alerts-panel">
              <div className="alerts-panel-head">
                <span>Active Alarms</span>
                <small>{alertsPinned ? 'Pinned' : 'Hover'}</small>
              </div>
              {activeAlerts.length === 0 && <div className="alerts-empty">No active warnings or cautions.</div>}
              {activeAlerts.map((alert) => (
                <div key={alert.id ?? `${alert.key}-${alert.label}`} className={`alert-row ${alert.level}`}>
                  <span>{alert.label}</span>
                  <strong>{alert.level === 'warning' ? 'WARNING' : 'CAUTION'}</strong>
                </div>
              ))}
            </div>
          )}
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
