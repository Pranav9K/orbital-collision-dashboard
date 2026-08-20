/**
 * API client for the Flask backend.
 * All endpoints are proxied through Vite's dev server config.
 */

import type {
  Satellite,
  SatellitePosition,
  ConjunctionEvent,
  TimelinePoint,
  CatalogStats,
} from '../types';

const BASE_URL = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((error as { error?: string }).error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ---- Satellites ----

export async function fetchSatellites(params?: {
  type?: string;
  group?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<{ satellites: Satellite[]; total: number; page: number; pages: number }> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.group) searchParams.set('group', params.group);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.per_page) searchParams.set('per_page', String(params.per_page));

  const qs = searchParams.toString();
  return fetchJson(`${BASE_URL}/satellites${qs ? `?${qs}` : ''}`);
}

export async function fetchSatelliteById(noradId: number): Promise<Satellite> {
  return fetchJson(`${BASE_URL}/satellites/${noradId}`);
}

export async function fetchCatalogStats(): Promise<CatalogStats> {
  return fetchJson(`${BASE_URL}/satellites/stats`);
}

export async function triggerRefresh(): Promise<{ status: string; summary: Record<string, number> }> {
  return fetchJson(`${BASE_URL}/satellites/refresh`, { method: 'POST' });
}

// ---- Positions ----

export async function fetchPositions(params?: {
  time?: string;
  type?: string;
  group?: string;
}): Promise<{ time: string; count: number; positions: SatellitePosition[] }> {
  const searchParams = new URLSearchParams();
  if (params?.time) searchParams.set('time', params.time);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.group) searchParams.set('group', params.group);

  const qs = searchParams.toString();
  return fetchJson(`${BASE_URL}/positions${qs ? `?${qs}` : ''}`);
}

export async function fetchOrbitPath(
  noradId: number,
  params?: { start?: string; end?: string; step?: number }
): Promise<{
  norad_id: number;
  name: string;
  orbit: Array<{ time: string; latitude: number; longitude: number; altitude_km: number }>;
}> {
  const searchParams = new URLSearchParams();
  if (params?.start) searchParams.set('start', params.start);
  if (params?.end) searchParams.set('end', params.end);
  if (params?.step) searchParams.set('step', String(params.step));

  const qs = searchParams.toString();
  return fetchJson(`${BASE_URL}/positions/${noradId}${qs ? `?${qs}` : ''}`);
}

// ---- Conjunctions ----

export async function fetchConjunctions(params?: {
  status?: string;
  min_risk?: number;
  limit?: number;
}): Promise<{ count: number; conjunctions: ConjunctionEvent[] }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.min_risk) searchParams.set('min_risk', String(params.min_risk));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return fetchJson(`${BASE_URL}/conjunctions${qs ? `?${qs}` : ''}`);
}

export async function fetchAlerts(threshold?: number): Promise<{
  threshold: number;
  count: number;
  alerts: ConjunctionEvent[];
}> {
  const qs = threshold ? `?threshold=${threshold}` : '';
  return fetchJson(`${BASE_URL}/conjunctions/alerts${qs}`);
}

export async function triggerScreening(params?: {
  horizon_hours?: number;
  threshold_km?: number;
}): Promise<{ status: string; count: number }> {
  return fetchJson(`${BASE_URL}/conjunctions/screen`, {
    method: 'POST',
    body: JSON.stringify(params || {}),
  });
}

export async function fetchTimeline(params?: {
  start?: string;
  end?: string;
  bins?: number;
}): Promise<{
  start: string;
  end: string;
  bins: number;
  timeline: TimelinePoint[];
}> {
  const searchParams = new URLSearchParams();
  if (params?.start) searchParams.set('start', params.start);
  if (params?.end) searchParams.set('end', params.end);
  if (params?.bins) searchParams.set('bins', String(params.bins));

  const qs = searchParams.toString();
  return fetchJson(`${BASE_URL}/conjunctions/timeline${qs ? `?${qs}` : ''}`);
}

// ---- Health ----

export async function checkHealth(): Promise<{ status: string; message: string }> {
  return fetchJson(`${BASE_URL}/health`);
}
