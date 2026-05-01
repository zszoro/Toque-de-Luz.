import { updateOrder } from "../lib/store.js";

function getMercadoPagoAccessToken() {
    return process.env.MP_PROD_ACCESS_TOKEN || process.env.MP_TEST_ACCESS_TOKEN || process.env.ACCESS_TOKEN || "";
}

export default async function handler(req, res) {
    try {
        const paymentId = req.body?.data?.id || req.query?.id;

        if (!paymentId) {
            return res.status(200).json({ ok: true });
        }

        const response = await fetch(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            {
                headers: {
                    Authorization: `Bearer ${getMercadoPagoAccessToken()}`
                }
            }
        );

        const payment = await response.json();

        if (payment.status === "approved") {
            await updateOrder(paymentId, "approved", payment.external_reference);
            console.log("Pedido aprovado");
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(200).json({ ok: true });
    }
}
