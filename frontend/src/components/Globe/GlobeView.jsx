/**
 * 3D Globe visualization using react-globe.gl.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { useAppStore } from '../../store/appStore';
import { getObjectTypeColor, getRiskColor } from '../../types';

const pointLabelFn = (pt) => `
  <div style="background:rgba(10,14,26,0.95);backdrop-filter:blur(8px);
              border:1px solid rgba(100,160,255,0.25);border-radius:8px;
              padding:8px 12px;font-family:Inter,sans-serif;font-size:12px;
              color:#e8edf5;max-width:220px;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
    <div style="font-weight:700;color:${pt.color};font-size:13px;">${pt.name}</div>
    <div style="font-size:10px;color:#8899b4;margin-top:2px;font-family:monospace;">
      NORAD ${pt.norad_id} · ${pt.object_type}
    </div>
  </div>`;

const arcLabelFn = (arc) => `
  <div style="background:rgba(10,14,26,0.95);backdrop-filter:blur(8px);
              border:1px solid ${arc.color}60;border-radius:8px;
              padding:8px 12px;font-family:Inter,sans-serif;font-size:12px;
              color:#e8edf5;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
    <div style="font-weight:700;color:${arc.color};">⚠ Conjunction Alert</div>
    <div style="font-size:11px;margin-top:4px;color:#e8edf5;">${arc.label}</div>
    <div style="font-size:11px;color:${arc.color};margin-top:2px;font-family:monospace;font-weight:700;">
      Risk Score: ${arc.risk_score}/100
    </div>
  </div>`;

export default function GlobeView() {
  const globeRef     = useRef(null);
  const containerRef = useRef(null);

  const positions             = useAppStore((s) => s.positions);
  const conjunctions          = useAppStore((s) => s.conjunctions);
  const selectedSatelliteId   = useAppStore((s) => s.selectedSatelliteId);
  const selectedConjunctionId = useAppStore((s) => s.selectedConjunctionId);
  const selectSatellite       = useAppStore((s) => s.selectSatellite);
  const selectConjunction     = useAppStore((s) => s.selectConjunction);
  const activeFilters         = useAppStore((s) => s.activeFilters);
  const activeOrbits          = useAppStore((s) => s.activeOrbits);

  // Filter positions by active filters
  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      const type = p.object_type?.toUpperCase();
      if (!activeFilters.payload && (type === 'PAYLOAD' || type === 'UNKNOWN' || type === 'TBA' || !type)) return false;
      if (!activeFilters.debris && type === 'DEBRIS') return false;
      if (!activeFilters.rocketBody && type === 'ROCKET BODY') return false;
      return true;
    });
  }, [positions, activeFilters]);

  // Points on globe: conjunction objects in real-time orbits + selected satellite
  const globePoints = useMemo(() => {
    const conjunctionNoradIds = new Set();
    conjunctions.forEach((c) => {
      if (c.object1_norad_id) conjunctionNoradIds.add(c.object1_norad_id);
      if (c.object2_norad_id) conjunctionNoradIds.add(c.object2_norad_id);
    });

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
        const isSelected = selectedSatelliteId === pos.norad_id;
        return {
          lat: pos.latitude,
          lng: pos.longitude,
          alt: Math.min(pos.altitude_km / 6371 / 4, 0.15),
          name: pos.name,
          norad_id: pos.norad_id,
          object_type: pos.object_type,
          color: isSelected ? '#00d4ff' : getObjectTypeColor(pos.object_type),
          size: isSelected ? 0.7 : 0.4,
        };
      })
      .filter(Boolean);
  }, [filteredPositions, positions, selectedSatelliteId, conjunctions]);

  // Conjunction arcs connecting objects
  const conjunctionArcs = useMemo(() => {
    return conjunctions
      .filter((c) => c.obj1_lat != null && c.obj1_lon != null && c.obj2_lat != null && c.obj2_lon != null)
      .map((c) => {
        const isSelected = selectedConjunctionId === c.id;
        const color = getRiskColor(c.risk_score);
        return {
          id: c.id,
          object1_norad_id: c.object1_norad_id,
          object2_norad_id: c.object2_norad_id,
          startLat: c.obj1_lat,
          startLng: c.obj1_lon,
          endLat:   c.obj2_lat,
          endLng:   c.obj2_lon,
          color: selectedConjunctionId && !isSelected ? color + '30' : color,
          risk_score: c.risk_score,
          label: `${c.object1_name || c.object1_norad_id} ↔ ${c.object2_name || c.object2_norad_id}`,
          isSelected,
        };
      });
  }, [conjunctions, selectedConjunctionId]);

  // Initial globe setup
  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView({ lat: 20, lng: 77, altitude: 2.2 }, 0);
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate    = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
    }
  }, []);

  // Zoom to selection:
  // 1. If an individual satellite is selected, move globe camera to that satellite's position.
  // 2. If a conjunction is selected (and no individual satellite is focused), move globe camera to the conjunction event location.
  useEffect(() => {
    if (!globeRef.current) return;
    if (selectedSatelliteId) {
      const sat = positions.find((p) => p.norad_id === selectedSatelliteId);
      if (sat && sat.latitude != null && sat.longitude != null) {
        globeRef.current.pointOfView({ lat: sat.latitude, lng: sat.longitude, altitude: 1.2 }, 1000);
      }
    } else if (selectedConjunctionId) {
      const conj = conjunctions.find((c) => c.id === selectedConjunctionId);
      if (conj && conj.obj1_lat != null && conj.obj2_lat != null) {
        const lat = (conj.obj1_lat + conj.obj2_lat) / 2;
        let lon1 = conj.obj1_lon, lon2 = conj.obj2_lon;
        if (Math.abs(lon1 - lon2) > 180) {
          if (lon1 < 0) lon1 += 360;
          if (lon2 < 0) lon2 += 360;
        }
        let lon = (lon1 + lon2) / 2;
        if (lon > 180) lon -= 360;
        globeRef.current.pointOfView({ lat, lng: lon, altitude: 1.2 }, 1000);
      }
    }
  }, [selectedConjunctionId, selectedSatelliteId, conjunctions, positions]);

  const handlePointClick = useCallback((point) => {
    if (selectedSatelliteId === point.norad_id) {
      selectSatellite(null);
    } else {
      selectSatellite(point.norad_id);
    }
  }, [selectSatellite, selectedSatelliteId]);

  const handleArcClick = useCallback((arc) => {
    if (selectedConjunctionId === arc.id) {
      if (selectedSatelliteId !== null) {
        selectSatellite(null);
      } else {
        selectConjunction(null);
      }
    } else {
      selectConjunction(arc.id);
      selectSatellite(null); // point to conjunction event location
    }
  }, [selectedConjunctionId, selectedSatelliteId, selectConjunction, selectSatellite]);

  return (
    <div ref={containerRef} className="app-globe" id="globe-container" style={{ width: '100%', height: '100%' }}>
      <Globe
        ref={globeRef}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#4db8ff"
        atmosphereAltitude={0.18}
        // Points
        pointsData={globePoints}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="alt"
        pointColor="color"
        pointRadius="size"
        onPointClick={handlePointClick}
        pointLabel={pointLabelFn}
        // Arcs
        arcsData={conjunctionArcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={1500}
        arcStroke={0.6}
        onArcClick={handleArcClick}
        arcLabel={arcLabelFn}
        // Paths
        pathsData={activeOrbits}
        pathPoints="path"
        pathPointLat={(p) => p[0]}
        pathPointLng={(p) => p[1]}
        pathPointAlt={(p) => p[2]}
        pathColor="color"
        pathStroke={1}
        pathDashLength={0.4}
        pathDashGap={0.02}
        pathDashAnimateTime={3000}
        animateIn={true}
      />
    </div>
  );
}
