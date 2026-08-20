/**
 * Simulation time controls: play/pause, speed, time slider, and current time display.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, FastForward, Clock } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

const SPEED_OPTIONS = [1, 10, 60, 600];
const HORIZON_HOURS = 24;

export default function TimeControls() {
  const simulationTime = useAppStore((s) => s.simulationTime);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playbackSpeed = useAppStore((s) => s.playbackSpeed);
  const setSimulationTime = useAppStore((s) => s.setSimulationTime);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const setPlaybackSpeed = useAppStore((s) => s.setPlaybackSpeed);
  const refreshPositions = useAppStore((s) => s.refreshPositions);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(new Date());

  // Animation loop
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        const now = useAppStore.getState().simulationTime;
        const next = new Date(now.getTime() + playbackSpeed * 1000);
        setSimulationTime(next);
      }, 100); // 10 FPS update
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playbackSpeed, setSimulationTime]);

  // Refresh positions periodically when playing
  useEffect(() => {
    if (!isPlaying) return;

    const posInterval = setInterval(() => {
      const t = useAppStore.getState().simulationTime;
      refreshPositions(t.toISOString());
    }, 5000); // every 5s

    return () => clearInterval(posInterval);
  }, [isPlaying, refreshPositions]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    const now = new Date();
    startTimeRef.current = now;
    setSimulationTime(now);
    refreshPositions();
  }, [setPlaying, setSimulationTime, refreshPositions]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const pct = Number(e.target.value) / 100;
      const offset = pct * HORIZON_HOURS * 3600 * 1000;
      const newTime = new Date(startTimeRef.current.getTime() + offset);
      setSimulationTime(newTime);
    },
    [setSimulationTime]
  );

  const sliderValue =
    ((simulationTime.getTime() - startTimeRef.current.getTime()) /
      (HORIZON_HOURS * 3600 * 1000)) *
    100;

  const cycleSpeed = () => {
    const currentIdx = SPEED_OPTIONS.indexOf(playbackSpeed);
    const nextIdx = (currentIdx + 1) % SPEED_OPTIONS.length;
    setPlaybackSpeed(SPEED_OPTIONS[nextIdx]);
  };

  const speedLabel = () => {
    if (playbackSpeed >= 600) return '10m/s';
    if (playbackSpeed >= 60) return '1m/s';
    if (playbackSpeed >= 10) return '10×';
    return '1×';
  };

  return (
    <footer className="time-controls app-footer" id="time-controls">
      <div className="time-controls__buttons">
        <button
          className={`time-btn ${isPlaying ? 'time-btn--active' : ''}`}
          onClick={() => setPlaying(!isPlaying)}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          id="play-pause-btn"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <button
          className="time-btn"
          onClick={handleReset}
          aria-label="Reset to now"
          id="reset-btn"
        >
          <RotateCcw size={14} />
        </button>

        <button
          className="time-btn"
          onClick={cycleSpeed}
          aria-label="Change speed"
          title={`Speed: ${speedLabel()}`}
          id="speed-btn"
          style={{ width: 'auto', padding: '0 8px', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
        >
          <FastForward size={12} style={{ marginRight: 4 }} />
          {speedLabel()}
        </button>
      </div>

      <input
        type="range"
        className="time-slider"
        min={0}
        max={100}
        step={0.1}
        value={Math.min(100, Math.max(0, sliderValue))}
        onChange={handleSliderChange}
        id="time-slider"
      />

      <div className="time-display" id="time-display">
        <Clock size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
        {simulationTime.toISOString().replace('T', ' ').slice(0, 19)} UTC
      </div>
    </footer>
  );
}
