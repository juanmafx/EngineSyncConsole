import React, { useEffect, useRef, useState } from 'react';
import { evaluateAlertState } from './audio/alertRules';
import { useCockpitAudio } from './audio/useCockpitAudio';
import { CockpitHeader } from './components/layout/CockpitHeader';
import { TabStrip } from './components/layout/TabStrip';
import { ENGINE_COUNT } from './sim/constants';
import { useMetrics } from './sim/useMetrics';
import { useSimulationLoop } from './sim/useSimulationLoop';
import { AutopilotTab } from './tabs/AutopilotTab';
import { EnginesTab } from './tabs/EnginesTab';
import { FlightCommandsTab } from './tabs/FlightCommandsTab';
import { FuelEmulationTab } from './tabs/FuelEmulationTab';
import { GearTab } from './tabs/GearTab';
import { TelemetryTab } from './tabs/TelemetryTab';
import { TAB_LABEL, TABS } from './tabs/config';

function formatDuration(hoursFloat) {
  const totalMinutes = Math.floor(hoursFloat * 60);
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const m = String(totalMinutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

const AUTOTHROTTLE_OVERRIDE_MS = 5000;
const AUTOTHROTTLE_SLEW_PER_TICK = 1.6;
const ALERT_LABELS = {
  egt_critical: 'EGT Critical',
  egt_high: 'EGT High',
  oil_pressure_low: 'Low Oil Pressure',
  engine_degraded: 'Engine Degraded',
  fuel_imbalance: 'Fuel Imbalance',
  throttle_asymmetry: 'Throttle Asymmetry',
  electrical_bus_low: 'Electrical Bus Low',
  ice_alarm: 'Airframe Ice',
  gear_unsafe: 'Gear Unsafe',
};

export default function App() {
  const [throttles, setThrottles] = useState([63, 65, 62, 64, 63, 66, 61, 64]);
  const [targetEpr, setTargetEpr] = useState(1.88);
  const [crossfeed, setCrossfeed] = useState(false);
  const [boost, setBoost] = useState(true);
  const [transfer, setTransfer] = useState(true);
  const [antiIce, setAntiIce] = useState(false);
  const [bleedAir, setBleedAir] = useState(true);
  const [faultEngine, setFaultEngine] = useState(3);
  const [faultEnabled, setFaultEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [masterVolume, setMasterVolume] = useState(55);
  const [alertVolume, setAlertVolume] = useState(68);
  const [acknowledgeToken, setAcknowledgeToken] = useState(0);
  const [activeTab, setActiveTab] = useState('engines');
  const [autopilotOn, setAutopilotOn] = useState(false);
  const [altitudeHold, setAltitudeHold] = useState(true);
  const [headingHold, setHeadingHold] = useState(true);
  const [navCoupled, setNavCoupled] = useState(false);
  const [speedHold, setSpeedHold] = useState(false);
  const [targetAltitudeFt, setTargetAltitudeFt] = useState(34000);
  const [targetHeadingDeg, setTargetHeadingDeg] = useState(90);
  const [targetAirspeedKt, setTargetAirspeedKt] = useState(442);
  const [targetVsFpm, setTargetVsFpm] = useState(0);
  const [gearDown, setGearDown] = useState(false);
  const [gearTransit, setGearTransit] = useState(false);
  const [gearLocked, setGearLocked] = useState({ nose: false, left: false, right: false });
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const manualThrottleOverrideUntilRef = useRef(0);
  const autothrottleIntegratorRef = useRef(0);

  const sim = useSimulationLoop({
    throttles,
    targetEpr,
    antiIce,
    boost,
    faultEnabled,
    faultEngine,
    crossfeed,
    transfer,
    autopilotOn,
    altitudeHold,
    targetAltitudeFt,
    targetVsFpm,
    headingHold,
    navCoupled,
    targetHeadingDeg,
  });

  useEffect(() => {
    setGearTransit(true);
    const timer = setTimeout(() => {
      setGearLocked({ nose: gearDown, left: gearDown, right: gearDown });
      setGearTransit(false);
    }, 900);

    return () => clearTimeout(timer);
  }, [gearDown]);

  const metrics = useMetrics({
    sim,
    throttles,
    antiIce,
    bleedAir,
    boost,
    transfer,
    faultEnabled,
  });

  useEffect(() => {
    setTelemetryHistory((prev) => {
      const next = [
        ...prev,
        {
          airspeedKt: metrics.airspeedKt,
          throttleCapabilityKt: metrics.telemetry.throttleCapabilityKt,
          fullThrottleCapabilityKt: metrics.telemetry.fullThrottleCapabilityKt,
          thrustMarginLbf: metrics.telemetry.thrustMarginLbf,
          altitudeFt: metrics.altitudeFt,
          verticalSpeedFpm: metrics.verticalSpeedFpm,
          totalFuelFlow: metrics.totalFuelFlow,
          fuelUsedLb: metrics.fuelUsedLb,
          enduranceHours: metrics.enduranceHours,
          rangeNm: metrics.rangeNm,
          egt: [...metrics.egt],
          rpm: [...metrics.rpm],
          fuelFlowPerEngine: [...metrics.fuelFlowPerEngine],
          avgThrottlePct: throttles.reduce((sum, value) => sum + value, 0) / ENGINE_COUNT,
          enginesAtMaxCount: throttles.filter((value) => value >= 99).length,
        },
      ];
      return next.length > 360 ? next.slice(next.length - 360) : next;
    });
  }, [
    metrics.airspeedKt,
    metrics.telemetry.throttleCapabilityKt,
    metrics.telemetry.fullThrottleCapabilityKt,
    metrics.telemetry.thrustMarginLbf,
    metrics.altitudeFt,
    metrics.verticalSpeedFpm,
    metrics.totalFuelFlow,
    metrics.fuelUsedLb,
    metrics.enduranceHours,
    metrics.rangeNm,
    metrics.egt,
    metrics.rpm,
    metrics.fuelFlowPerEngine,
    throttles,
  ]);

  const setThrottleAt = (idx, value) => {
    manualThrottleOverrideUntilRef.current = Date.now() + AUTOTHROTTLE_OVERRIDE_MS;
    setThrottles((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const autothrottleAllowed = autopilotOn && speedHold && Date.now() >= manualThrottleOverrideUntilRef.current;
      if (!autothrottleAllowed) {
        autothrottleIntegratorRef.current *= 0.92;
        return;
      }

      const speedError = targetAirspeedKt - metrics.airspeedKt;
      const climbComp = Math.max(0, metrics.verticalSpeedFpm) * 0.0015;
      const baseDemand = 34 + (targetAirspeedKt - 180) * 0.18;
      autothrottleIntegratorRef.current = Math.max(
        -12,
        Math.min(12, autothrottleIntegratorRef.current + speedError * 0.01),
      );
      const demand = Math.max(
        15,
        Math.min(100, baseDemand + speedError * 0.22 + autothrottleIntegratorRef.current + climbComp),
      );

      setThrottles((prev) =>
        prev.map((throttle) => {
          const delta = demand - throttle;
          const step = Math.max(-AUTOTHROTTLE_SLEW_PER_TICK, Math.min(AUTOTHROTTLE_SLEW_PER_TICK, delta));
          return Math.max(0, Math.min(100, throttle + step));
        }),
      );
    }, 500);

    return () => clearInterval(interval);
  }, [autopilotOn, speedHold, targetAirspeedKt, metrics.airspeedKt, metrics.verticalSpeedFpm]);

  const averagePower = throttles.reduce((sum, value) => sum + value, 0) / (ENGINE_COUNT * 100);
  const leftBankPower = throttles.slice(0, 4).reduce((sum, value) => sum + value, 0) / (4 * 100);
  const rightBankPower = throttles.slice(4).reduce((sum, value) => sum + value, 0) / (4 * 100);
  const activeEngineCount = throttles.filter((value) => value > 8).length;
  const activeEngineRatio = activeEngineCount / ENGINE_COUNT;
  const weightedEnginePower = throttles.reduce((sum, value) => sum + (value > 8 ? value : 0), 0) / (ENGINE_COUNT * 100);
  const allGearLocked = gearLocked.nose && gearLocked.left && gearLocked.right;
  const gearUnsafe = gearDown && !allGearLocked;
  const simState = {
    egt: metrics.egt,
    oilPressure: metrics.oilPressure,
    symmetryDelta: metrics.symmetryDelta,
    tankImbalancePct: metrics.tankImbalancePct,
    busA: metrics.busA,
    busB: metrics.busB,
    faultEnabled,
    antiIce,
    iceAlarmActive: !antiIce,
    gearDown,
    gearUnsafe,
    gearTransit,
  };
  const alertSnapshot = evaluateAlertState(simState);
  const activeAlerts = [
    ...[...alertSnapshot.warnings].map((key) => ({
      key,
      level: 'warning',
      label: ALERT_LABELS[key] ?? key,
    })),
    ...[...alertSnapshot.cautions].map((key) => ({
      key,
      level: 'caution',
      label: key === 'engine_degraded' ? `Engine ${faultEngine + 1} Degraded` : ALERT_LABELS[key] ?? key,
    })),
  ];

  const { playUiClick } = useCockpitAudio({
    enabled: audioEnabled,
    masterVolume: masterVolume / 100,
    alertVolume: alertVolume / 100,
    ambientProfile: {
      averagePower,
      weightedEnginePower,
      activeEngineCount,
      activeEngineRatio,
      leftBankPower,
      rightBankPower,
    },
    acknowledgeToken,
    simState,
  });

  const toggleWithClick = (setter) => {
    playUiClick();
    setter((value) => !value);
  };

  return (
    <div className="page">
      <CockpitHeader
        metrics={metrics}
        activeAlerts={activeAlerts}
        antiIce={antiIce}
        bleedAir={bleedAir}
        audioEnabled={audioEnabled}
        onToggleAudio={() => toggleWithClick(setAudioEnabled)}
        onAcknowledge={() => {
          playUiClick();
          setAcknowledgeToken((value) => value + 1);
        }}
        masterVolume={masterVolume}
        onMasterVolumeChange={setMasterVolume}
        alertVolume={alertVolume}
        onAlertVolumeChange={setAlertVolume}
      />

      <TabStrip
        tabs={TABS}
        tabLabel={TAB_LABEL}
        activeTab={activeTab}
        onTabChange={(tab) => {
          playUiClick();
          setActiveTab(tab);
        }}
      />

      {activeTab === 'engines' && (
        <EnginesTab
          throttles={throttles}
          setThrottleAt={setThrottleAt}
          targetEpr={targetEpr}
          setTargetEpr={setTargetEpr}
          metrics={metrics}
          faultEngine={faultEngine}
          setFaultEngine={setFaultEngine}
          faultEnabled={faultEnabled}
          setFaultEnabled={setFaultEnabled}
          toggleWithClick={toggleWithClick}
        />
      )}

      {activeTab === 'gear' && (
        <GearTab
          gearDown={gearDown}
          setGearDown={setGearDown}
          gearTransit={gearTransit}
          gearUnsafe={gearUnsafe}
          gearLocked={gearLocked}
          metrics={metrics}
          antiIce={antiIce}
          playUiClick={playUiClick}
        />
      )}

      {activeTab === 'flight' && (
        <FlightCommandsTab
          metrics={metrics}
          crossfeed={crossfeed}
          setCrossfeed={setCrossfeed}
          boost={boost}
          setBoost={setBoost}
          transfer={transfer}
          setTransfer={setTransfer}
          bleedAir={bleedAir}
          setBleedAir={setBleedAir}
          antiIce={antiIce}
          setAntiIce={setAntiIce}
          faultEngine={faultEngine}
          faultEnabled={faultEnabled}
          toggleWithClick={toggleWithClick}
        />
      )}

      {activeTab === 'fuel' && (
        <FuelEmulationTab
          metrics={metrics}
          telemetryHistory={telemetryHistory}
          crossfeed={crossfeed}
          setCrossfeed={setCrossfeed}
          boost={boost}
          setBoost={setBoost}
          transfer={transfer}
          setTransfer={setTransfer}
          toggleWithClick={toggleWithClick}
          formatDuration={formatDuration}
        />
      )}

      {activeTab === 'autopilot' && (
        <AutopilotTab
          autopilotOn={autopilotOn}
          setAutopilotOn={setAutopilotOn}
          altitudeHold={altitudeHold}
          setAltitudeHold={setAltitudeHold}
          headingHold={headingHold}
          setHeadingHold={setHeadingHold}
          navCoupled={navCoupled}
          setNavCoupled={setNavCoupled}
          speedHold={speedHold}
          setSpeedHold={setSpeedHold}
          targetAltitudeFt={targetAltitudeFt}
          setTargetAltitudeFt={setTargetAltitudeFt}
          targetHeadingDeg={targetHeadingDeg}
          setTargetHeadingDeg={setTargetHeadingDeg}
          targetAirspeedKt={targetAirspeedKt}
          setTargetAirspeedKt={setTargetAirspeedKt}
          targetVsFpm={targetVsFpm}
          setTargetVsFpm={setTargetVsFpm}
          metrics={metrics}
          toggleWithClick={toggleWithClick}
        />
      )}

      {activeTab === 'telemetry' && <TelemetryTab telemetryHistory={telemetryHistory} metrics={metrics} />}
    </div>
  );
}
