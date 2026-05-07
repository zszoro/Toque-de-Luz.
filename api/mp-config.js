import {
    getActiveMercadoPagoConfig,
    resolveAppBaseUrl,
    resolveWebhookPublicUrl
} from "../lib/mercadopago.js";

export default function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    const mpConfig = getActiveMercadoPagoConfig();
    const appBaseUrl = resolveAppBaseUrl(req);
    const webhookBaseUrl = resolveWebhookPublicUrl(req);

    return res.status(200).json({
        mode: mpConfig.mode,
        hasAccessToken: Boolean(mpConfig.accessToken),
        hasPublicKey: Boolean(mpConfig.publicKey),
        hasKv: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
        ordersDbKey: process.env.ORDERS_DB_KEY || "toque-de-luz:orders:v1",
        appBaseUrl: appBaseUrl || null,
        webhookNotificationUrl: webhookBaseUrl ? `${webhookBaseUrl}/api/webhook` : null
    });
}
