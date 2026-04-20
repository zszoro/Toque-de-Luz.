export default async function handler(req, res) {
    // Só aceita POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    try {
        console.log("🔔 Webhook recebido:", req.body);

        // Pega o ID do pagamento
        const paymentId = req.body?.data?.id;

        if (!paymentId) {
            console.log("❌ Não veio ID");
            return res.status(200).json({ ok: true });
        }

        // Consulta o pagamento no Mercado Pago
        const response = await fetch(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`
                }
            }
        );

        const payment = await response.json();

        console.log("💰 Status do pagamento:", payment.status);

        // Verifica se foi aprovado
        if (payment.status === "approved") {
            console.log("✅ PAGAMENTO APROVADO");

            // 👉 AQUI você vai colocar depois:
            // - atualizar estoque
            // - marcar pedido como pago
        }

        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error("🔥 Erro no webhook:", error);
        return res.status(500).json({ error: "Erro interno" });
    }
}
