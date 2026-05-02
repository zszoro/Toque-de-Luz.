import { getOrders } from "../lib/db.js";

export default function handler(req, res) {
    const orders = getOrders();
    res.status(200).json(orders);
}
