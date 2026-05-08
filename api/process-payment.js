import { getAuthToken, getUserByToken } from "../lib/catalog.js";
import { getOrders, saveOrder, updateOrder } from "../lib/db.js";
import {
    fetchWithTimeout,
    getActiveMercadoPagoConfig,
    normalizeBooking
} from "../lib/mercadopago.js";

function normalizePaymentItems(items) {
    return Array.isArray(items)
        ? items
            .map((item) => ({
                productId: String(item?.productId || item?.id || "").trim() || null,
                name: String(item?.name || "").trim(),
                duration: String(item?.duration || "").trim(),
                price: Number(item?.price || 0)
            }))
            .filter((item) => item.name && Number.isFinite(item.price) && item.price > 0)
        : [];
}

function cleanObject(value) {
    if (!value || typeof value !== "object") return value;

    return Object.fromEntries(
        Object.entries(value)
            .filter(([, item]) => item !== undefined && item !== null && item !== "")
            .map(([key, item]) => [key, cleanObject(item)])
    );
}

async function ensureOrder({ orderId, items, booking, user, paymentPreferenceId, mode }) {
    const orders = await getOrders();
    const existingOrder = orders.find((order) => String(order.id || "") === String(orderId || ""));
    if (existingOrder) return existingOrder;

    const normalizedItems = normalizePaymentItems(items);
    const total = normalizedItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const fallbackOrder = {
        id: orderId || `${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
        items: normalizedItems,
        booking,
        userId: user?.id || null,
        userEmail: user?.email || booking.email || null,
        paymentId: null,
        preferenceId: paymentPreferenceId || null,
        status: "pending",
        paymentStatus: "pending",
        mode,
        total,
        createdAt: new Date().toISOString()
    };

    await saveOrder(fallbackOrder);
    return fallbackOrder;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    const mpConfig = getActiveMercadoPagoConfig();
    if (!mpConfig.accessToken) {
        return res.status(500).json({ error: `Credencial ausente para modo ${mpConfig.mode}.` });
    }

    const body = req.body || {};
    const booking = normalizeBooking(body.booking);
    const accountToken = getAuthToken(req, body);
    const user = getUserByToken(accountToken);

    try {
        const order = await ensureOrder({
            orderId: body.orderId,
            items: body.items,
            booking,
            user,
            paymentPreferenceId: body.preferenceId,
            mode: mpConfig.mode
        });
        const transactionAmount = Number(order.total || body.transaction_amount || body.transactionAmount || 0);
        const payerEmail = booking.email || user?.email || body.payer?.email || body.formData?.payer?.email || "";
        const formData = body.formData && typeof body.formData === "object" ? body.formData : body;

        if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
            return res.status(400).json({ error: "Valor de pagamento invalido." });
        }

        if (!payerEmail) {
            return res.status(400).json({ error: "Informe um e-mail para pagar." });
        }

        const paymentPayload = cleanObject({
            transaction_amount: Number(transactionAmount.toFixed(2)),
            token: formData.token,
            description: order.items?.map((item) => item.name).join(", ") || "Toque de Luz",
            installments: formData.installments ? Number(formData.installments) : undefined,
            payment_method_id: formData.payment_method_id,
            issuer_id: formData.issuer_id,
            payer: {
                email: payerEmail,
                identification: formData.payer?.identification || formData.identification
            },
            external_reference: order.id,
            metadata: {
                order_id: order.id
            }
        });

        if (!paymentPayload.payment_method_id) {
            return res.status(400).json({ error: "Meio de pagamento invalido." });
        }

        const response = await fetchWithTimeout("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${mpConfig.accessToken}`,
                "Content-Type": "application/json",
                "X-Idempotency-Key": `${order.id}-${Date.now()}`
            },
            body: JSON.stringify(paymentPayload)
        });
        const payment = await response.json().catch(() => ({}));

        if (!response.ok) {
            return res.status(502).json({
                error: payment.message || "Nao foi possivel processar o pagamento.",
                details: payment
            });
        }

        await updateOrder(
            payment.id,
            payment.status || "pending",
            order.id,
            payment
        );

        return res.status(200).json({
            id: payment.id,
            status: payment.status,
            status_detail: payment.status_detail,
            payment_method_id: payment.payment_method_id,
            point_of_interaction: payment.point_of_interaction || null,
            pix: payment.point_of_interaction?.transaction_data
                ? {
                    qr_code: payment.point_of_interaction.transaction_data.qr_code || null,
                    qr_code_base64: payment.point_of_interaction.transaction_data.qr_code_base64 || null,
                    ticket_url: payment.point_of_interaction.transaction_data.ticket_url || null
                }
                : null
        });
    } catch (error) {
        if (error.name === "AbortError") {
            return res.status(504).json({ error: "Timeout ao comunicar com Mercado Pago." });
        }

        console.error(error);
        return res.status(500).json({ error: "Erro interno ao processar pagamento." });
    }
}
