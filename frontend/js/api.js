// api.js — Aarogya AI
// All backend API constants and fetch helpers live here.

const CHAT_API_BASE      = window.__AAROGYA_CHAT_API_BASE__ || 'http://127.0.0.1:8000';
const CHAT_API_URL       = `${CHAT_API_BASE}/chat`;
const CHAT_HEALTH_URL    = `${CHAT_API_BASE}/health`;
const HOTSPOTS_API_URL   = `${CHAT_API_BASE}/hotspots`;
const CITY_SEARCH_API_URL = `${CHAT_API_BASE}/search`;
const CITY_ANALYTICS_API_URL = `${CHAT_API_BASE}/city-analytics`;

/**
 * Fetch hotspot data from backend.
 * @param {string} sortBy  - 'active_cases' | 'growth_rate'
 * @param {number} limit   - max results
 * @returns {Promise<Array>} hotspots array
 */
async function apiFetchHotspots(sortBy = 'active_cases', limit = 50) {
    const resp = await fetch(`${HOTSPOTS_API_URL}?sort_by=${sortBy}&limit=${limit}`);
    if (!resp.ok) throw new Error(`Hotspots fetch failed: ${resp.status}`);
    const data = await resp.json();
    return data.hotspots || [];
}

/**
 * Search for a city from backend.
 * @param {string} city
 * @returns {Promise<Object>} city data
 */
async function apiFetchCity(city) {
    const resp = await fetch(`${CITY_SEARCH_API_URL}?city=${encodeURIComponent(city)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || 'City lookup failed');
    return data;
}

/**
 * Fetch top 5 diseases for a city from AI analytics.
 * @param {string} city
 * @returns {Promise<Array>} diseases list
 */
async function apiFetchCityAnalytics(city) {
    const resp = await fetch(`${CITY_ANALYTICS_API_URL}?city=${encodeURIComponent(city)}`);
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || 'Analytics lookup failed');
    }
    return await resp.json();
}

/**
 * Post a chat message to the backend.
 * @param {string} message
 * @param {Object} outbreakContext
 * @returns {Promise<string>} response text
 */
async function apiPostChat(message, outbreakContext) {
    const resp = await fetch(CHAT_API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message, outbreak_context: outbreakContext })
    });
    if (!resp.ok) {
        let detail = '';
        try { const err = await resp.json(); detail = err?.detail || ''; } catch (_) {}
        throw new Error(detail || `Request failed: ${resp.status}`);
    }
    const data = await resp.json();
    if (!data || typeof data.response !== 'string') throw new Error('Invalid response from server');
    return data.response;
}

/**
 * Ping the backend health endpoint.
 * @returns {Promise<boolean>}
 */
async function apiHealthCheck() {
    try {
        const resp = await fetch(CHAT_HEALTH_URL, { method: 'GET' });
        return resp.ok;
    } catch (_) {
        return false;
    }
}
