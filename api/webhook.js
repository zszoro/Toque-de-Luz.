export default async function handler(req, res) {
    try {
        const paymentId = req.body?.data?.id;

        if (!paymentId) {
            return res.status(200).json({ ok: true });
        }

        const response = await fetch(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`
                }
            }
        );

        const payment = await response.json();

        console.log("Status:", payment.status);

        if (payment.status === "approved") {
            console.log("✅ PAGAMENTO APROVADO");
        }

        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error(error);
        return res.status(200).json({ ok: true });
    }
}
