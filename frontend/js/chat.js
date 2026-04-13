// chat.js — Aarogya AI
// Chat widget initialization, message rendering, fallback logic, and outbreak context builder.

function initChatWidget() {
    const toggleBtn = document.getElementById('chat-toggle-btn');
    const closeBtn  = document.getElementById('chat-close-btn');
    const panel     = document.getElementById('chat-panel');
    const form      = document.getElementById('chat-form');
    const input     = document.getElementById('chat-input');
    const sendBtn   = document.getElementById('chat-send-btn');
    const messages  = document.getElementById('chat-messages');

    if (!toggleBtn || !closeBtn || !panel || !form || !input || !sendBtn || !messages) return;

    const openPanel  = () => { panel.classList.add('open');    panel.setAttribute('aria-hidden', 'false'); input.focus(); };
    const closePanel = () => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); };

    toggleBtn.addEventListener('click', () => panel.classList.contains('open') ? closePanel() : openPanel());
    closeBtn.addEventListener('click', closePanel);

    addChatMessage('bot', 'Hello. Ask me about diseases, symptoms, and prevention. I will include local outbreak risk when available.');
    checkChatBackendStatus();

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const text = (input.value || '').trim();
        if (!text) return;

        addChatMessage('user', text);
        input.value = '';
        setChatLoading(true);
        const loadingEl = addChatMessage('bot', 'Thinking...');

        try {
            const outbreakContext = buildOutbreakContext(text);
            const responseText    = await apiPostChat(text, outbreakContext);
            loadingEl.textContent = responseText;

        } catch (error) {
            const fallback = generateLocalHealthFallback(text, buildOutbreakContext(text));
            loadingEl.textContent = `${fallback}\n\n(Offline fallback: backend unavailable)`;
            console.error('[Chat] Error:', error);
        } finally {
            setChatLoading(false);
            scrollChatToBottom();
        }
    });

    function setChatLoading(isLoading) {
        sendBtn.disabled    = isLoading;
        input.disabled      = isLoading;
        sendBtn.textContent = isLoading ? '...' : 'Send';
    }

    function addChatMessage(role, text) {
        const msg = document.createElement('div');
        msg.className   = `chat-msg ${role === 'user' ? 'user' : 'bot'}`;
        msg.textContent = text;
        messages.appendChild(msg);
        scrollChatToBottom();
        return msg;
    }

    function scrollChatToBottom() { messages.scrollTop = messages.scrollHeight; }

    async function checkChatBackendStatus() {
        const ok = await apiHealthCheck();
        if (!ok) {
            console.warn('[Chat] Backend health check failed — chat will use offline fallback.');
        }
    }
}

// ─────────────────────────────────────────────
// LOCAL CHAT FALLBACK
// ─────────────────────────────────────────────
function generateLocalHealthFallback(userMessage, outbreakContext) {
    const msg          = (userMessage || '').toLowerCase();
    const symptomWords = ['fever', 'cough', 'rash', 'vomit', 'diarrhea', 'headache', 'fatigue', 'pain', 'sore throat'];
    const diseaseWords = ['dengue', 'cholera', 'malaria', 'flu', 'covid', 'typhoid', 'infection'];

    const hasSymptoms = symptomWords.some(w => msg.includes(w));
    const hasDisease  = diseaseWords.some(w => msg.includes(w));
    const highRisk    = outbreakContext?.risk_summary?.high   || [];
    const mediumRisk  = outbreakContext?.risk_summary?.medium || [];

    const riskLine = highRisk.length
        ? `Current local risk: High in ${highRisk.join(', ')}.`
        : mediumRisk.length
            ? `Current local risk: Medium in ${mediumRisk.join(', ')}.`
            : 'Current local risk data is limited.';

    if (hasSymptoms) return [
        'Monitor hydration, rest, and temperature. Avoid close contact with others.',
        'Seek urgent care for: breathing difficulty, persistent high fever, confusion, or worsening symptoms.',
        riskLine,
        'This is not a medical diagnosis'
    ].join('\n');

    if (hasDisease) return [
        'This disease can spread through vectors, contaminated food/water, or close contact.',
        'Prevention: frequent handwashing, clean water, mosquito control, mask in crowded settings, early medical consultation.',
        riskLine,
        'This is not a medical diagnosis'
    ].join('\n');

    return [
        'Keep hygiene strong, avoid unsafe food/water, reduce mosquito exposure, and watch for persistent symptoms.',
        riskLine,
        'If symptoms become severe or continue, consult a doctor promptly.',
        'This is not a medical diagnosis'
    ].join('\n');
}

// ─────────────────────────────────────────────
// OUTBREAK CONTEXT BUILDER
// ─────────────────────────────────────────────
function buildOutbreakContext(userMessage) {
    const districts = window.__AAROGYA_DISTRICTS__ || [];
    const text      = (userMessage || '').toLowerCase();
    const symptomKW = ['fever', 'cough', 'rash', 'vomit', 'diarrhea', 'headache', 'fatigue', 'pain'];
    const diseaseKW = ['dengue', 'cholera', 'malaria', 'flu', 'covid', 'infection', 'typhoid'];

    const highRisk   = districts.filter(d => d.risk === 'high').map(d => `${d.name} (${d.active_cases} cases)`);
    const mediumRisk = districts.filter(d => d.risk === 'medium').map(d => `${d.name} (${d.active_cases} cases)`);

    return {
        symptoms_mentioned: symptomKW.some(k => text.includes(k)),
        disease_mentioned:  diseaseKW.some(k => text.includes(k)),
        risk_summary: { high: highRisk, medium: mediumRisk }
    };
}
