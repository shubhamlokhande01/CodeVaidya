// map.js — Aarogya AI
// Leaflet map initialization, hotspot marker rendering, marker color updates.

function riskToColor(riskLevel) {
    const r = String(riskLevel || '').toLowerCase();
    if (r === 'high')   return 'red';
    if (r === 'medium') return 'yellow';
    return 'green';
}

function trendArrow(trend) {
    if (trend === 'increasing') return '↑';
    if (trend === 'decreasing') return '↓';
    return '→';
}

function initMap() {
    const map = L.map('map').setView([19.0, 76.0], 7);
    window.__AAROGYA_LEAFLET_MAP__ = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    refreshRealtimeHotspots();
    setInterval(refreshRealtimeHotspots, 7000);
}

async function refreshRealtimeHotspots() {
    try {
        const hotspots = await apiFetchHotspots('active_cases', 50);

        renderHotspotMarkers(hotspots);
        renderTopHotspots(hotspots.slice(0, 10));
        updateStatsFromHotspots(hotspots);

        // Make live district data available to chat and prediction form
        window.__AAROGYA_DISTRICTS__ = hotspots.map(h => ({
            name:         h.location_name,
            risk:         String(h.risk_level || 'Low').toLowerCase(),
            active_cases: h.active_cases,
            trend:        h.trend,
            growth_rate:  h.growth_rate
        }));

        // Update risk distribution pie chart (Plotly)
        if (typeof updateRiskDistributionChart === 'function') {
            updateRiskDistributionChart(hotspots);
        }

    } catch (error) {
        const listEl = document.getElementById('hotspots-top-list');
        if (listEl) listEl.innerHTML = '<div class="hotspot-item">Unable to load hotspots. Start backend and retry.</div>';
        console.error('[Map] Hotspot refresh failed:', error);
    }
}

function renderHotspotMarkers(hotspots) {
    const map = window.__AAROGYA_LEAFLET_MAP__;
    if (!map) return;

    if (window.__AAROGYA_HOTSPOT_LAYER__) window.__AAROGYA_HOTSPOT_LAYER__.clearLayers();
    const layer = window.__AAROGYA_HOTSPOT_LAYER__ || L.layerGroup().addTo(map);
    window.__AAROGYA_HOTSPOT_LAYER__ = layer;
    window.__AAROGYA_MARKERS__ = {};

    hotspots.forEach(row => {
        const color  = riskToColor(row.risk_level);
        const marker = L.circleMarker([row.latitude, row.longitude], {
            color, fillColor: color, fillOpacity: 0.85, radius: 8
        });
        marker.bindPopup(`
            <div style="line-height:1.5">
                <strong>${row.location_name}</strong><br/>
                Active Cases: ${row.active_cases}<br/>
                Total Cases:  ${row.total_cases}<br/>
                Risk Level:   ${row.risk_level}<br/>
                Trend:        ${row.trend}<br/>
                Growth Rate:  ${row.growth_rate > 0 ? '+' : ''}${row.growth_rate}%
            </div>
        `);
        marker.addTo(layer);
        window.__AAROGYA_MARKERS__[row.location_name] = marker;
    });
}

function renderTopHotspots(hotspots) {
    const listEl = document.getElementById('hotspots-top-list');
    if (!listEl) return;
    listEl.innerHTML = hotspots.map(h => {
        const arrow = trendArrow(h.trend);
        const cls   = h.trend === 'increasing' ? 'up' : h.trend === 'decreasing' ? 'down' : 'stable';
        return `
            <div class="hotspot-item">
                <div>
                    <div class="hotspot-city">${h.location_name}</div>
                    <div class="hotspot-meta">Active: ${h.active_cases} | Risk: ${h.risk_level}</div>
                </div>
                <div class="hotspot-trend ${cls}">${arrow} ${h.trend}</div>
            </div>`;
    }).join('');
}

function updateStatsFromHotspots(hotspots) {
    const high   = hotspots.filter(d => String(d.risk_level).toLowerCase() === 'high').length;
    const medium = hotspots.filter(d => String(d.risk_level).toLowerCase() === 'medium').length;
    const safe   = hotspots.filter(d => String(d.risk_level).toLowerCase() === 'low').length;

    const elActive    = document.getElementById('stat-active-alerts');
    const elHigh      = document.getElementById('stat-high');
    const elMedium    = document.getElementById('stat-medium');
    const elSafe      = document.getElementById('stat-safe');
    const elActiveSub = document.getElementById('stat-active-sub');

    if (elActive)    elActive.textContent    = String(Math.min(hotspots.length, 10));
    if (elHigh)      elHigh.textContent      = String(high);
    if (elMedium)    elMedium.textContent    = String(medium);
    if (elSafe)      elSafe.textContent      = String(safe);
    if (elActiveSub && hotspots[0]) elActiveSub.textContent = `Top: ${hotspots[0].location_name}`;
}

/**
 * Update a specific district's marker color (called by prediction form).
 */
function updateDistrictMarkerColor({ district, level }) {
    const markers = window.__AAROGYA_MARKERS__;
    if (!markers || !markers[district]) return;
    const color = level === 'High' ? 'red' : level === 'Medium' ? 'yellow' : 'green';
    markers[district].setStyle({ color, fillColor: color });
}
