export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    try {
        const { items } = req.body;

        const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
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

        return res.status(200).json({
            init_point: data.init_point
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro ao criar pagamento" });
    }
}
