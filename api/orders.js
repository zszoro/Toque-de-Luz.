import { getOrders } from "../lib/store.js";

export default async function handler(req, res) {
    const orders = await getOrders();
    res.status(200).json(orders);
}
