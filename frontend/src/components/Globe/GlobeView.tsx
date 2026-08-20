/**
 * 3D Globe visualization using react-globe.gl.
 *
 * Renders satellites as color-coded points, orbit paths, and
 * conjunction events as pulsing ring markers on an interactive Earth.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { useAppStore } from '../../store/appStore';
import { getObjectTypeColor, getRiskColor } from '../../types';

interface GlobePoint {
  lat: number;
  lng: number;
  alt: number;
  name: string;
  norad_id: number;
  object_type: string;
  color: string;
  size: number;
}

interface ConjunctionArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  risk_score: number;
  label: string;
}

export default function GlobeView() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const positions = useAppStore((s) => s.positions);
  const conjunctions = useAppStore((s) => s.conjunctions);
  const selectedSatelliteId = useAppStore((s) => s.selectedSatelliteId);
  const selectSatellite = useAppStore((s) => s.selectSatellite);
  const activeFilters = useAppStore((s) => s.activeFilters);

  // Filter positions based on active filters
  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      const type = p.object_type?.toUpperCase();
      if (type === 'PAYLOAD' && !activeFilters.payload) return false;
      if (type === 'DEBRIS' && !activeFilters.debris) return false;
      if (type === 'ROCKET BODY' && !activeFilters.rocketBody) return false;
      return true;
    });
  }, [positions, activeFilters]);

  // Convert to globe points
  const globePoints: GlobePoint[] = useMemo(() => {
    return filteredPositions.map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      alt: Math.min(p.altitude_km / 6371 / 4, 0.15), // normalize altitude for globe
      name: p.name,
      norad_id: p.norad_id,
      object_type: p.object_type,
      color: getObjectTypeColor(p.object_type),
      size: selectedSatelliteId === p.norad_id ? 1.2 : 0.35,
    }));
  }, [filteredPositions, selectedSatelliteId]);

  // Convert conjunctions to arcs
  const conjunctionArcs: ConjunctionArc[] = useMemo(() => {
    return conjunctions
      .filter(
        (c) =>
          c.obj1_lat != null &&
          c.obj1_lon != null &&
          c.obj2_lat != null &&
          c.obj2_lon != null
      )
      .map((c) => ({
        startLat: c.obj1_lat!,
        startLng: c.obj1_lon!,
        endLat: c.obj2_lat!,
        endLng: c.obj2_lon!,
        color: getRiskColor(c.risk_score),
        risk_score: c.risk_score,
        label: `${c.object1_name} ↔ ${c.object2_name}`,
      }));
  }, [conjunctions]);

  // Initial globe setup
  useEffect(() => {
    if (globeRef.current) {
      // Set initial view
      globeRef.current.pointOfView({ lat: 20, lng: 77, altitude: 2.5 }, 0);

      // Camera controls
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.3;
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
      }
    }
  }, []);

  // Zoom to selected satellite
  useEffect(() => {
    if (selectedSatelliteId && globeRef.current) {
      const sat = positions.find((p) => p.norad_id === selectedSatelliteId);
      if (sat) {
        globeRef.current.pointOfView(
          {
            lat: sat.latitude,
            lng: sat.longitude,
            altitude: 1.5,
          },
          1000
        );
      }
    }
  }, [selectedSatelliteId, positions]);

  const handlePointClick = useCallback(
    (point: object) => {
      const p = point as GlobePoint;
      selectSatellite(p.norad_id);
    },
    [selectSatellite]
  );

  return (
    <div ref={containerRef} className="app-globe" id="globe-container">
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#4db8ff"
        atmosphereAltitude={0.18}
        // Satellite points
        pointsData={globePoints}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="alt"
        pointColor="color"
        pointRadius="size"
        pointsMerge={false}
        onPointClick={handlePointClick}
        pointLabel={(p: object) => {
          const pt = p as GlobePoint;
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
        // Conjunction arcs
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
        arcLabel={(a: object) => {
          const arc = a as ConjunctionArc;
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
        // Performance
        animateIn={true}
        width={undefined}
        height={undefined}
      />
    </div>
  );
}
