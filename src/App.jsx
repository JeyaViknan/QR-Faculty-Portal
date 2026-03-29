import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./App.css";

const DEFAULTS = {
  speedMs: 500,
  validQrCount: 4,
  durationSec: 30,
};

const randomToken = () =>
  `${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

const randomIntInRange = (min, max) => {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const buildValidSchedule = (validCount, tickCount, speedMs) => {
  const firstValidAfterTicks = Math.ceil(3000 / speedMs);
  const minGapTicks = Math.max(1, Math.ceil(2000 / speedMs));

  if (firstValidAfterTicks >= tickCount) {
    return [];
  }

  const maxPossible =
    Math.floor((tickCount - 1 - firstValidAfterTicks) / minGapTicks) + 1;
  const targetCount = Math.min(validCount, maxPossible);

  if (targetCount <= 0) {
    return [];
  }

  const schedule = [];
  for (let i = 0; i < targetCount; i += 1) {
    const remaining = targetCount - i - 1;
    const minTick = i === 0 ? firstValidAfterTicks : schedule[i - 1] + minGapTicks;
    const maxTick = tickCount - 1 - remaining * minGapTicks;
    schedule.push(randomIntInRange(minTick, maxTick));
  }

  return schedule;
};

const App = () => {
  const [speedMs, setSpeedMs] = useState(DEFAULTS.speedMs);
  const [validQrCount, setValidQrCount] = useState(DEFAULTS.validQrCount);
  const [durationSec, setDurationSec] = useState(DEFAULTS.durationSec);
  const [running, setRunning] = useState(false);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentQrValue, setCurrentQrValue] = useState("");
  const [currentIsValid, setCurrentIsValid] = useState(false);
  const [validShown, setValidShown] = useState(0);
  const [scheduledValidCount, setScheduledValidCount] = useState(0);
  const [sessionLabel, setSessionLabel] = useState("");

  const sessionRef = useRef({
    id: "",
    tickCount: 1,
    currentTick: 0,
    validTicks: new Set(),
    validEmitted: 0,
    speedMs: DEFAULTS.speedMs,
  });
  const qrIntervalRef = useRef(null);
  const timerRef = useRef(null);

  const clearAllTimers = () => {
    clearInterval(qrIntervalRef.current);
    clearInterval(timerRef.current);
    qrIntervalRef.current = null;
    timerRef.current = null;
  };

  const stopSession = () => {
    clearAllTimers();
    setRunning(false);
    setCurrentIsValid(false);
  };

  const emitNextQr = () => {
    const state = sessionRef.current;
    const isValid = state.validTicks.includes(state.currentTick);
    const nowIso = new Date().toISOString();
    const payload = isValid
      ? {
          type: "attendance-valid",
          sessionId: state.id,
          pulse: state.validEmitted + 1,
          timestamp: nowIso,
        }
      : {
          type: "attendance-noise",
          sessionId: state.id,
          nonce: randomToken(),
          timestamp: nowIso,
        };

    if (isValid) {
      state.validEmitted += 1;
      setValidShown(state.validEmitted);
    }

    setCurrentIsValid(isValid);
    setCurrentQrValue(JSON.stringify(payload));
    state.currentTick = (state.currentTick + 1) % state.tickCount;
  };

  const startSession = () => {
    const safeSpeed = Math.max(100, Number(speedMs) || DEFAULTS.speedMs);
    const safeDuration = Math.max(5, Number(durationSec) || DEFAULTS.durationSec);
    const rawTickCount = Math.floor((safeDuration * 1000) / safeSpeed);
    const tickCount = Math.max(1, rawTickCount);
    const safeValidCount = Math.max(1, Number(validQrCount) || DEFAULTS.validQrCount);
    const schedule = buildValidSchedule(safeValidCount, tickCount, safeSpeed);
    const sessionId = `ATT-${Date.now().toString(36).toUpperCase()}`;

    clearAllTimers();
    setElapsedSec(0);
    setValidShown(0);
    setScheduledValidCount(schedule.length);
    setRunning(true);
    setSessionLabel(sessionId);
    sessionRef.current = {
      id: sessionId,
      tickCount,
      currentTick: 0,
      validTicks: schedule,
      validEmitted: 0,
      speedMs: safeSpeed,
    };

    emitNextQr();

    qrIntervalRef.current = setInterval(emitNextQr, safeSpeed);
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= safeDuration) {
          stopSession();
          return safeDuration;
        }
        return next;
      });
    }, 1000);
  };

  const resetDefaults = () => {
    setSpeedMs(DEFAULTS.speedMs);
    setValidQrCount(DEFAULTS.validQrCount);
    setDurationSec(DEFAULTS.durationSec);
  };

  useEffect(() => () => clearAllTimers(), []);

  const remaining = Math.max(0, durationSec - elapsedSec);

  return (
    <main className="app-shell">
      {!running ? (
        <section className="setup-card">
          <p className="eyebrow">Attendance System</p>
          <h1>Configure QR Session</h1>
          <p className="subtext">
            Set how fast codes rotate, how many valid attendance pulses are injected,
            and total run time. Defaults are ready to use.
          </p>

          <div className="settings-grid">
            <label className="field">
              <span>Speed per QR (seconds)</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={(Number(speedMs) / 1000).toFixed(1)}
                onChange={(e) =>
                  setSpeedMs(Math.max(100, Math.round(Number(e.target.value || 0.5) * 1000)))
                }
              />
            </label>

            <label className="field">
              <span>Number of valid QRs</span>
              <input
                type="number"
                min="1"
                step="1"
                value={validQrCount}
                onChange={(e) => setValidQrCount(Math.max(1, Number(e.target.value || 1)))}
              />
            </label>

            <label className="field">
              <span>Shuffling duration (seconds)</span>
              <input
                type="number"
                min="5"
                step="1"
                value={durationSec}
                onChange={(e) => setDurationSec(Math.max(5, Number(e.target.value || 5)))}
              />
            </label>
          </div>

          <div className="defaults-note">
            Default: 0.5s per QR, 4 valid QRs, 30s duration
          </div>

          <div className="setup-actions">
            <button className="ghost-btn" onClick={resetDefaults}>
              Reset Defaults
            </button>
            <button className="primary-btn" onClick={startSession}>
              Start Session
            </button>
          </div>
        </section>
      ) : (
        <section className="session-view">
          <div className="qr-stage">
            <div className="qr-frame">
              <QRCodeSVG value={currentQrValue} className="qr-svg" includeMargin={false} />
            </div>
          </div>

          <aside className="session-panel">
            <p className="eyebrow">Live Session</p>
            <h2>{sessionLabel}</h2>
            <div className="timer-box">
              <span className="timer-label">Time Left</span>
              <span className="timer-value">{remaining}s</span>
            </div>
            <div className="meta-line">
              Elapsed: <strong>{elapsedSec}s</strong>
            </div>
            <div className="meta-line">
              Valid pulses shown:{" "}
              <strong>
                {validShown}/{scheduledValidCount}
              </strong>
            </div>
            {currentIsValid && (
              <div className="status-chip status-valid">Valid attendance QR active</div>
            )}
            <button className="danger-btn" onClick={stopSession}>
              End Session
            </button>
          </aside>
        </section>
      )}
    </main>
  );
};

export default App;
