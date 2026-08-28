/**
 * 3D Globe visualization using react-globe.gl.
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { useAppStore } from '../../store/appStore';
import { getObjectTypeColor, getRiskColor } from '../../types';

/** Build a detailed 3D satellite mesh. Defined outside component to avoid recreation on re-renders. */
function buildSatelliteMesh(color) {
  const group = new THREE.Group();

  // Core body — metallic box
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#c8d8e8', metalness: 0.9, roughness: 0.15 });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bodyMat));

  // Solar panels
  const panelMat = new THREE.MeshStandardMaterial({
    color: '#1a4e8a', metalness: 0.8, roughness: 0.3,
    emissive: '#0a2a55', emissiveIntensity: 0.6,
  });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.06, 1.1), panelMat));

  // Antenna
  const antMat = new THREE.MeshStandardMaterial({ color: '#ffcc00', metalness: 1, roughness: 0 });
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 12), antMat);
  antenna.position.y = 1.0;
  group.add(antenna);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.3, 16), antMat);
  cap.position.y = 1.7;
  group.add(cap);

  // Selection ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2, 2.35, 48),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  return group;
}

const pointLabelFn = (pt) => `
  <div style="background:rgba(10,14,26,0.92);backdrop-filter:blur(8px);
              border:1px solid rgba(100,160,255,0.22);border-radius:8px;
              padding:8px 12px;font-family:Inter,sans-serif;font-size:12px;
              color:#e8edf5;max-width:200px;">
    <div style="font-weight:700;color:${pt.color};">${pt.name}</div>
    <div style="font-size:10px;color:#556680;margin-top:2px;">NORAD ${pt.norad_id} · ${pt.object_type}</div>
  </div>`;

const arcLabelFn = (arc) => `
  <div style="background:rgba(10,14,26,0.92);backdrop-filter:blur(8px);
              border:1px solid ${arc.color}40;border-radius:8px;
              padding:8px 12px;font-family:Inter,sans-serif;font-size:12px;color:#e8edf5;">
    <div style="font-weight:700;color:${arc.color};">⚠ Conjunction</div>
    <div style="font-size:11px;margin-top:4px;">${arc.label}</div>
    <div style="font-size:11px;color:${arc.color};margin-top:2px;">Risk: ${arc.risk_score}/100</div>
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
  const activeFilters     = useAppStore((s) => s.activeFilters);
  const isPlaying         = useAppStore((s) => s.isPlaying);
  const conjSortField     = useAppStore((s) => s.conjSortField);
  const conjSortAsc       = useAppStore((s) => s.conjSortAsc);

  // Sorted conjunctions
  const visibleConjunctions = useMemo(() => {
    return [...conjunctions]
      .sort((a, b) => {
        let cmp = 0;
        if (conjSortField === 'risk_score')            cmp = a.risk_score - b.risk_score;
        else if (conjSortField === 'miss_distance_km') cmp = a.miss_distance_km - b.miss_distance_km;
        else if (conjSortField === 'tca')              cmp = new Date(a.tca) - new Date(b.tca);
        return conjSortAsc ? cmp : -cmp;
      })
      .slice(0, 50);
  }, [conjunctions, conjSortField, conjSortAsc]);

  // NORAD IDs shown as 3D models (skip regular dot for these)
  const selectedNoradIds = useMemo(() => {
    const ids = new Set();
    if (selectedSatId) ids.add(selectedSatId);
    if (selectedConjId) {
      const conj = conjunctions.find((c) => c.id === selectedConjId);
      if (conj) { ids.add(conj.object1_norad_id); ids.add(conj.object2_norad_id); }
    }
    return ids;
  }, [selectedSatId, selectedConjId, conjunctions]);

  // NORAD IDs involved in any visible conjunction
  const conjunctionNoradIds = useMemo(() => {
    const ids = new Set();
    visibleConjunctions.forEach((c) => { ids.add(c.object1_norad_id); ids.add(c.object2_norad_id); });
    return ids;
  }, [visibleConjunctions]);

  // Positions filtered by type
  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      const type = p.object_type?.toUpperCase();
      if (!activeFilters.payload    && (type === 'PAYLOAD' || type === 'UNKNOWN' || type === 'TBA' || !type)) return false;
      if (!activeFilters.debris     && type === 'DEBRIS')      return false;
      if (!activeFilters.rocketBody && type === 'ROCKET BODY') return false;
      return true;
    });
  }, [positions, activeFilters]);

  // Regular dots (exclude 3D-model objects)
  const globePoints = useMemo(() => {
    const posMap = Object.fromEntries(positions.map((p) => [p.norad_id, p]));
    return filteredPositions
      .filter((sat) =>
        (conjunctionNoradIds.has(sat.norad_id) || sat.norad_id === selectedSatId) &&
        !selectedNoradIds.has(sat.norad_id)
      )
      .map((sat) => {
        const pos = posMap[sat.norad_id];
        if (!pos) return null;
        return {
          lat: pos.latitude, lng: pos.longitude,
          alt: Math.min(pos.altitude_km / 6371 / 4, 0.15),
          name: pos.name, norad_id: pos.norad_id, object_type: pos.object_type,
          color: getObjectTypeColor(pos.object_type), size: 0.4,
        };
      })
      .filter(Boolean);
  }, [filteredPositions, positions, selectedSatId, selectedNoradIds, conjunctionNoradIds]);

  // Data for 3D satellite models
  const selectedObjectsData = useMemo(() => {
    return Array.from(selectedNoradIds)
      .map((id) => {
        const pos = positions.find((p) => p.norad_id === id);
        if (!pos) return null;
        return {
          lat: pos.latitude, lng: pos.longitude,
          alt: Math.min(pos.altitude_km / 6371 / 4, 0.15),
          color: getObjectTypeColor(pos.object_type),
          name: pos.name, norad_id: pos.norad_id, object_type: pos.object_type,
        };
      })
      .filter(Boolean);
  }, [positions, selectedNoradIds]);

  // Conjunction arcs
  const conjunctionArcs = useMemo(() => {
    return visibleConjunctions
      .filter((c) => c.obj1_lat != null && c.obj1_lon != null && c.obj2_lat != null && c.obj2_lon != null)
      .map((c) => {
        const isSelected = selectedConjId === c.id;
        const color = getRiskColor(c.risk_score);
        return {
          id: c.id,
          object1_norad_id: c.object1_norad_id,
          startLat: c.obj1_lat, startLng: c.obj1_lon,
          endLat:   c.obj2_lat, endLng:   c.obj2_lon,
          color: selectedConjId && !isSelected ? color + '40' : color,
          risk_score: c.risk_score,
          label: `${c.object1_name} ↔ ${c.object2_name}`,
          isSelected,
        };
      });
  }, [visibleConjunctions, selectedConjId]);

  const [size] = [{}]; // unused — removed broken width/height state

  // Initial globe setup
  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView({ lat: 20, lng: 77, altitude: 2.5 }, 0);
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate      = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableDamping   = true;
      controls.dampingFactor   = 0.1;
    }
  }, []);

  // Sync auto-rotate with play state
  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = isPlaying;
  }, [isPlaying]);


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
        globeRef.current.pointOfView({ lat, lng: lon, altitude: 1.8 }, 1000);
      }
    } else if (selectedSatId) {
      const sat = positions.find((p) => p.norad_id === selectedSatId);
      if (sat) globeRef.current.pointOfView({ lat: sat.latitude, lng: sat.longitude, altitude: 1.5 }, 1000);
    }
  }, [selectedConjId, selectedSatId, conjunctions, positions]);

  const handlePointClick = useCallback((point) => {
    if (selectedSatId === point.norad_id) { selectSatellite(null); }
    else { selectSatellite(point.norad_id); selectConjunction(null); }
  }, [selectedSatId, selectSatellite, selectConjunction]);

  const handleArcClick = useCallback((arc) => {
    if (selectedConjId === arc.id) { selectConjunction(null); selectSatellite(null); }
    else { selectConjunction(arc.id); selectSatellite(arc.object1_norad_id); }
  }, [selectedConjId, selectConjunction, selectSatellite]);

  return (
    <div ref={containerRef} className="app-globe" id="globe-container" style={{ width: '100%', height: '100%' }}>
      <Globe
        ref={globeRef}
        // Textures — reliable unpkg CDN (CORS-safe)
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#4db8ff"
        atmosphereAltitude={0.18}
        // Regular dots
        pointsData={globePoints}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="alt"
        pointColor="color"
        pointRadius="size"
        onPointClick={handlePointClick}
        pointLabel={pointLabelFn}
        // 3D satellite models for selected objects
        objectsData={selectedObjectsData}
        objectLat="lat"
        objectLng="lng"
        objectAltitude="alt"
        objectThreeObject={(d) => buildSatelliteMesh(d.color)}
        objectLabel={pointLabelFn}
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
        arcStroke={(arc) => (arc.isSelected ? 1.5 : 0.5)}
        onArcClick={handleArcClick}
        arcLabel={arcLabelFn}
        animateIn={true}
      />
    </div>
  );
}
