import { saveOrder } from "../lib/db.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).end();
    }

    try {
        const { items, booking } = req.body;
        const accessToken = process.env.MP_PROD_ACCESS_TOKEN || process.env.MP_TEST_ACCESS_TOKEN || process.env.ACCESS_TOKEN;

        if (!accessToken) {
            return res.status(500).json({
                error: "Credencial do Mercado Pago ausente. Configure MP_PROD_ACCESS_TOKEN ou MP_TEST_ACCESS_TOKEN."
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Carrinho vazio ou itens invalidos." });
        }

        const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                items: items.map(item => ({
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
            saveOrder({
                id: Date.now().toString(),
                items,
                booking: booking || {},
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
