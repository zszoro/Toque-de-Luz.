import { updateOrder } from "../lib/db.js";
import { fetchPaymentById, getActiveMercadoPagoConfig } from "../lib/mercadopago.js";

function getPaymentId(req) {
    return req.body?.data?.id
        || req.body?.id
        || req.query?.["data.id"]
        || req.query?.id
        || "";
}

export default async function handler(req, res) {
    if (req.method !== "POST" && req.method !== "GET") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    const paymentId = getPaymentId(req);
    if (!paymentId) {
        return res.status(200).json({ ok: true });
    }

    const mpConfig = getActiveMercadoPagoConfig();
    if (!mpConfig.accessToken) {
        console.error(`Credencial ausente para modo ${mpConfig.mode}.`);
        return res.status(200).json({ ok: true });
    }

    try {
        const { response, payment } = await fetchPaymentById(paymentId, mpConfig.accessToken);
        if (!response.ok) {
            console.error("Falha ao consultar pagamento no Mercado Pago.", payment);
            return res.status(200).json({ ok: true });
        }

        await updateOrder(
            paymentId,
            payment.status || "pending",
            payment.external_reference || payment.metadata?.order_id || "",
            payment
        );

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error(error);
        return res.status(200).json({ ok: true });
    }
}
