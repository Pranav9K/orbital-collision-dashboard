/**
 * 3D Globe visualization using react-globe.gl.
 */

import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import Globe from 'react-globe.gl';
import { useAppStore } from '../../store/appStore';
import { getObjectTypeColor, getRiskColor } from '../../types';

export default function GlobeView() {
  const globeRef = useRef(null);
  const containerRef = useRef(null);

  const positions = useAppStore((s) => s.positions);
  const conjunctions = useAppStore((s) => s.conjunctions);
  const selectedSatelliteId = useAppStore((s) => s.selectedSatelliteId);
  const selectSatellite = useAppStore((s) => s.selectSatellite);
  const activeFilters = useAppStore((s) => s.activeFilters);
  const isPlaying = useAppStore((s) => s.isPlaying);

  // Filter positions based on active filters
  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      const type = p.object_type?.toUpperCase();
      if (!activeFilters.payload && (type === 'PAYLOAD' || type === 'UNKNOWN' || type === 'TBA' || !type)) return false;
      if (!activeFilters.debris && type === 'DEBRIS') return false;
      if (!activeFilters.rocketBody && type === 'ROCKET BODY') return false;
      return true;
    });
  }, [positions, activeFilters]);

  // Compute data for globe points
  const globePoints = useMemo(() => {
    // Collect NORAD IDs of objects involved in conjunctions
    const conjunctionNoradIds = new Set();
    conjunctions.forEach(c => {
      conjunctionNoradIds.add(c.object1_norad_id);
      conjunctionNoradIds.add(c.object2_norad_id);
    });

    // Create a lookup map for positions by norad_id
    const posMap = {};
    for (const p of positions) {
      if (p && p.norad_id) {
        posMap[p.norad_id] = p;
      }
    }

    return filteredPositions
      .filter((sat) => conjunctionNoradIds.has(sat.norad_id) || sat.norad_id === selectedSatelliteId)
      .map((sat) => {
      const pos = posMap[sat.norad_id];
      if (!pos) return null;
      return {
        lat: pos.latitude,
        lng: pos.longitude,
        alt: Math.min(pos.altitude_km / 6371 / 4, 0.15),
        name: pos.name,
        norad_id: pos.norad_id,
        object_type: pos.object_type,
        color: getObjectTypeColor(pos.object_type),
        size: selectedSatelliteId === pos.norad_id ? 1.2 : 0.35,
      };
    }).filter(Boolean);
  }, [filteredPositions, positions, selectedSatelliteId]);

  // Convert conjunctions to arcs
  const conjunctionArcs = useMemo(() => {
    return conjunctions
      .filter(
        (c) =>
          c.obj1_lat != null &&
          c.obj1_lon != null &&
          c.obj2_lat != null &&
          c.obj2_lon != null
      )
      .map((c) => ({
        startLat: c.obj1_lat,
        startLng: c.obj1_lon,
        endLat: c.obj2_lat,
        endLng: c.obj2_lon,
        color: getRiskColor(c.risk_score),
        risk_score: c.risk_score,
        label: `${c.object1_name} ↔ ${c.object2_name}`,
      }));
  }, [conjunctions]);

  const [size, setSize] = useState({ width: 0, height: 0 });

  // Initial globe setup
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 20, lng: 77, altitude: 2.5 }, 0);
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.3;
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
      }
    }
  }, []);

  // Sync auto-rotation with play/pause state
  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = isPlaying;
      }
    }
  }, [isPlaying]);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Zoom to selected satellite
  useEffect(() => {
    if (selectedSatelliteId && globeRef.current) {
      const sat = positions.find((p) => p.norad_id === selectedSatelliteId);
      if (sat) {
        globeRef.current.pointOfView(
          { lat: sat.latitude, lng: sat.longitude, altitude: 1.5 },
          1000
        );
      }
    }
  }, [selectedSatelliteId, positions]);

  const handlePointClick = useCallback(
    (point) => {
      selectSatellite(point.norad_id);
    },
    [selectSatellite]
  );

  return (
    <div ref={containerRef} className="app-globe" id="globe-container">
      <Globe
        width={size.width || undefined}
        height={size.height || undefined}
        ref={globeRef}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#4db8ff"
        atmosphereAltitude={0.18}
        pointsData={globePoints}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="alt"
        pointColor="color"
        pointRadius="size"
        pointsMerge={true}
        onPointClick={handlePointClick}
        pointLabel={(pt) => {
          return `<div style="
            background: rgba(10, 14, 26, 0.9);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(100, 160, 255, 0.2);
            border-radius: 8px;
            padding: 8px 12px;
            font-family: Inter, sans-serif;
            font-size: 12px;
            color: #e8edf5;
            max-width: 200px;
          ">
            <div style="font-weight: 700; color: ${pt.color};">${pt.name}</div>
            <div style="font-family: JetBrains Mono; font-size: 10px; color: #556680; margin-top: 2px;">
              NORAD ${pt.norad_id} · ${pt.object_type}
            </div>
          </div>`;
        }}
        arcsData={conjunctionArcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={1500}
        arcStroke={0.5}
        arcLabel={(arc) => {
          return `<div style="
            background: rgba(10, 14, 26, 0.9);
            backdrop-filter: blur(8px);
            border: 1px solid ${arc.color}40;
            border-radius: 8px;
            padding: 8px 12px;
            font-family: Inter, sans-serif;
            font-size: 12px;
            color: #e8edf5;
          ">
            <div style="font-weight: 700; color: ${arc.color};">⚠ Conjunction</div>
            <div style="font-size: 11px; margin-top: 4px;">${arc.label}</div>
            <div style="font-family: JetBrains Mono; font-size: 11px; color: ${arc.color}; margin-top: 2px;">
              Risk: ${arc.risk_score}/100
            </div>
          </div>`;
        }}
        animateIn={true}
      />
    </div>
  );
}
