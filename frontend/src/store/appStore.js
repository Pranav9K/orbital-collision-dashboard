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
  selectedSatelliteId: null,
  selectedConjunctionId: null,
  simulationTime: new Date(),
  isPlaying: false,
  playbackSpeed: 1,
  isLoading: true,
  error: null,
  searchQuery: '',
  activeFilters: {
    payload: true,
    debris: true,
    rocketBody: true,
  },

  // Actions
  loadInitialData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [satResult, posResult, conjResult, alertResult, timelineResult, statsResult] =
        await Promise.allSettled([
          api.fetchSatellites({ per_page: 500 }),
          api.fetchPositions(),
          api.fetchConjunctions(),
          api.fetchAlerts(),
          api.fetchTimeline(),
          api.fetchCatalogStats(),
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
        isLoading: false,
      });
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

  selectSatellite: (id) => set({ selectedSatelliteId: id }),
  selectConjunction: (id) => set({ selectedConjunctionId: id }),
  setSimulationTime: (time) => set({ simulationTime: time }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleFilter: (filter) => {
    const current = get().activeFilters;
    set({
      activeFilters: { ...current, [filter]: !current[filter] },
    });
  },

  setError: (error) => set({ error }),
}));
