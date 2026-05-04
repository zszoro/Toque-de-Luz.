import { saveOrder } from "../lib/db.js";
import { readProducts } from "../lib/catalog.js";

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
        const products = await readProducts();
        const productsById = new Map(products.map((product) => [String(product.id || ""), product]));
        const normalizedItems = Array.isArray(items)
            ? items.map((item) => {
                const productId = String(item?.productId || item?.id || "").trim();
                const product = productId ? productsById.get(productId) : null;

                return {
                    productId: product?.id || productId || null,
                    name: product ? product.name : String(item?.name || "").trim(),
                    duration: product ? product.duration : String(item?.duration || ""),
                    price: product ? Number(product.price || 0) : Number(item?.price || 0)
                };
            }).filter((item) => item.name && Number.isFinite(item.price) && item.price > 0)
            : [];
        const accessToken = getProductionAccessToken();

        if (!accessToken) {
            return res.status(500).json({
                error: "Credencial de producao ausente. Configure MP_PROD_ACCESS_TOKEN no Vercel."
            });
        }

        if (normalizedItems.length === 0) {
            return res.status(400).json({ error: "Carrinho vazio ou itens invalidos." });
        }

        const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                items: normalizedItems.map(item => ({
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
            items: normalizedItems,
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
