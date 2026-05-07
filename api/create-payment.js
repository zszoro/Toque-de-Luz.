import { saveOrder } from "../lib/db.js";
import { getAuthToken, getUserByToken } from "../lib/catalog.js";
import { readProducts } from "../lib/catalog.js";
import {
    createPreference,
    getActiveMercadoPagoConfig,
    isLocalBaseUrl,
    normalizeBooking,
    resolveAppBaseUrl,
    resolveWebhookPublicUrl
} from "../lib/mercadopago.js";

async function normalizeCartItems(items) {
    if (!Array.isArray(items)) return [];

    const needsCatalog = items.some((item) => String(item?.productId || item?.id || "").trim());
    let products = [];
    if (needsCatalog) {
        try {
            products = await readProducts();
        } catch (error) {
            console.error("Nao foi possivel ler catalogo; usando dados do carrinho.", error);
        }
    }

    const productsById = new Map(products.map((product) => [String(product.id || ""), product]));

    return items
        .map((item) => {
            const productId = String(item?.productId || item?.id || "").trim();
            const product = productId ? productsById.get(productId) : null;
            const name = product ? product.name : String(item?.name || "").trim();
            const price = product ? Number(product.price || 0) : Number(item?.price || 0);
            const duration = product ? String(product.duration || "") : String(item?.duration || "");

            return {
                productId: product?.id || productId || null,
                name,
                duration,
                price
            };
        })
        .filter((item) => item.name && Number.isFinite(item.price) && item.price > 0);
}

export default async function handler(req, res) {
    let stage = "start";

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    stage = "credentials";
    const mpConfig = getActiveMercadoPagoConfig();
    if (!mpConfig.accessToken) {
        return res.status(500).json({
            error: `Credencial ausente para modo ${mpConfig.mode}. Configure MP_${mpConfig.mode}_ACCESS_TOKEN.`
        });
    }

    try {
        stage = "normalize-cart";
        const cartItems = await normalizeCartItems(req.body?.items);
        if (cartItems.length === 0) {
            return res.status(400).json({ error: "Carrinho vazio ou itens invalidos." });
        }

        stage = "build-preference";
        const booking = normalizeBooking(req.body?.booking);
        const accountToken = getAuthToken(req, req.body);
        const user = getUserByToken(accountToken);
        const orderId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
        const appBaseUrl = resolveAppBaseUrl(req);
        const webhookBaseUrl = resolveWebhookPublicUrl(req);

        const preferencePayload = {
            external_reference: orderId,
            items: cartItems.map((item) => ({
                id: item.productId || undefined,
                title: item.name,
                quantity: 1,
                currency_id: "BRL",
                unit_price: Number(item.price.toFixed(2))
            })),
            metadata: {
                order_id: orderId,
                customer_email: booking.email || user?.email || ""
            }
        };

        if (booking.email) {
            preferencePayload.payer = {
                name: booking.name || undefined,
                email: booking.email,
                phone: booking.phone ? { number: booking.phone } : undefined
            };
        }

        if (webhookBaseUrl) {
            preferencePayload.notification_url = `${webhookBaseUrl}/api/webhook`;
        }

        if (appBaseUrl && !isLocalBaseUrl(appBaseUrl)) {
            preferencePayload.back_urls = {
                success: `${appBaseUrl}/?payment_status=approved&order_id=${encodeURIComponent(orderId)}`,
                pending: `${appBaseUrl}/?payment_status=pending&order_id=${encodeURIComponent(orderId)}`,
                failure: `${appBaseUrl}/?payment_status=failed&order_id=${encodeURIComponent(orderId)}`
            };
            preferencePayload.auto_return = "approved";
        }

        stage = "mercado-pago";
        const { response, data } = await createPreference(preferencePayload, mpConfig.accessToken);
        if (!response.ok || !data.init_point) {
            return res.status(502).json({
                error: data.message || "Falha ao criar pagamento no Mercado Pago.",
                details: data
            });
        }

        let orderSaved = true;
        try {
            stage = "save-order";
            await saveOrder({
                id: orderId,
                items: cartItems,
                booking,
                userId: user?.id || null,
                userEmail: user?.email || booking.email || null,
                paymentId: null,
                preferenceId: data.id || null,
                status: "pending",
                paymentStatus: "pending",
                mode: mpConfig.mode,
                total: cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0),
                createdAt: new Date().toISOString()
            });
        } catch (saveError) {
            orderSaved = false;
            console.error("Pagamento criado, mas o pedido nao foi salvo.", saveError);
        }

        return res.status(200).json({
            init_point: data.init_point,
            orderId,
            mode: mpConfig.mode,
            orderSaved
        });
    } catch (error) {
        if (error.name === "AbortError") {
            return res.status(504).json({ error: "Timeout ao comunicar com Mercado Pago." });
        }

        console.error(error);
        return res.status(500).json({
            error: "Erro interno ao iniciar pagamento.",
            stage,
            message: error.message || "Erro desconhecido"
        });
    }
}
