import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAuOJh6JhTqIFXU4q6wf2nr6UQkGV0_hyQ",
  authDomain: "arogya-8800e.firebaseapp.com",
  projectId: "arogya-8800e",
  storageBucket: "arogya-8800e.firebasestorage.app",
  messagingSenderId: "820563937858",
  appId: "1:820563937858:web:0d3c3d420634127b717bdb",
  measurementId: "G-55600DJY3N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);
const provider = new GoogleAuthProvider();

const authContainer = document.getElementById('auth-container');

// ─── n8n Login Notification Webhook ───────────────────────────────────────────
// Workflow: Aarogya Login Webhook → Check Email Exists → Format Email Content
//           → Send Login Email (Gmail) → Success/Error Response
// Webhook path MUST stay `aarogya-login` to match the n8n workflow node.
const N8N_LOGIN_WEBHOOK_URL = 'https://shubhamxcoder.app.n8n.cloud/webhook/aarogya-login';

/**
 * Gets a human-readable location string from the browser Geolocation API.
 * Falls back to "Unknown location" if unavailable or timed out.
 * @returns {Promise<string>}
 */
async function getLoginLocation() {
    if (!navigator.geolocation) return 'Unknown location';
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve('Unknown location'), 3000);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(timer);
                resolve(`Lat ${pos.coords.latitude.toFixed(3)}, Lon ${pos.coords.longitude.toFixed(3)}`);
            },
            () => { clearTimeout(timer); resolve('Unknown location'); },
            { timeout: 3000 }
        );
    });
}

/**
 * Sends a login notification to the n8n "Aarogya Login Webhook" workflow.
 *
 * n8n workflow mapping:
 *   email      → $json.body.email      (required: IF node checks existence)
 *   name       → $json.body.name       (used in email greeting)
 *   loginTime  → $json.body.loginTime  (shown in Login Details)
 *   location   → $json.body.location   (shown in Login Details)
 *   eventType  → $json.body.eventType  ('google-login' | 'login' | 'signup')
 *
 * n8n Success Response: { success: true,  message: "Login notification sent successfully" }
 * n8n Error Response:   { success: false, error:   "Email is required" }
 *
 * @param {{ email: string, name: string, loginTime: string, location: string, eventType?: string }} params
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
async function sendLoginWebhook({ email, name, loginTime, location, eventType = 'login' }) {
    const payload = {
        email,       // Required: n8n IF node checks $json.body.email
        name,        // Email greeting: Hello {{ $json.body.name }}
        loginTime,   // Login Details → Time
        location,    // Login Details → Location
        eventType    // Extra context: google-login / login / signup
    };

    console.log('🔥 [n8n] Sending login notification to:', N8N_LOGIN_WEBHOOK_URL);
    console.log('📦 [n8n] Payload:', payload);

    try {
        const resp = await fetch(N8N_LOGIN_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('📡 [n8n] Response status:', resp.status);

        // Parse n8n respondToWebhook JSON response
        let data = {};
        try { data = await resp.json(); }
        catch { data = { raw: await resp.text().catch(() => '') }; }

        if (!resp.ok) {
            // n8n Error Response: { success: false, error: "Email is required" }
            console.error('❌ [n8n] Webhook error:', resp.status, data);
            return { success: false, error: data.error || `HTTP ${resp.status}` };
        }

        // n8n Success Response: { success: true, message: "Login notification sent successfully" }
        console.log('✅ [n8n] Webhook success:', data);
        return { success: true, message: data.message || 'Notification sent' };

    } catch (err) {
        console.error('💥 [n8n] Network error sending webhook:', err);
        return { success: false, error: err.message || 'Network error' };
    }
}
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Updates the authentication UI based on current user state
 * @param {import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js').User|null} user 
 */
function updateAuthUI(user) {
    if (!authContainer) return;

    if (user) {
        // Logged In
        authContainer.innerHTML = `
            <div class="user-profile">
                <img src="${user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'}" 
                     alt="${user.displayName}" 
                     class="user-avatar"
                     title="${user.email}">
                <div class="user-info">
                    <span class="user-name">${user.displayName || 'User'}</span>
                    <button id="sign-out-btn" class="sign-out-btn">Sign Out</button>
                </div>
            </div>
        `;
        document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);
    } else {
        // Logged Out
        authContainer.innerHTML = `
            <button id="google-sign-in-btn" class="google-btn">
                <svg class="google-icon" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                <span>Sign in with Google</span>
            </button>
        `;
        document.getElementById('google-sign-in-btn').addEventListener('click', handleSignIn);
    }
}

async function handleSignIn() {
    try {
        const result = await signInWithPopup(auth, provider);
        console.log('User signed in:', result.user.email);

        // Send login notification via n8n workflow after successful Google sign-in
        const location = await getLoginLocation();
        const webhookResult = await sendLoginWebhook({
            email: result.user.email,
            name: result.user.displayName || result.user.email,
            loginTime: new Date().toISOString(),
            location,
            eventType: 'google-login'
        });

        if (webhookResult.success) {
            console.log('📧 Login notification sent via Aarogya AI n8n workflow.');
        } else {
            console.warn('⚠️ Login notification could not be sent:', webhookResult.error);
        }

    } catch (error) {
        console.error('Sign-in error:', error);
        alert('Failed to sign in. Please try again.');
    }
}

async function handleSignOut() {
    try {
        await signOut(auth);
        console.log('User signed out');
    } catch (error) {
        console.error('Sign-out error:', error);
    }
}

// Observe auth state changes
onAuthStateChanged(auth, (user) => {
    updateAuthUI(user);
});
