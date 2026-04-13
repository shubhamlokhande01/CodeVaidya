// charts.js — Aarogya AI
// Plotly chart initialization and city trend rendering (Chart.js).

let cityTrendChart = null;

function initCharts() {
    showLoading();

    // Disease Trend Chart — static demo data
    Plotly.newPlot('trend-chart', [{
        x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        y: [12, 19, 15, 25, 22, 18],
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Disease Cases',
        line:   { color: '#4299e1' },
        marker: { color: '#3182ce' }
    }], {
        title:  'Disease Trend Over Time',
        xaxis:  { title: 'Month' },
        yaxis:  { title: 'Number of Cases' },
        margin: { l: 50, r: 50, t: 50, b: 50 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor:  'rgba(0,0,0,0)'
    }, { responsive: true });

    // Risk Distribution Pie — initial placeholder (overwritten by live data)
    Plotly.newPlot('distribution-chart', [{
        values: [5, 8, 22],
        labels: ['High Risk', 'Medium Risk', 'Safe'],
        type:   'pie',
        marker: { colors: ['#e53e3e', '#d69e2e', '#38a169'] }
    }], {
        title:  'Risk Distribution Across Districts',
        margin: { l: 50, r: 50, t: 50, b: 50 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor:  'rgba(0,0,0,0)'
    }, { responsive: true });

    setTimeout(hideLoading, 300);
}

/**
 * Called after every hotspot refresh to keep the pie chart live.
 * @param {Array} hotspots
 */
function updateRiskDistributionChart(hotspots) {
    if (typeof Plotly === 'undefined') return;
    const high   = hotspots.filter(h => String(h.risk_level).toLowerCase() === 'high').length;
    const medium = hotspots.filter(h => String(h.risk_level).toLowerCase() === 'medium').length;
    const low    = hotspots.filter(h => String(h.risk_level).toLowerCase() === 'low').length;

    Plotly.react('distribution-chart', [{
        values: [high, medium, low],
        labels: ['High Risk', 'Medium Risk', 'Safe'],
        type:   'pie',
        marker: { colors: ['#e53e3e', '#d69e2e', '#38a169'] }
    }], {
        title:  'Risk Distribution Across Districts',
        margin: { l: 50, r: 50, t: 50, b: 50 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor:  'rgba(0,0,0,0)'
    });
}

/**
 * Render/update the city-specific 7-day trend chart (Chart.js canvas).
 * @param {string} cityName
 * @param {number[]} points  - 7 data points
 */
function renderCityTrendChart(cityName, points) {
    const canvas = document.getElementById('city-trend-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (cityTrendChart) cityTrendChart.destroy();

    cityTrendChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today'],
            datasets: [{
                label: `${cityName} active cases`,
                data:  points,
                borderColor:     '#60a5fa',
                backgroundColor: 'rgba(96, 165, 250, 0.18)',
                tension: 0.25,
                fill:    true
            }]
        },
        options: {
            plugins: { legend: { labels: { color: '#e5e7eb' } } },
            scales: {
                x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148,163,184,0.2)' } },
                y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148,163,184,0.2)' } }
            }
        }
    });
}
