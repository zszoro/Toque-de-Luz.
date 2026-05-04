import { saveOrder } from "../lib/db.js";

function getProductionAccessToken() {
    const prodToken = String(process.env.MP_PROD_ACCESS_TOKEN || "").trim();
    const legacyToken = String(process.env.ACCESS_TOKEN || "").trim();

    if (prodToken) return prodToken;
    if (legacyToken && !legacyToken.startsWith("TEST-")) return legacyToken;
    return "";
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).end();
    }

    try {
        const { items } = req.body;
        const accessToken = getProductionAccessToken();

        if (!accessToken) {
            return res.status(500).json({
                error: "Credencial de producao ausente. Configure MP_PROD_ACCESS_TOKEN no Vercel."
            });
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

        // salva pedido
        saveOrder({
            id: Date.now().toString(),
            items,
            paymentId: null,
            status: "pending"
        });

        return res.status(200).json({
            init_point: data.init_point
        });

    } catch (error) {
        console.error(error);
        return res.status(500).end();
    }
}
