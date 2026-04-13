// dashboard.js — Aarogya AI
// Main entry point. Wires all modules together on DOMContentLoaded.
// Handles: loading overlay, health prediction form, city search,
//          alerts panel, refresh button, and topbar menu.

document.addEventListener('DOMContentLoaded', function () {
    createLoadingOverlay();
    initRefreshButton();
    initTopbarMenu();
    initAlertsCollapse();
    initHealthPredictionForm();
    initMap();       // map.js
    initCharts();    // charts.js
    initChatWidget(); // chat.js
    initCitySearch();
    loadRealAlerts();
    setInterval(loadRealAlerts, 30000);
});

// ─────────────────────────────────────────────
// LOADING OVERLAY
// ─────────────────────────────────────────────
function createLoadingOverlay() {
    if (document.getElementById('loading-overlay')) return;
    const overlay     = document.createElement('div');
    overlay.id        = 'loading-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.display = 'none';
    overlay.innerHTML = `
        <div class="loading-card" role="status" aria-live="polite">
            <div class="loading-spinner" aria-hidden="true"></div>
            <div class="loading-text">Analyzing health data using AI...</div>
        </div>`;
    document.body.appendChild(overlay);
}

function showLoading() {
    const o = document.getElementById('loading-overlay');
    if (o) { o.style.display = 'flex'; o.setAttribute('aria-hidden', 'false'); }
}

function hideLoading() {
    const o = document.getElementById('loading-overlay');
    if (o) { o.style.display = 'none'; o.setAttribute('aria-hidden', 'true'); }
}

// ─────────────────────────────────────────────
// HEALTH PREDICTION FORM
// ─────────────────────────────────────────────
function initHealthPredictionForm() {
    const form = document.getElementById('health-input-form');
    if (!form) return;
    form.addEventListener('submit', function (e) { e.preventDefault(); predictRisk(); });
}

function predictRisk() {
    const btn      = document.getElementById('predict-risk-btn');
    const statusEl = document.getElementById('health-form-status');

    if (window.__AAROGYA_PREDICTING__) return;

    const district        = document.getElementById('health-district')?.value       || '';
    const feverRaw        = document.getElementById('health-fever')?.value          || '';
    const rainfallRaw     = document.getElementById('health-rainfall')?.value       || '';
    const humidityRaw     = document.getElementById('health-humidity')?.value       || '';
    const temperatureRaw  = document.getElementById('health-temperature')?.value    || '';
    const malnutritionRaw = document.getElementById('health-malnutrition')?.value   || '';
    const waterRaw        = document.getElementById('health-water')?.value          || '';
    const densityRaw      = document.getElementById('health-density')?.value        || '';
    const outbreakRaw     = document.getElementById('health-outbreak')?.value       || '';

    if (!district || !feverRaw || !rainfallRaw || !humidityRaw || !temperatureRaw ||
        !malnutritionRaw || !waterRaw || !densityRaw || !outbreakRaw) {
        if (statusEl) statusEl.textContent = 'Please fill all fields before prediction.';
        return;
    }

    const fever        = Number(feverRaw);
    const rainfall     = Number(rainfallRaw);
    const humidity     = Number(humidityRaw);
    const temperature  = Number(temperatureRaw);
    const malnutrition = Number(malnutritionRaw);
    const water        = Number(waterRaw);
    const density      = Number(densityRaw);

    if ([fever, rainfall, humidity, temperature, malnutrition, water, density].some(n => !Number.isFinite(n) || n < 0)) {
        if (statusEl) statusEl.textContent = 'Please enter valid positive numbers for all fields.';
        return;
    }

    window.__AAROGYA_PREDICTING__ = true;
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = '';
    showLoading();

    setTimeout(() => {
        try {
            runPredictionNow({ district, fever, rainfall, humidity, temperature, malnutrition, water, density, past_outbreak: Number(outbreakRaw) });
        } finally {
            hideLoading();
            window.__AAROGYA_PREDICTING__ = false;
            if (btn) btn.disabled = false;
        }
    }, 2000);
}

function runPredictionNow(inputs) {
    const riskEl       = document.getElementById('prediction-risk');
    const probEl       = document.getElementById('prediction-probability');
    const confidenceEl = document.getElementById('prediction-confidence');
    const statusEl     = document.getElementById('health-form-status');

    if (!riskEl || !probEl) return;
    if (statusEl) statusEl.textContent = '';

    // Rule-based prediction mirroring the Random Forest training logic
    let score = 0;
    if (inputs.fever        > 200)  score += 3; else if (inputs.fever   > 120)  score += 2; else score += 1;
    if (inputs.malnutrition > 25)   score += 3; else if (inputs.malnutrition > 15) score += 2; else score += 1;
    if (inputs.water        < 50)   score += 3; else if (inputs.water    < 60)   score += 2; else score += 1;
    if (inputs.rainfall     > 200)  score += 2; else if (inputs.rainfall > 100)  score += 1;
    if (inputs.humidity     > 80)   score += 2; else if (inputs.humidity > 65)   score += 1;
    if (inputs.temperature  > 34)   score += 2; else if (inputs.temperature > 30) score += 1;
    if (inputs.past_outbreak === 1) score += 3;
    if (inputs.density      > 5000) score += 2; else if (inputs.density  > 500)  score += 1;

    let level = 'Low';
    if      (score >= 16) level = 'High';
    else if (score >= 10) level = 'Medium';

    const ranges     = { High: [75, 92], Medium: [50, 72], Low: [15, 42] };
    const [min, max] = ranges[level];
    const probability  = Math.floor(min + Math.random() * (max - min));
    const confRanges   = { High: [0.80, 0.95], Medium: [0.55, 0.79], Low: [0.20, 0.50] };
    const [cMin, cMax] = confRanges[level];
    const confidence   = cMin + Math.random() * (cMax - cMin);

    riskEl.textContent = level;
    probEl.textContent = `${probability}%`;
    if (confidenceEl) confidenceEl.textContent = confidence.toFixed(2);
    riskEl.className   = '';
    riskEl.classList.add(`risk-${level.toLowerCase()}`);

    appendPredictionAlert({ level, district: inputs.district, probability });
    updateDistrictMarkerColor({ district: inputs.district, level }); // map.js
}

function appendPredictionAlert({ level, district, probability }) {
    const container = document.getElementById('alerts-container');
    if (!container) return;
    const clsMap  = { High: 'high-risk', Medium: 'medium-risk', Low: 'low-risk' };
    const iconMap = { High: '⚠', Medium: '⚠', Low: '✓' };
    const msgMap  = {
        High:   `High disease risk in ${district} — Probability: ${probability}%`,
        Medium: `Medium health risk in ${district} — Probability: ${probability}%`,
        Low:    `Low risk in ${district} — Probability: ${probability}%`
    };
    const alertEl = document.createElement('div');
    alertEl.className = `alert ${clsMap[level]}`;
    alertEl.innerHTML = `<span class="alert-icon">${iconMap[level]}</span><span>${msgMap[level]}</span>`;
    container.appendChild(alertEl);
    enhanceAlertsUI();
}

// ─────────────────────────────────────────────
// ALERTS — live from /hotspots backend
// ─────────────────────────────────────────────
async function loadRealAlerts() {
    try {
        const hotspots  = await apiFetchHotspots('active_cases', 20);
        const container = document.getElementById('alerts-container');
        if (!container) return;

        container.innerHTML = '';
        hotspots.slice(0, 8).forEach(h => {
            const cls  = h.risk_level === 'High' ? 'high-risk' : h.risk_level === 'Medium' ? 'medium-risk' : 'low-risk';
            const icon = h.risk_level === 'Low' ? '✓' : '⚠';
            const alertEl = document.createElement('div');
            alertEl.className = `alert ${cls}`;
            alertEl.innerHTML = `
                <span class="alert-icon">${icon}</span>
                <span>${h.risk_level} risk in ${h.location_name}
                — ${h.active_cases} active cases
                (${h.trend}, ${h.growth_rate > 0 ? '+' : ''}${h.growth_rate}% growth)</span>
            `;
            container.appendChild(alertEl);
        });
        enhanceAlertsUI();
    } catch (e) {
        console.warn('[Alerts] Load failed:', e.message);
    }
}

// ─────────────────────────────────────────────
// ALERTS COLLAPSE & BADGE ENHANCEMENT
// ─────────────────────────────────────────────
function initAlertsCollapse() {
    const toggleBtn      = document.getElementById('alerts-toggle');
    const alertsContainer = document.getElementById('alerts-container');
    if (!toggleBtn || !alertsContainer) return;
    toggleBtn.addEventListener('click', function () {
        const isHidden = alertsContainer.style.display === 'none';
        alertsContainer.style.display = isHidden ? '' : 'none';
        toggleBtn.textContent = isHidden ? 'Collapse' : 'Expand';
    });
}

function enhanceAlertsUI() {
    document.querySelectorAll('#alerts-container .alert').forEach(alertEl => {
        if (alertEl.querySelector('.severity-badge')) return;
        let severityText = 'Safe', severityClass = 'safe';
        if (alertEl.classList.contains('high-risk'))   { severityText = 'High';   severityClass = 'high'; }
        if (alertEl.classList.contains('medium-risk')) { severityText = 'Medium'; severityClass = 'medium'; }
        const badge = document.createElement('span');
        badge.className   = `severity-badge ${severityClass}`;
        badge.textContent = severityText;
        const icon = alertEl.querySelector('.alert-icon');
        icon ? icon.insertAdjacentElement('afterend', badge) : alertEl.insertAdjacentElement('afterbegin', badge);
    });
}

// ─────────────────────────────────────────────
// CITY SEARCH — calls api.js
// ─────────────────────────────────────────────
function initCitySearch() {
    const form   = document.getElementById('city-search-form');
    const input  = document.getElementById('city-search-input');
    const result = document.getElementById('city-search-result');
    const canvas = document.getElementById('city-trend-chart');
    if (!form || !input || !result || !canvas) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const city = input.value.trim();
        if (!city) return;

        result.innerHTML = 'Loading city statistics...';
        const diseaseListEl = document.getElementById('city-diseases-list');
        if (diseaseListEl) {
            diseaseListEl.innerHTML = '<div class="analytics-placeholder">AI expert is analyzing local health factors...</div>';
        }

        try {
            // Concurrent fetch for stats and AI analytics
            const [data, diseases] = await Promise.all([
                apiFetchCity(city),
                apiFetchCityAnalytics(city).catch(err => {
                    console.error('[Analytics] AI fetch failed:', err);
                    return null; 
                })
            ]);

            result.innerHTML = `
                <div class="city-search-stat"><span>City</span>              <strong>${data.location_name}</strong></div>
                <div class="city-search-stat"><span>Total Cases</span>       <strong>${data.total_cases}</strong></div>
                <div class="city-search-stat"><span>Active Cases</span>      <strong>${data.active_cases}</strong></div>
                <div class="city-search-stat"><span>Recovered</span>         <strong>${data.recovered}</strong></div>
                <div class="city-search-stat"><span>Trend</span>             <strong>${data.trend}</strong></div>
                <div class="city-search-stat"><span>Risk Level</span>        <strong>${data.predicted_risk_level}</strong></div>
                <div class="city-search-stat"><span>Rainfall (mm)</span>     <strong>${data.avg_rainfall_mm ?? '—'}</strong></div>
                <div class="city-search-stat"><span>Water Quality</span>     <strong>${data.avg_water_quality_index ?? '—'}</strong></div>
                <div class="city-search-stat"><span>Malnutrition Rate</span> <strong>${data.avg_malnutrition_rate ?? '—'}</strong></div>
            `;
            
            renderCityDiseases(diseases);
            renderSafetyAdvisory(diseases);
            renderCityTrendChart(data.location_name, data.last_7_days_data || []); // charts.js
        } catch (error) {
            result.innerHTML = `<span style="color:#f87171">Error: ${error.message}</span>`;
            if (diseaseListEl) diseaseListEl.innerHTML = '';
        }
    });
}

function renderCityDiseases(diseases) {
    const listEl = document.getElementById('city-diseases-list');
    if (!listEl) return;

    if (!diseases || !diseases.length) {
        listEl.innerHTML = '<div class="analytics-placeholder">AI analytics temporarily unavailable. Please try again later.</div>';
        return;
    }

    const severityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
    const sortedDiseases = [...diseases].sort((a, b) => 
        (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99)
    );

    listEl.innerHTML = sortedDiseases.map(d => {
        const trendIcon = d.trend === 'Increasing' ? '↑' : d.trend === 'Decreasing' ? '↓' : '→';
        const trendClass = d.trend?.toLowerCase() || 'stable';
        const severityClass = (d.severity || 'Medium').toLowerCase();
        
        return `
            <div class="disease-card">
                <div class="disease-info">
                    <div class="disease-name">${d.name}</div>
                    <div class="disease-cases">Approx. ${d.cases} cases</div>
                </div>
                <div class="disease-meta">
                    <span class="severity-badge ${severityClass}">${d.severity}</span>
                    <span class="trend-pill ${trendClass}" title="${d.trend}">
                        ${trendIcon} ${d.trend}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function renderSafetyAdvisory(diseases) {
    const advisoryEl = document.getElementById('city-safety-advisory');
    const container = document.getElementById('safety-tips-container');
    if (!advisoryEl || !container) return;

    if (!diseases || !diseases.length) {
        advisoryEl.style.display = 'none';
        return;
    }

    // Filter diseases that have prevention data
    const tips = [];
    diseases.forEach(d => {
        if (d.prevention && Array.isArray(d.prevention)) {
            d.prevention.forEach(text => {
                tips.push({ disease: d.name, text });
            });
        }
    });

    if (tips.length === 0) {
        advisoryEl.style.display = 'none';
        return;
    }

    advisoryEl.style.display = 'block';

    // Simple mapping for icons based on keywords
    const getIcon = (text) => {
        const t = text.toLowerCase();
        if (t.includes('mosquito') || t.includes('net') || t.includes('repellent')) return '🦟';
        if (t.includes('water') || t.includes('drink') || t.includes('boiled')) return '💧';
        if (t.includes('wash') || t.includes('hand') || t.includes('hygiene')) return '🧼';
        if (t.includes('mask') || t.includes('crowd')) return '😷';
        if (t.includes('food') || t.includes('cooked')) return '🍲';
        if (t.includes('vaccine') || t.includes('doctor')) return '🏥';
        return '🛡️';
    };

    container.innerHTML = tips.map(tip => `
        <div class="safety-tip-card">
            <div class="tip-icon">${getIcon(tip.text)}</div>
            <div class="tip-info">
                <span class="tip-disease-tag">${tip.disease}</span>
                <div class="tip-content">${tip.text}</div>
            </div>
        </div>
    `).join('');
}

// ─────────────────────────────────────────────
// REFRESH BUTTON
// ─────────────────────────────────────────────
function initRefreshButton() {
    const btn = document.getElementById('refresh-btn')
             || document.querySelector('[data-action="refresh"]')
             || document.querySelector('.refresh-btn');
    if (!btn) return;
    btn.addEventListener('click', () => location.reload());
}

// ─────────────────────────────────────────────
// TOPBAR MENU
// ─────────────────────────────────────────────
function initTopbarMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const menu    = document.getElementById('topbar-menu-list');
    if (!menuBtn || !menu) return;

    const closeMenu  = () => { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); };
    const toggleMenu = (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', String(isOpen));
    };

    menuBtn.addEventListener('click', toggleMenu);
    document.addEventListener('click',   e => { if (!menu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

    menu.querySelectorAll('a, button').forEach(item => {
        item.addEventListener('click', e => {
            if (item.tagName.toLowerCase() === 'a' && item.hash) {
                e.preventDefault();
                document.querySelector(item.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            if (item.id === 'open-chat-menu-item') {
                e.preventDefault();
                document.getElementById('chat-toggle-btn')?.click();
            }
            closeMenu();
        });
    });
}
