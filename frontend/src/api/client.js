/**
 * API client for the Flask backend.
 * All endpoints are proxied through Vite's dev server config.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ---- Satellites ----

export async function fetchSatellites(params) {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.group) searchParams.set('group', params.group);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.per_page) searchParams.set('per_page', String(params.per_page));

  const qs = searchParams.toString();
  return fetchJson(`${BASE_URL}/satellites${qs ? `?${qs}` : ''}`);
}

export async function fetchSatelliteById(noradId) {
  return fetchJson(`${BASE_URL}/satellites/${noradId}`);
}

export async function fetchCatalogStats() {
  return fetchJson(`${BASE_URL}/satellites/stats`);
}

export async function triggerRefresh() {
  return fetchJson(`${BASE_URL}/satellites/refresh`, { method: 'POST' });
}

// ---- Positions ----

export async function fetchPositions(params) {
  const searchParams = new URLSearchParams();
  if (params?.time) searchParams.set('time', params.time);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.group) searchParams.set('group', params.group);

  const qs = searchParams.toString();
  return fetchJson(`${BASE_URL}/positions${qs ? `?${qs}` : ''}`);
}

export async function fetchOrbitPath(noradId, params) {
  const searchParams = new URLSearchParams();
  if (params?.start) searchParams.set('start', params.start);
  if (params?.end) searchParams.set('end', params.end);
  if (params?.step) searchParams.set('step', String(params.step));

  const qs = searchParams.toString();
  return fetchJson(`${BASE_URL}/positions/${noradId}${qs ? `?${qs}` : ''}`);
}

// ---- Conjunctions ----

export async function fetchConjunctions(params) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.min_risk) searchParams.set('min_risk', String(params.min_risk));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return fetchJson(`${BASE_URL}/conjunctions${qs ? `?${qs}` : ''}`);
}

export async function fetchAlerts(threshold) {
  const qs = threshold ? `?threshold=${threshold}` : '';
  return fetchJson(`${BASE_URL}/conjunctions/alerts${qs}`);
}

export async function triggerScreening(params) {
  return fetchJson(`${BASE_URL}/conjunctions/screen`, {
    method: 'POST',
    body: JSON.stringify(params || {}),
  });
}

export async function fetchTimeline(params) {
  const searchParams = new URLSearchParams();
  if (params?.start) searchParams.set('start', params.start);
  if (params?.end) searchParams.set('end', params.end);
  if (params?.bins) searchParams.set('bins', String(params.bins));

  const qs = searchParams.toString();
  return fetchJson(`${BASE_URL}/conjunctions/timeline${qs ? `?${qs}` : ''}`);
}

// ---- Health ----

export async function checkHealth() {
  return fetchJson(`${BASE_URL}/health`);
}
