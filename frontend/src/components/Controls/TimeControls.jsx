/**
 * Simulation time controls: play/pause, speed, time slider, and current time display.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, FastForward, Clock } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

const SPEED_OPTIONS = [1, 2, 5, 10, 25];

export default function TimeControls() {
  const simulationTime    = useAppStore((s) => s.simulationTime);
  const isPlaying         = useAppStore((s) => s.isPlaying);
  const playbackSpeed     = useAppStore((s) => s.playbackSpeed);
  const setSimulationTime = useAppStore((s) => s.setSimulationTime);
  const setPlaying        = useAppStore((s) => s.setPlaying);
  const setPlaybackSpeed  = useAppStore((s) => s.setPlaybackSpeed);
  const refreshPositions  = useAppStore((s) => s.refreshPositions);
  const intervalRef       = useRef(null);
  const refreshRef        = useRef(null);

  // Playback loop — advances simulation clock
  // At 1x: 1 real second = 1 simulated second
  // At 10x: 1 real second = 10 simulated seconds
  useEffect(() => {
    if (isPlaying) {
      const TICK_MS = 500; // update every half second for smooth motion
      intervalRef.current = setInterval(() => {
        const current = useAppStore.getState().simulationTime;
        const advanceMs = playbackSpeed * TICK_MS; // at 1x: advance 500ms per tick
        setSimulationTime(new Date(current.getTime() + advanceMs));
      }, TICK_MS);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, playbackSpeed, setSimulationTime]);

  // Periodically refresh orbital positions from backend
  // When playing: every 5 seconds (smooth updates without overloading the API)
  // When paused: every 60 seconds (background keep-alive)
  useEffect(() => {
    const interval = isPlaying ? 5000 : 60000;
    refreshRef.current = setInterval(() => {
      const currentSimTime = useAppStore.getState().simulationTime;
      refreshPositions(currentSimTime.toISOString());
    }, interval);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [isPlaying, refreshPositions]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    const now = new Date();
    setSimulationTime(now);
    refreshPositions(now.toISOString());
  }, [setPlaying, setSimulationTime, refreshPositions]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(playbackSpeed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackSpeed(next);
  }, [playbackSpeed, setPlaybackSpeed]);

  // Timeline slider: +/-12h from now
  const nowMs = new Date().getTime();
  const rangeMin = nowMs - 12 * 60 * 60 * 1000;
  const rangeMax = nowMs + 12 * 60 * 60 * 1000;

  return (
    <div className="time-controls app-footer" id="time-controls">
      <div className="time-controls__buttons">
        <button className="time-btn" onClick={() => setPlaying(!isPlaying)}
          title={isPlaying ? 'Pause' : 'Play'} id="play-pause-btn">
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="time-btn" onClick={handleReset} title="Reset to now">
          <RotateCcw size={14} />
        </button>
        <button className="time-btn" onClick={cycleSpeed} title={`Speed: ${playbackSpeed}x`} id="speed-btn">
          <FastForward size={14} />
          <span className="mono" style={{ fontSize: 10, marginLeft: 2 }}>{playbackSpeed}×</span>
        </button>
      </div>
      <input type="range" className="time-slider" min={rangeMin} max={rangeMax}
        value={simulationTime.getTime()}
        onChange={(e) => setSimulationTime(new Date(Number(e.target.value)))}
        onMouseUp={(e) => refreshPositions(new Date(Number(e.target.value)).toISOString())}
        onTouchEnd={(e) => refreshPositions(new Date(Number(e.target.value)).toISOString())}
        id="time-slider" />
      <div className="time-display">
        <Clock size={12} style={{ marginRight: 4 }} />
        <span className="mono">{simulationTime.toISOString().replace('T', '  ').split('.')[0]} UTC</span>
      </div>
    </div>
  );
}
