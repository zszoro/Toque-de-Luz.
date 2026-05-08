import { getOrders, updateOrder } from "../lib/db.js";
import { fetchPaymentById, getActiveMercadoPagoConfig } from "../lib/mercadopago.js";

function getOrderId(req) {
    return String(req.query?.orderId || req.body?.orderId || "").trim();
}

export default async function handler(req, res) {
    if (req.method !== "GET" && req.method !== "POST") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    const orderId = getOrderId(req);
    if (!orderId) {
        return res.status(400).json({ error: "Informe orderId." });
    }

    try {
        const orders = await getOrders();
        const order = orders.find((item) => String(item.id || "") === orderId);

        if (!order) {
            return res.status(404).json({ error: "Pedido nao encontrado." });
        }

        let status = order.status || order.paymentStatus || "pending";
        let paymentId = order.paymentId || null;
        let statusDetail = order.paymentStatusDetail || null;

        if (paymentId && status !== "approved") {
            const mpConfig = getActiveMercadoPagoConfig();
            if (mpConfig.accessToken) {
                const { response, payment } = await fetchPaymentById(paymentId, mpConfig.accessToken);
                if (response.ok) {
                    status = payment.status || status;
                    statusDetail = payment.status_detail || statusDetail;
                    await updateOrder(payment.id, status, order.id, payment);
                }
            }
        }

        return res.status(200).json({
            orderId: order.id,
            paymentId,
            status,
            statusDetail,
            approved: status === "approved"
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro interno ao consultar pagamento." });
    }
}
