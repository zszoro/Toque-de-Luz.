import { updateOrder } from "../lib/db.js";

function getProductionAccessToken() {
    const prodToken = String(process.env.MP_PROD_ACCESS_TOKEN || "").trim();
    const legacyToken = String(process.env.ACCESS_TOKEN || "").trim();

    if (prodToken) return prodToken;
    if (legacyToken && !legacyToken.startsWith("TEST-")) return legacyToken;
    return "";
}

export default async function handler(req, res) {
    try {
        const paymentId = req.body?.data?.id;

        if (!paymentId) {
            return res.status(200).json({ ok: true });
        }

        const accessToken = getProductionAccessToken();
        if (!accessToken) {
            console.error("Credencial de producao ausente. Configure MP_PROD_ACCESS_TOKEN no Vercel.");
            return res.status(200).json({ ok: true });
        }

        const response = await fetch(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const payment = await response.json();

        if (payment.status === "approved") {
            updateOrder(paymentId, "approved");
            console.log("✅ Pedido aprovado");
        }

        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error(error);
        return res.status(200).json({ ok: true });
    }
}
