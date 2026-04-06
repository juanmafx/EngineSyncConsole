# EngineSyncConsole
Multi-Engine Console is a React-based central avionics simulation console for engine controls, flight navigation, alarm management, and cabin activity monitoring. It enables users to analyze aircraft behavior, trigger and test sound alarms, and simulate engine and onboard system responses in a controlled environment.

## Features

- 8-engine simulation model with independent throttle controls (E1-E8).
- Target EPR command plus per-engine EPR actual monitoring.
- Live engine metrics: RPM, EGT, oil pressure, oil temperature, and trend rate.
- Throttle symmetry and left/right imbalance tracking.
- Engine fault injection on a selected engine (degraded performance behavior).
- Fuel model with aircraft-style tanks: FWD, AFT, LEFT WING, RIGHT WING.
- Fuel transfer mode and crossfeed equalization behavior.
- Boost pump and transfer state controls.
- Per-engine and total fuel flow monitoring.
- Fuel endurance and predicted range estimation.
- Trip timer, distance (nm), and fuel used since startup.
- Flight systems status: hydraulic pressure, electrical bus A/B, and generator online states.
- AFCS/autopilot panel with AFCS master engage/standby.
- AFCS modes: altitude hold, heading hold, nav coupled, and speed hold.
- AFCS selectors for target altitude, heading, airspeed, and vertical speed.
- Autothrottle behavior when speed hold is active.
- Manual throttle override window to temporarily bypass autothrottle.
- Gear simulation with transit delay, lock indications (nose/left/right), and unsafe detection.
- Master caution/warning logic and caution count aggregation.
- Annunciators for key conditions (EGT high/critical, low oil pressure, fuel imbalance, electrical bus low, ice alarm, gear unsafe, engine degraded).
- Cockpit audio on/off control.
- Cockpit master volume and alert volume controls.
- UI switch click sounds.
- Ambient engine loop audio tied to engine power.
- Warning/caution tones with priority loop behavior.
- Dedicated ice alert and gear warning callouts.
- Acknowledge/silence alerts control.
- Telemetry tab with live trend chart for airspeed.
- Telemetry tab with live trend chart for throttle speed capability.
- Telemetry tab with live trend chart for full-throttle speed capability.
- Telemetry tab with live trend chart for thrust margin.
- Telemetry tab with live trend chart for altitude.
- Telemetry tab with live trend chart for vertical speed.
- Built with React + Vite and organized in modular tabs: Engines, Gear, Flight Commands, Fuel Emulation, Autopilot, Telemetry.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```
