import {
    getUserByToken,
    isValidEmail,
    isValidPhone,
    normalizeCartItems,
    normalizeEmail,
    normalizePhone,
    saveOrder
} from "../lib/store.js";
import { getAuthToken } from "./_auth.js";

function getMercadoPagoAccessToken() {
    return process.env.MP_PROD_ACCESS_TOKEN || process.env.MP_TEST_ACCESS_TOKEN || process.env.ACCESS_TOKEN || "";
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).end();
    }

    try {
        const { items, booking } = req.body || {};
        const accessToken = getMercadoPagoAccessToken();
        const normalizedItems = normalizeCartItems(items);
        const user = await getUserByToken(getAuthToken(req));
        const normalizedBooking = {
            name: String(booking?.name || user?.name || "").trim(),
            email: normalizeEmail(booking?.email || user?.email || ""),
            phone: normalizePhone(booking?.phone || user?.phone || ""),
            date: String(booking?.date || "").trim(),
            time: String(booking?.time || "").trim(),
            notes: String(booking?.notes || "").trim()
        };

        if (!accessToken) {
            return res.status(500).json({
                error: "Credencial do Mercado Pago ausente. Configure MP_PROD_ACCESS_TOKEN ou MP_TEST_ACCESS_TOKEN."
            });
        }

        if (normalizedItems.length === 0) {
            return res.status(400).json({ error: "Carrinho vazio ou itens invalidos." });
        }

        if (!isValidEmail(normalizedBooking.email)) {
            return res.status(400).json({ error: "Informe um e-mail valido para finalizar." });
        }

        if (!isValidPhone(normalizedBooking.phone)) {
            return res.status(400).json({ error: "Informe um telefone valido com DDD para finalizar." });
        }

        const orderId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                external_reference: orderId,
                payer: {
                    email: normalizedBooking.email
                },
                items: normalizedItems.map(item => ({
                    title: item.name,
                    quantity: 1,
                    unit_price: item.price
                }))
            })
        });

        const data = await response.json();

        if (!response.ok || !data.init_point) {
            return res.status(502).json({
                error: data.message || "Falha ao criar pagamento no Mercado Pago.",
                details: data
            });
        }

        // salva pedido
        try {
            await saveOrder({
                id: orderId,
                items: normalizedItems,
                booking: normalizedBooking,
                userId: user?.id || null,
                userEmail: user?.email || normalizedBooking.email || null,
                paymentId: null,
                preferenceId: data.id || null,
                status: "pending"
            });
        } catch (error) {
            console.error("Nao foi possivel salvar o pedido", error);
        }

        return res.status(200).json({
            init_point: data.init_point
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro interno ao iniciar pagamento." });
    }
}
