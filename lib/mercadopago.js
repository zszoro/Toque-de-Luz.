export const MP_MODE_TEST = "TEST";
export const MP_MODE_PROD = "PROD";

export function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function isLikelyTestCredential(value) {
    return String(value || "").startsWith("TEST-");
}

function normalizeMpMode(rawMode) {
    const mode = String(rawMode || "").trim().toUpperCase();
    if (mode === MP_MODE_TEST || mode === MP_MODE_PROD) return mode;
    return "";
}

export function resolveMpMode() {
    const configuredMode = normalizeMpMode(process.env.MP_MODE);
    if (configuredMode) return configuredMode;

    const legacyToken = String(process.env.ACCESS_TOKEN || "");
    if (isLikelyTestCredential(legacyToken)) return MP_MODE_TEST;
    return MP_MODE_PROD;
}

export function getActiveMercadoPagoConfig() {
    const mode = resolveMpMode();
    const legacyAccessToken = String(process.env.ACCESS_TOKEN || "").trim();
    const legacyPublicKey = String(process.env.PUBLIC_KEY || "").trim();

    if (mode === MP_MODE_PROD) {
        return {
            mode,
            accessToken: String(process.env.MP_PROD_ACCESS_TOKEN || (!isLikelyTestCredential(legacyAccessToken) ? legacyAccessToken : "")).trim(),
            publicKey: String(process.env.MP_PROD_PUBLIC_KEY || (!isLikelyTestCredential(legacyPublicKey) ? legacyPublicKey : "")).trim()
        };
    }

    return {
        mode: MP_MODE_TEST,
        accessToken: String(process.env.MP_TEST_ACCESS_TOKEN || (isLikelyTestCredential(legacyAccessToken) ? legacyAccessToken : "")).trim(),
        publicKey: String(process.env.MP_TEST_PUBLIC_KEY || (isLikelyTestCredential(legacyPublicKey) ? legacyPublicKey : "")).trim()
    };
}

export function resolveAppBaseUrl(req = null) {
    const envUrl = String(process.env.APP_BASE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "").trim();
    if (envUrl) {
        const withProtocol = /^https?:\/\//i.test(envUrl) ? envUrl : `https://${envUrl}`;
        return withProtocol.replace(/\/$/, "");
    }

    const host = req?.headers?.host;
    if (!host) return "";
    const protocol = req.headers["x-forwarded-proto"] || "https";
    return `${protocol}://${host}`.replace(/\/$/, "");
}

export function resolveWebhookPublicUrl(req = null) {
    const envUrl = String(process.env.MP_WEBHOOK_PUBLIC_URL || "").trim();
    if (envUrl) return envUrl.replace(/\/$/, "");
    return resolveAppBaseUrl(req);
}

export function isLocalBaseUrl(baseUrl) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?/i.test(String(baseUrl || ""));
}

export function normalizeBooking(booking) {
    return {
        name: String(booking?.name || "").trim(),
        email: normalizeEmail(booking?.email),
        phone: String(booking?.phone || "").trim(),
        attendanceLocation: String(booking?.attendanceLocation || "").trim(),
        date: String(booking?.date || "").trim(),
        time: String(booking?.time || "").trim(),
        notes: String(booking?.notes || "").trim()
    };
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 20_000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function createPreference(payload, accessToken) {
    const response = await fetchWithTimeout("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
}

export async function fetchPaymentById(paymentId, accessToken) {
    const response = await fetchWithTimeout(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    const payment = await response.json().catch(() => ({}));
    return { response, payment };
}
