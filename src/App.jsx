import React, { useEffect, useRef, useState } from 'react';
import { evaluateAlertState } from './audio/alertRules';
import { useCockpitAudio } from './audio/useCockpitAudio';
import { CockpitHeader } from './components/layout/CockpitHeader';
import { TabStrip } from './components/layout/TabStrip';
import { AIRCRAFT_MASS, ENGINE_COUNT } from './sim/constants';
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
const AUTOTHROTTLE_MAX_THROTTLE = 92;
function buildActiveAlertList({ metrics, faultEnabled, faultEngine, antiIce, gearDown, gearUnsafe, gearTransit, boost, transfer }) {
  const rows = [];

  metrics.egt.forEach((value, i) => {
    if (value > 760) {
      rows.push({ id: `egt_critical_e${i + 1}`, key: 'egt_critical', level: 'warning', label: `EGT Critical E${i + 1}` });
    }
    if (value > 700) {
      rows.push({ id: `egt_high_e${i + 1}`, key: 'egt_high', level: 'caution', label: `EGT High E${i + 1}` });
    }
  });

  metrics.oilPressure.forEach((value, i) => {
    if (value < 35) {
      rows.push({ id: `oil_pressure_low_e${i + 1}`, key: 'oil_pressure_low', level: 'caution', label: `Low Oil Pressure E${i + 1}` });
    }
  });

  metrics.oilTemp.forEach((value, i) => {
    if (value > 123) {
      rows.push({ id: `oil_temp_high_e${i + 1}`, key: 'oil_temp_high', level: 'caution', label: `Oil Temp High E${i + 1}` });
    }
  });

  metrics.trend.forEach((value, i) => {
    if (Math.abs(value) > 7) {
      rows.push({ id: `egt_trend_abnormal_e${i + 1}`, key: 'egt_trend_abnormal', level: 'caution', label: `EGT Trend Abnormal E${i + 1}` });
    }
  });

  if (faultEnabled) {
    rows.push({ id: `engine_degraded_e${faultEngine + 1}`, key: 'engine_degraded', level: 'caution', label: `Engine ${faultEngine + 1} Degraded` });
  }

  if (metrics.tankImbalancePct > 2.2) {
    rows.push({ id: 'fuel_imbalance', key: 'fuel_imbalance', level: 'caution', label: 'Fuel Imbalance' });
  }

  if (metrics.symmetryDelta > 2.2) {
    rows.push({ id: 'throttle_asymmetry', key: 'throttle_asymmetry', level: 'caution', label: 'Throttle Asymmetry' });
  }

  if (metrics.busA < 25 || metrics.busB < 25) {
    rows.push({ id: 'electrical_bus_low', key: 'electrical_bus_low', level: 'caution', label: 'Electrical Bus Low' });
  }

  if (!antiIce) {
    rows.push({ id: 'ice_alarm', key: 'ice_alarm', level: 'caution', label: 'Airframe Ice' });
  }

  if (gearDown && gearUnsafe && !gearTransit) {
    rows.push({ id: 'gear_unsafe', key: 'gear_unsafe', level: 'caution', label: 'Gear Unsafe' });
  }

  if (!boost) {
    rows.push({ id: 'boost_pump_off', key: 'boost_pump_off', level: 'caution', label: 'Boost Pump Off' });
  }

  if (!transfer) {
    rows.push({ id: 'fuel_transfer_off', key: 'fuel_transfer_off', level: 'caution', label: 'Fuel Transfer Off' });
  }

  return rows;
}

export default function App() {
  const [throttles, setThrottles] = useState([63, 65, 62, 64, 63, 66, 61, 64]);
  const [targetEpr, setTargetEpr] = useState(1.88);
  const [payloadLb, setPayloadLb] = useState(Math.round(AIRCRAFT_MASS.maxPayloadLb * 0.4));
  const [crossfeed, setCrossfeed] = useState(false);
  const [boost, setBoost] = useState(true);
  const [transfer, setTransfer] = useState(true);
  const [antiIce, setAntiIce] = useState(false);
  const [bleedAir, setBleedAir] = useState(true);
  const [faultEngine, setFaultEngine] = useState(3);
  const [faultEnabled, setFaultEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [masterVolume, setMasterVolume] = useState(55);
  const [alertVolume, setAlertVolume] = useState(68);
  const [acknowledgeToken, setAcknowledgeToken] = useState(0);
  const [activeTab, setActiveTab] = useState('engines');
  const [autopilotOn, setAutopilotOn] = useState(false);
  const [afcsMode, setAfcsMode] = useState({ altitude: 'HOLD', vertical: 'VS' });
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
    payloadLb,
    faultEnabled,
    faultEngine,
    crossfeed,
    transfer,
    autopilotOn,
    afcsMode,
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
    payloadLb,
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
          grossWeightLb: metrics.grossWeightLb,
          mtowPct: metrics.mtowPct,
          payloadLb: metrics.payloadLb,
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
    metrics.grossWeightLb,
    metrics.mtowPct,
    metrics.payloadLb,
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

      const achievableTargetKt = Math.min(
        targetAirspeedKt,
        Math.max(190, metrics.telemetry.fullThrottleCapabilityKt - 4),
      );
      const speedError = achievableTargetKt - metrics.airspeedKt;
      const climbComp = Math.max(0, metrics.verticalSpeedFpm) * 0.0015;
      const baseDemand = 32 + (achievableTargetKt - 180) * 0.14;
      autothrottleIntegratorRef.current = Math.max(
        -10,
        Math.min(10, autothrottleIntegratorRef.current + speedError * 0.007),
      );
      const demand = Math.max(
        15,
        Math.min(AUTOTHROTTLE_MAX_THROTTLE, baseDemand + speedError * 0.13 + autothrottleIntegratorRef.current + climbComp),
      );

      setThrottles((prev) =>
        prev.map((throttle) => {
          const delta = demand - throttle;
          const step = Math.max(-AUTOTHROTTLE_SLEW_PER_TICK, Math.min(AUTOTHROTTLE_SLEW_PER_TICK, delta));
          const next = Math.max(0, Math.min(100, throttle + step));
          return Math.round(next * 10) / 10;
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
  const activeAlerts = buildActiveAlertList({
    metrics,
    faultEnabled,
    faultEngine,
    antiIce,
    gearDown,
    gearUnsafe,
    gearTransit,
    boost,
    transfer,
  });

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
          payloadLb={payloadLb}
          setPayloadLb={setPayloadLb}
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
          afcsMode={afcsMode}
          setAfcsMode={setAfcsMode}
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
