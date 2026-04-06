import React from 'react';
import { AIRCRAFT_LIMITS } from '../../sim/constants';
import { Module, StatusPill, ToggleButton } from '../../components/cockpit';

export function AutopilotTab({
  autopilotOn,
  setAutopilotOn,
  afcsMode,
  setAfcsMode,
  headingHold,
  setHeadingHold,
  navCoupled,
  setNavCoupled,
  speedHold,
  setSpeedHold,
  targetAltitudeFt,
  setTargetAltitudeFt,
  targetHeadingDeg,
  setTargetHeadingDeg,
  targetAirspeedKt,
  setTargetAirspeedKt,
  targetVsFpm,
  setTargetVsFpm,
  metrics,
  toggleWithClick,
}) {
  const altitudeMode = afcsMode?.altitude ?? 'OFF';
  const verticalMode = afcsMode?.vertical ?? 'NONE';
  const altitudeManaged = altitudeMode !== 'OFF';
  const headingErrorDeg = ((targetHeadingDeg - metrics.headingDeg + 540) % 360) - 180;
  const altitudeErrorFt = targetAltitudeFt - metrics.altitudeFt;
  const airspeedErrorKt = targetAirspeedKt - metrics.airspeedKt;
  const sasOn = true;
  const yawDamperOn = autopilotOn || headingHold || navCoupled;
  const flagTrim = Math.abs(metrics.verticalSpeedFpm) > 2200;
  const flagAirspeed = speedHold && Math.abs(airspeedErrorKt) > 40;
  const flagAltitude = altitudeManaged && Math.abs(altitudeErrorFt) > 2500;

  const setAltitudeMode = (mode) => {
    setAfcsMode((prev) => ({
      ...prev,
      altitude: mode,
      vertical: mode === 'OFF' ? prev.vertical : 'NONE',
    }));
  };

  const setVerticalMode = (mode) => {
    setAfcsMode((prev) => ({
      ...prev,
      altitude: mode === 'NONE' ? prev.altitude : 'OFF',
      vertical: mode,
    }));
  };

  return (
    <div className="gauge-grid">
      <Module title="AFCS - Automatic Flight Control System" colorClass="blue">
        <div className="switch-row">
          <ToggleButton
            active={autopilotOn}
            onClick={() => toggleWithClick(setAutopilotOn)}
            label={autopilotOn ? 'AFCS Engaged' : 'AFCS Standby'}
          />
          <ToggleButton active={altitudeManaged} onClick={() => setAltitudeMode(altitudeManaged ? 'OFF' : 'HOLD')} label="Altitude Hold" />
          <ToggleButton active={verticalMode === 'VS'} onClick={() => setVerticalMode(verticalMode === 'VS' ? 'NONE' : 'VS')} label="VS Mode" />
          <ToggleButton active={verticalMode === 'FPA'} onClick={() => setVerticalMode(verticalMode === 'FPA' ? 'NONE' : 'FPA')} label="FPA Mode" />
          <ToggleButton active={headingHold} onClick={() => toggleWithClick(setHeadingHold)} label="Heading Hold" />
          <ToggleButton active={navCoupled} onClick={() => toggleWithClick(setNavCoupled)} label="Nav Coupled" />
          <ToggleButton active={speedHold} onClick={() => toggleWithClick(setSpeedHold)} label="Speed Hold" />
        </div>

        <div className="annunciator-grid">
          <StatusPill label="ATT HOLD" on={autopilotOn} tone="ok" />
          <StatusPill label="SAS ACTIVE" on={sasOn} tone="ok" />
          <StatusPill label="YAW DAMPER" on={yawDamperOn} tone="ok" />
          <StatusPill label="AFCS MONITOR" on={autopilotOn} tone="warn" />
        </div>

        <div className="autopilot-grid">
          <label className="audio-control">
            Altitude Selector (ft)
            <input
              type="range"
              min={1000}
              max={AIRCRAFT_LIMITS.ceilingFt}
              step={500}
              value={targetAltitudeFt}
              onChange={(e) => setTargetAltitudeFt(Number(e.target.value))}
              className="slider"
            />
            <strong>{targetAltitudeFt.toFixed(0)} ft</strong>
          </label>
          <label className="audio-control">
            Heading Selector (deg)
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={targetHeadingDeg}
              onChange={(e) => setTargetHeadingDeg(Number(e.target.value))}
              className="slider"
            />
            <strong>{targetHeadingDeg.toFixed(0)}°</strong>
          </label>
          <label className="audio-control">
            Airspeed Selector (kt)
            <input
              type="range"
              min={180}
              max={AIRCRAFT_LIMITS.maxSpeedKt}
              step={1}
              value={targetAirspeedKt}
              onChange={(e) => setTargetAirspeedKt(Number(e.target.value))}
              className="slider"
            />
            <strong>{targetAirspeedKt.toFixed(0)} kt</strong>
          </label>
          <label className="audio-control">
            Vertical Command (fpm)
            <input
              type="range"
              min={-3000}
              max={3000}
              step={100}
              value={targetVsFpm}
              onChange={(e) => setTargetVsFpm(Number(e.target.value))}
              className="slider"
            />
            <strong>{targetVsFpm.toFixed(0)} fpm</strong>
          </label>
        </div>

        <div className="summary-row">
          <span>Control Interface</span>
          <strong>AFCS mode hierarchy (ALT mode overrides vertical mode)</strong>
        </div>
      </Module>

      <Module title="AFCS Readout, SAS and Warning Flags" colorClass="orange">
        <div className="summary-row">
          <span>Current Altitude</span>
          <strong>{metrics.altitudeFt.toFixed(0)} ft</strong>
        </div>
        <div className="summary-row">
          <span>Current Heading</span>
          <strong>{metrics.headingDeg.toFixed(0)}°</strong>
        </div>
        <div className="summary-row">
          <span>Current Airspeed</span>
          <strong>{metrics.airspeedKt.toFixed(0)} kt</strong>
        </div>
        <div className="summary-row">
          <span>Vertical Speed</span>
          <strong>{metrics.verticalSpeedFpm.toFixed(0)} fpm</strong>
        </div>
        <div className="summary-row">
          <span>Altitude Error</span>
          <strong>{altitudeErrorFt.toFixed(0)} ft</strong>
        </div>
        <div className="summary-row">
          <span>Heading Error</span>
          <strong>{headingErrorDeg.toFixed(1)}°</strong>
        </div>
        <div className="summary-row">
          <span>Airspeed Error</span>
          <strong>{airspeedErrorKt.toFixed(1)} kt</strong>
        </div>
        <div className="annunciator-grid">
          <StatusPill label="AFCS MASTER" on={autopilotOn} tone="ok" />
          <StatusPill label={`ALT ${altitudeMode}`} on={altitudeManaged} tone="ok" />
          <StatusPill label={`VERT ${verticalMode}`} on={verticalMode !== 'NONE'} tone="ok" />
          <StatusPill label="HDG HOLD" on={headingHold} tone="ok" />
          <StatusPill label="NAV COUPLED" on={navCoupled} tone="ok" />
          <StatusPill label="SPD HOLD" on={speedHold} tone="ok" />
          <StatusPill label="SAS DAMPING" on={sasOn} tone="ok" />
          <StatusPill label="YAW DAMPER" on={yawDamperOn} tone="ok" />
          <StatusPill label="TRIM FLAG" on={flagTrim} tone="warn" />
          <StatusPill label="SPD FLAG" on={flagAirspeed} tone="warn" />
          <StatusPill label="ALT FLAG" on={flagAltitude} tone="warn" />
        </div>
        <div className="summary-row">
          <span>Aircraft Ceiling</span>
          <strong>{AIRCRAFT_LIMITS.ceilingFt.toLocaleString()} ft</strong>
        </div>
        <div className="summary-row">
          <span>Aircraft Max Speed</span>
          <strong>{AIRCRAFT_LIMITS.maxSpeedKt} kt</strong>
        </div>
        <div className="summary-row">
          <span>Aircraft Unrefueled Range</span>
          <strong>{AIRCRAFT_LIMITS.rangeNm.toLocaleString()} nm</strong>
        </div>
      </Module>
    </div>
  );
}
