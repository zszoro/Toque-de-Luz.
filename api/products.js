import { publicProduct, readProducts, sortProducts } from "../lib/catalog.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Metodo nao permitido." });
    }

    try {
        const products = sortProducts(await readProducts())
            .filter((product) => product.active !== false)
            .map(publicProduct);

        return res.status(200).json({ products });
    } catch (error) {
        return res.status(500).json({ error: error.message || "Nao foi possivel carregar produtos." });
    }
}
