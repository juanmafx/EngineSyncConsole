import { Howl, Howler } from 'howler';

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function safeHowl(options) {
  try {
    const howl = new Howl({
      ...options,
      onloaderror: () => {
        howl.__failed = true;
        console.warn('[CockpitAudio] load error', { src: options.src });
      },
    });

    howl.__failed = false;
    return howl;
  } catch {
    return null;
  }
}

function canPlay(howl) {
  return Boolean(howl && !howl.__failed);
}

export default class SoundManager {
  constructor() {
    this.initialized = false;
    this.enabled = false;

    this.masterVolume = 0.55;
    this.alertVolume = 0.75;

    this.currentAmbient = 0;
    this.targetAmbient = 0;
    this.ambientTicker = null;

    this.loopPriority = 0;
    this.alertLoopTimer = null;
    this.silencedPriority = 0;

    this.cooldowns = new Map();

    this.engineInner = null;
    this.engineOuter = null;
    this.warningTone = null;
    this.cautionTone = null;
    this.iceTone = null;
    this.gearUnsafeTone = null;
    this.uiClick = null;
  }

  init() {
    if (this.initialized) {
      return;
    }

    this.engineInner = safeHowl({
      src: ['/sounds/engine/engn1_inn.wav'],
      loop: true,
      volume: 0,
      pool: 12,
    });

    this.engineOuter = safeHowl({
      src: ['/sounds/engine/engn1_out.wav'],
      loop: true,
      volume: 0,
      pool: 12,
    });

    this.warningTone = safeHowl({
      // Keep master warning as a neutral tone. Some packs map master-warning.wav to voice callouts.
      src: ['/sounds/alerts/master-caution.wav'],
      volume: 0.35,
      rate: 0.62,
      pool: 20,
    });

    this.cautionTone = safeHowl({
      src: ['/sounds/alerts/master-caution.wav'],
      volume: 0.2,
      rate: 0.72,
      pool: 20,
    });

    this.iceTone = safeHowl({
      src: ['/sounds/alerts/ice-alarm.wav'],
      volume: 0.2,
      rate: 1.05,
      pool: 20,
    });

    this.gearUnsafeTone = safeHowl({
      // Dedicated "TOO LOW GEAR" / gear warning callout.
      src: ['/sounds/alerts/master-warning.wav'],
      volume: 0.24,
      rate: 0.95,
      pool: 20,
    });

    this.uiClick = safeHowl({
      src: ['/sounds/ui/switch-click.wav'],
      volume: 0.12,
      rate: 2.4,
      pool: 24,
    });

    this.initialized = true;
    this.applyMasterVolume();
    this.logEvent('initialized');
  }

  logEvent(event, payload = null) {
    if (payload) {
      console.info(`[CockpitAudio] ${event}`, payload);
      return;
    }

    console.info(`[CockpitAudio] ${event}`);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.applyMasterVolume();
    this.logEvent('audio_toggled', { enabled });

    if (!enabled) {
      this.stopAlertLoop();
      this.setAmbientIntensity(0);
    }
  }

  setMasterVolume(value) {
    this.masterVolume = clamp01(value);
    this.applyMasterVolume();
  }

  setAlertVolume(value) {
    this.alertVolume = clamp01(value);
  }

  applyMasterVolume() {
    Howler.volume(this.enabled ? this.masterVolume : 0);
  }

  playUiClick() {
    if (!this.enabled || !canPlay(this.uiClick)) {
      return;
    }

    this.uiClick.stop();
    this.uiClick.play();
    this.logEvent('sound_play', { type: 'ui_click' });
  }

  setAmbientIntensity(intensity) {
    // Ambient is smoothed in a short ticker so throttle moves do not pop.
    this.targetAmbient = clamp01(intensity);

    if (!this.enabled) {
      this.targetAmbient = 0;
    }

    if (!this.ambientTicker) {
      this.ambientTicker = setInterval(() => this.tickAmbient(), 120);
    }
  }

  tickAmbient() {
    const delta = this.targetAmbient - this.currentAmbient;
    this.currentAmbient += delta * 0.18;

    if (Math.abs(delta) < 0.004) {
      this.currentAmbient = this.targetAmbient;
    }

    const active = this.currentAmbient > 0.01;

    if (active) {
      this.startAmbientLoops();
    }

    if (canPlay(this.engineInner)) {
      this.engineInner.volume(this.currentAmbient * 0.22);
    }

    if (canPlay(this.engineOuter)) {
      this.engineOuter.volume(this.currentAmbient * 0.11);
    }

    if (!active && this.targetAmbient <= 0.01) {
      this.stopAmbientLoops();
      clearInterval(this.ambientTicker);
      this.ambientTicker = null;
    }
  }

  startAmbientLoops() {
    if (canPlay(this.engineInner) && !this.engineInner.playing()) {
      this.engineInner.play();
    }

    if (canPlay(this.engineOuter) && !this.engineOuter.playing()) {
      this.engineOuter.play();
    }
  }

  stopAmbientLoops() {
    if (canPlay(this.engineInner) && this.engineInner.playing()) {
      this.engineInner.stop();
    }

    if (canPlay(this.engineOuter) && this.engineOuter.playing()) {
      this.engineOuter.stop();
    }
  }

  triggerWarning(key) {
    this.triggerPriorityTone(1, key);
  }

  triggerCaution(key) {
    this.triggerPriorityTone(2, key);
  }

  triggerIceAlert() {
    if (!this.enabled || !canPlay(this.iceTone)) {
      return;
    }

    const now = Date.now();
    const cooldownKey = 'ice_alarm';
    const last = this.cooldowns.get(cooldownKey) ?? 0;
    if (now - last < 7000) {
      return;
    }

    this.cooldowns.set(cooldownKey, now);
    this.iceTone.volume(0.24 * this.alertVolume);
    this.iceTone.stop();
    this.iceTone.play();
    this.logEvent('sound_play', { type: 'ice_alarm', key: 'ice_alarm', priority: 2 });
  }

  triggerGearUnsafeAlert() {
    if (!this.enabled || !canPlay(this.gearUnsafeTone)) {
      return;
    }

    const now = Date.now();
    const cooldownKey = 'gear_unsafe_voice';
    const last = this.cooldowns.get(cooldownKey) ?? 0;
    if (now - last < 12000) {
      return;
    }

    this.cooldowns.set(cooldownKey, now);
    this.gearUnsafeTone.volume(0.24 * this.alertVolume);
    this.gearUnsafeTone.stop();
    this.gearUnsafeTone.play();
    this.logEvent('sound_play', { type: 'gear_unsafe', key: 'gear_unsafe', priority: 2 });
  }

  triggerPriorityTone(priority, key) {
    if (!this.enabled) {
      return;
    }

    // Per-alert cooldown prevents the sim loop from retriggering the same tone every tick.
    const now = Date.now();
    const cooldownKey = `${priority}:${key}`;
    let cooldownMs = priority === 1 ? 3500 : 5000;
    if (key === 'gear_unsafe' || key === 'fuel_imbalance') {
      cooldownMs = 12000;
    }
    const last = this.cooldowns.get(cooldownKey) ?? 0;

    if (now - last < cooldownMs) {
      return;
    }

    this.cooldowns.set(cooldownKey, now);

    if (priority === 1 && canPlay(this.warningTone)) {
      this.warningTone.volume(0.3 * this.alertVolume);
      this.warningTone.stop();
      this.warningTone.play();
      this.logEvent('sound_play', { type: 'warning', key, priority });
    }

    if (priority === 2 && canPlay(this.cautionTone)) {
      this.cautionTone.volume(0.22 * this.alertVolume);
      this.cautionTone.stop();
      this.cautionTone.play();
      this.logEvent('sound_play', { type: 'caution', key, priority });
    }
  }

  updateAlertPriority(priority) {
    if (!this.enabled) {
      return;
    }

    if (priority === 0) {
      this.stopAlertLoop();
      this.silencedPriority = 0;
      return;
    }

    if (this.silencedPriority !== 0 && priority >= this.silencedPriority) {
      this.stopAlertLoop();
      return;
    }

    if (this.silencedPriority !== 0 && priority < this.silencedPriority) {
      this.silencedPriority = 0;
    }

    if (this.loopPriority === priority && this.alertLoopTimer) {
      return;
    }

    this.startAlertLoop(priority);
  }

  startAlertLoop(priority) {
    this.stopAlertLoop();
    this.loopPriority = priority;

    this.playLoopTone();
    this.alertLoopTimer = setInterval(() => this.playLoopTone(), priority === 1 ? 2600 : 4200);
    this.logEvent('alert_loop_started', { priority });
  }

  playLoopTone() {
    if (this.loopPriority === 1 && canPlay(this.warningTone)) {
      this.warningTone.volume(0.35 * this.alertVolume);
      this.warningTone.stop();
      this.warningTone.play();
      return;
    }

    if (this.loopPriority === 2 && canPlay(this.cautionTone)) {
      this.cautionTone.volume(0.25 * this.alertVolume);
      this.cautionTone.stop();
      this.cautionTone.play();
    }
  }

  acknowledgeAlerts() {
    if (this.loopPriority === 0) {
      return;
    }

    this.silencedPriority = this.loopPriority;
    this.stopAlertLoop();
    this.logEvent('alerts_acknowledged', { silencedPriority: this.silencedPriority });
  }

  stopAlertLoop() {
    if (this.alertLoopTimer) {
      clearInterval(this.alertLoopTimer);
      this.alertLoopTimer = null;
      this.logEvent('alert_loop_stopped');
    }

    this.loopPriority = 0;
  }

  stopAll() {
    this.stopAlertLoop();
    this.setAmbientIntensity(0);

    if (canPlay(this.engineInner)) {
      this.engineInner.stop();
    }

    if (canPlay(this.engineOuter)) {
      this.engineOuter.stop();
    }

    if (canPlay(this.warningTone)) {
      this.warningTone.stop();
    }

    if (canPlay(this.cautionTone)) {
      this.cautionTone.stop();
    }

    if (canPlay(this.iceTone)) {
      this.iceTone.stop();
    }

    if (canPlay(this.uiClick)) {
      this.uiClick.stop();
    }
  }
}
