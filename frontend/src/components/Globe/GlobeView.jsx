/**
 * 3D Globe visualization using react-globe.gl.
 *
 * RULES:
 * 1. By default, ONLY satellites involved in conjunction events are shown as dots.
 * 2. When a non-conjunction satellite is clicked in the sidebar, a temporary
 *    cyan marker appears on the globe at its location. Clicking it again removes it.
 * 3. Conjunction dots are larger (0.6) and prominent; temporary locate markers are smaller (0.3).
 * 4. Earth auto-rotation is disabled during playback so satellite orbital motion is clear and steady.
 * 5. No 3D mesh objects — only clean, high-performance dots and trajectory arcs.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { useAppStore } from '../../store/appStore';
import { getObjectTypeColor, getRiskColor } from '../../types';

const CONJUNCTION_DOT_SIZE = 0.6;  // Prominent size for high-risk conjunction objects
const TEMPORARY_DOT_SIZE   = 0.3;  // Smaller size for temporarily located object

const pointLabelFn = (pt) => `
  <div style="background:rgba(10,14,26,0.95);backdrop-filter:blur(8px);
              border:1px solid rgba(100,160,255,0.25);border-radius:8px;
              padding:8px 12px;font-family:Inter,sans-serif;font-size:12px;
              color:#e8edf5;max-width:220px;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
    <div style="font-weight:700;color:${pt.color};font-size:13px;">${pt.name}</div>
    <div style="font-size:10px;color:#8899b4;margin-top:2px;font-family:monospace;">
      NORAD ${pt.norad_id} · ${pt.object_type}
    </div>
    ${pt.isTemporary ? '<div style="font-size:10px;color:#00d4ff;margin-top:3px;">📍 Temporary Marker — click again to dismiss</div>' : ''}
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

  const positions         = useAppStore((s) => s.positions);
  const conjunctions      = useAppStore((s) => s.conjunctions);
  const selectedSatId     = useAppStore((s) => s.selectedSatelliteId);
  const selectedConjId    = useAppStore((s) => s.selectedConjunctionId);
  const selectSatellite   = useAppStore((s) => s.selectSatellite);
  const selectConjunction = useAppStore((s) => s.selectConjunction);

  // Build a set of NORAD IDs that are part of conjunction events
  const conjunctionNoradIds = useMemo(() => {
    const ids = new Set();
    conjunctions.forEach((c) => {
      if (c.object1_norad_id) ids.add(c.object1_norad_id);
      if (c.object2_norad_id) ids.add(c.object2_norad_id);
    });
    return ids;
  }, [conjunctions]);

  // Conjunction dots — ONLY objects from the conjunction events list
  const conjunctionPoints = useMemo(() => {
    const posMap = new Map();
    positions.forEach((p) => { if (p && p.norad_id) posMap.set(p.norad_id, p); });

    const satMap = new Map();

    conjunctions.forEach((c) => {
      // Object 1
      if (c.object1_norad_id && !satMap.has(c.object1_norad_id)) {
        const pos = posMap.get(c.object1_norad_id);
        const lat = pos ? pos.latitude : c.obj1_lat;
        const lng = pos ? pos.longitude : c.obj1_lon;
        const altKm = pos ? pos.altitude_km : (c.obj1_alt_km || 400);
        if (lat != null && lng != null) {
          satMap.set(c.object1_norad_id, {
            norad_id: c.object1_norad_id,
            name: c.object1_name || `NORAD ${c.object1_norad_id}`,
            object_type: pos?.object_type || 'PAYLOAD',
            lat, lng,
            alt: Math.min((altKm || 400) / 6371 / 4, 0.12),
            color: getObjectTypeColor(pos?.object_type || 'PAYLOAD'),
            size: CONJUNCTION_DOT_SIZE,
            isTemporary: false,
          });
        }
      }
      // Object 2
      if (c.object2_norad_id && !satMap.has(c.object2_norad_id)) {
        const pos = posMap.get(c.object2_norad_id);
        const lat = pos ? pos.latitude : c.obj2_lat;
        const lng = pos ? pos.longitude : c.obj2_lon;
        const altKm = pos ? pos.altitude_km : (c.obj2_alt_km || 400);
        if (lat != null && lng != null) {
          satMap.set(c.object2_norad_id, {
            norad_id: c.object2_norad_id,
            name: c.object2_name || `NORAD ${c.object2_norad_id}`,
            object_type: pos?.object_type || 'DEBRIS',
            lat, lng,
            alt: Math.min((altKm || 400) / 6371 / 4, 0.12),
            color: getObjectTypeColor(pos?.object_type || 'DEBRIS'),
            size: CONJUNCTION_DOT_SIZE,
            isTemporary: false,
          });
        }
      }
    });

    return Array.from(satMap.values());
  }, [conjunctions, positions]);

  // Temporary marker for a selected non-conjunction satellite
  const tempMarker = useMemo(() => {
    if (!selectedSatId) return null;
    if (conjunctionNoradIds.has(selectedSatId)) return null;

    const pos = positions.find((p) => p.norad_id === selectedSatId);
    if (!pos || pos.latitude == null || pos.longitude == null) return null;

    return {
      norad_id: pos.norad_id,
      name: pos.name || `NORAD ${pos.norad_id}`,
      object_type: pos.object_type || 'UNKNOWN',
      lat: pos.latitude,
      lng: pos.longitude,
      alt: Math.min((pos.altitude_km || 400) / 6371 / 4, 0.12),
      color: '#00d4ff',
      size: TEMPORARY_DOT_SIZE,
      isTemporary: true,
    };
  }, [selectedSatId, positions, conjunctionNoradIds]);

  // Combined points: conjunction dots + optional temp marker
  const allPoints = useMemo(() => {
    if (tempMarker) return [...conjunctionPoints, tempMarker];
    return conjunctionPoints;
  }, [conjunctionPoints, tempMarker]);

  // Conjunction arcs
  const conjunctionArcs = useMemo(() => {
    return conjunctions
      .filter((c) => c.obj1_lat != null && c.obj1_lon != null && c.obj2_lat != null && c.obj2_lon != null)
      .map((c) => {
        const isSelected = selectedConjId === c.id;
        const color = getRiskColor(c.risk_score);
        return {
          id: c.id,
          object1_norad_id: c.object1_norad_id,
          startLat: c.obj1_lat,  startLng: c.obj1_lon,
          endLat:   c.obj2_lat,  endLng:   c.obj2_lon,
          color: selectedConjId && !isSelected ? color + '30' : color,
          risk_score: c.risk_score,
          label: `${c.object1_name || c.object1_norad_id} ↔ ${c.object2_name || c.object2_norad_id}`,
          isSelected,
        };
      });
  }, [conjunctions, selectedConjId]);

  // Initial globe setup
  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView({ lat: 20, lng: 77, altitude: 2.2 }, 0);
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate      = false;
      controls.enableDamping   = true;
      controls.dampingFactor   = 0.1;
    }
  }, []);

  // Zoom to selection
  useEffect(() => {
    if (!globeRef.current) return;
    if (selectedConjId) {
      const conj = conjunctions.find((c) => c.id === selectedConjId);
      if (conj && conj.obj1_lat != null && conj.obj2_lat != null) {
        const lat = (conj.obj1_lat + conj.obj2_lat) / 2;
        let lon1 = conj.obj1_lon, lon2 = conj.obj2_lon;
        if (Math.abs(lon1 - lon2) > 180) {
          if (lon1 < 0) lon1 += 360;
          if (lon2 < 0) lon2 += 360;
        }
        let lon = (lon1 + lon2) / 2;
        if (lon > 180) lon -= 360;
        globeRef.current.pointOfView({ lat, lng: lon, altitude: 0.85 }, 1000);
      }
    } else if (selectedSatId) {
      const pos = positions.find((p) => p.norad_id === selectedSatId);
      if (pos && pos.latitude != null && pos.longitude != null) {
        globeRef.current.pointOfView({ lat: pos.latitude, lng: pos.longitude, altitude: 0.85 }, 1000);
      }
    }
  }, [selectedConjId, selectedSatId, conjunctions, positions]);

  const handlePointClick = useCallback((point) => {
    // If clicking a temporary marker, deselect it
    if (point.isTemporary) {
      selectSatellite(null);
      return;
    }
    // Toggle selection on conjunction dots
    if (selectedSatId === point.norad_id) {
      selectSatellite(null);
      selectConjunction(null);
    } else {
      selectSatellite(point.norad_id);
    }
  }, [selectedSatId, selectSatellite, selectConjunction]);

  const handleArcClick = useCallback((arc) => {
    if (selectedConjId === arc.id) {
      selectConjunction(null);
      selectSatellite(null);
    } else {
      selectConjunction(arc.id);
      selectSatellite(arc.object1_norad_id);
    }
  }, [selectedConjId, selectConjunction, selectSatellite]);

  return (
    <div ref={containerRef} className="app-globe" id="globe-container" style={{ width: '100%', height: '100%' }}>
      <Globe
        ref={globeRef}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#4db8ff"
        atmosphereAltitude={0.18}
        // Dots: conjunction objects + optional temporary selected marker
        pointsData={allPoints}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="alt"
        pointColor="color"
        pointRadius="size"
        pointsMerge={false}
        onPointClick={handlePointClick}
        pointLabel={pointLabelFn}
        // Explicitly clear any leftover 3D object layer
        objectsData={[]}
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
        arcStroke={0.8}
        onArcClick={handleArcClick}
        arcLabel={arcLabelFn}
        animateIn={true}
      />
    </div>
  );
}
