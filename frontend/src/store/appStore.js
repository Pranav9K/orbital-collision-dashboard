/**
 * Global application state using Zustand.
 */

import { create } from 'zustand';
import * as api from '../api/client';

export const useAppStore = create((set, get) => ({
  // Initial state
  satellites: [],
  positions: [],
  conjunctions: [],
  alerts: [],
  timeline: [],
  stats: null,
  activeOrbits: [],
  selectedSatelliteId: null,
  selectedConjunctionId: null,
  simulationTime: new Date(),
  isPlaying: false,
  playbackSpeed: 1,
  isLoading: true,
  loadingProgress: 0,
  loadingMessage: 'Initializing...',
  error: null,
  searchQuery: '',
  conjSortField: 'risk_score',
  conjSortAsc: false,
  activeFilters: {
    payload: true,
    debris: true,
    rocketBody: true,
  },

  // Actions
  loadInitialData: async () => {
    set({ isLoading: true, error: null, loadingProgress: 0, loadingMessage: 'Connecting to servers...' });
    try {
      let completed = 0;
      const updateProgress = (msg) => {
        completed++;
        set({ loadingProgress: (completed / 6) * 100, loadingMessage: msg });
      };

      const [satResult, posResult, conjResult, alertResult, timelineResult, statsResult] =
        await Promise.allSettled([
          api.fetchSatellites({ per_page: 20000 }).then(r => { updateProgress('Fetching satellite catalog...'); return r; }),
          api.fetchPositions().then(r => { updateProgress('Calculating orbital positions...'); return r; }),
          api.fetchConjunctions().then(r => { updateProgress('Screening conjunctions...'); return r; }),
          api.fetchAlerts().then(r => { updateProgress('Analyzing risk factors...'); return r; }),
          api.fetchTimeline().then(r => { updateProgress('Generating timeline...'); return r; }),
          api.fetchCatalogStats().then(r => { updateProgress('Finalizing data...'); return r; }),
        ]);

      set({
        satellites:
          satResult.status === 'fulfilled' ? satResult.value.satellites : [],
        positions:
          posResult.status === 'fulfilled' ? posResult.value.positions : [],
        conjunctions:
          conjResult.status === 'fulfilled' ? conjResult.value.conjunctions : [],
        alerts:
          alertResult.status === 'fulfilled' ? alertResult.value.alerts : [],
        timeline:
          timelineResult.status === 'fulfilled'
            ? timelineResult.value.timeline
            : [],
        stats:
          statsResult.status === 'fulfilled' ? statsResult.value : null,
      });
      
      // Keep loading screen up for a tiny bit to show 100%
      setTimeout(() => {
        set({ isLoading: false });
      }, 500);
      
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load data',
      });
    }
  },

  refreshPositions: async (time) => {
    try {
      const result = await api.fetchPositions({ time });
      set({ positions: result.positions });
    } catch (e) {
      console.error('Failed to refresh positions:', e);
    }
  },

  refreshConjunctions: async () => {
    try {
      const result = await api.fetchConjunctions();
      set({ conjunctions: result.conjunctions });
    } catch (e) {
      console.error('Failed to refresh conjunctions:', e);
    }
  },

  refreshAlerts: async () => {
    try {
      const result = await api.fetchAlerts();
      set({ alerts: result.alerts });
    } catch (e) {
      console.error('Failed to refresh alerts:', e);
    }
  },

  refreshTimeline: async () => {
    try {
      const result = await api.fetchTimeline();
      set({ timeline: result.timeline });
    } catch (e) {
      console.error('Failed to refresh timeline:', e);
    }
  },

  selectSatellite: async (id) => {
    set({ selectedSatelliteId: id, activeOrbits: [] });
    if (id) {
      try {
        const result = await api.fetchOrbitPath(id, { step: 60 });
        const path = result.orbit.map((pt) => [
          pt.latitude,
          pt.longitude,
          Math.min(pt.altitude_km / 6371 / 4, 0.15)
        ]);
        set({ activeOrbits: [{ norad_id: id, path, color: '#00d4ff' }] });
      } catch (e) {
        console.error('Failed to fetch orbit path:', e);
      }
    }
  },

  selectConjunction: async (id) => {
    set({ selectedConjunctionId: id, activeOrbits: [] });
    if (id) {
      const conjunction = get().conjunctions.find((c) => c.id === id);
      if (conjunction) {
        try {
          const promises = [];
          if (conjunction.object1_norad_id) {
            promises.push(
              api.fetchOrbitPath(conjunction.object1_norad_id, { step: 45 }).then((res) => ({
                norad_id: conjunction.object1_norad_id,
                name: conjunction.object1_name,
                path: res.orbit.map((pt) => [
                  pt.latitude,
                  pt.longitude,
                  Math.min(pt.altitude_km / 6371 / 4, 0.15)
                ]),
                color: '#00d4ff' // Neon Cyan for Object 1
              }))
            );
          }
          if (conjunction.object2_norad_id) {
            promises.push(
              api.fetchOrbitPath(conjunction.object2_norad_id, { step: 45 }).then((res) => ({
                norad_id: conjunction.object2_norad_id,
                name: conjunction.object2_name,
                path: res.orbit.map((pt) => [
                  pt.latitude,
                  pt.longitude,
                  Math.min(pt.altitude_km / 6371 / 4, 0.15)
                ]),
                color: '#fbbf24' // Vibrant Amber/Gold for Object 2
              }))
            );
          }
          const orbits = await Promise.all(promises);
          set({ activeOrbits: orbits });
        } catch (e) {
          console.error('Failed to fetch conjunction orbit paths:', e);
        }
      }
    }
  },
  setSimulationTime: (time) => set({ simulationTime: time }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setConjSort: (field, asc) => set({ conjSortField: field, conjSortAsc: asc }),

  toggleFilter: (filter) => {
    const current = get().activeFilters;
    set({
      activeFilters: { ...current, [filter]: !current[filter] },
    });
  },

  setError: (error) => set({ error }),
}));
