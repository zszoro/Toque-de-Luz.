// =======================
// CARRINHO
// =======================
let cart = [];

// INIT
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('checkoutDate');

    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }

    const savedCart = localStorage.getItem('toqueDeluzCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }

    setupForm();
});

// =======================
// ADD ITEM
// =======================
function addToCart(name, price, duration) {
    const item = {
        id: Date.now(),
        name,
        price,
        duration
    };

    cart.push(item);
    saveCart();
    updateCartUI();
    showCartNotification(name);
}

// REMOVE
function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    updateCartUI();
}

// SAVE
function saveCart() {
    localStorage.setItem('toqueDeluzCart', JSON.stringify(cart));
}

// =======================
// UI DO CARRINHO
// =======================
function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (!cartCount || !cartItems || !cartTotal) return;

    cartCount.textContent = cart.length;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Seu carrinho está vazio</p>';
        if (checkoutBtn) checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div>
                    <strong>${item.name}</strong>
                    <p>${item.duration}</p>
                </div>
                <span>R$ ${item.price.toFixed(2)}</span>
                <button onclick="removeFromCart(${item.id})">×</button>
            </div>
        `).join('');

        if (checkoutBtn) checkoutBtn.disabled = false;
    }

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    cartTotal.textContent = `R$ ${total.toFixed(2)}`;
}

// =======================
// ABRIR CARRINHO
// =======================
function toggleCart(e) {
    if (e) e.preventDefault();

    const sidebar = document.getElementById('cartSidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('active');
}

// =======================
// NOTIFICAÇÃO BONITA (CSS)
// =======================
function showCartNotification(text) {
    const notification = document.createElement('div');

    notification.className = 'cart-notification';
    notification.innerText = `✓ ${text}`;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// =======================
// MODAL CHECKOUT
// =======================
function openCheckoutModal() {
    if (cart.length === 0) return;

    const modal = document.getElementById('checkoutModal');
    const checkoutItems = document.getElementById('checkoutItems');
    const checkoutTotal = document.getElementById('checkoutTotal');

    checkoutItems.innerHTML = cart.map(item => `
        <div class="checkout-item">
            <span>${item.name}</span>
            <span>${item.duration}</span>
            <span>R$ ${item.price.toFixed(2)}</span>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    checkoutTotal.textContent = `R$ ${total.toFixed(2)}`;

    modal.style.display = 'flex'; // 🔥 IMPORTANTE
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').style.display = 'none';
}

// =======================
// FORM / BACKEND
// =======================
function setupForm() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const pedido = {
            nome: document.getElementById('checkoutName').value,
            email: document.getElementById('checkoutEmail').value,
            telefone: document.getElementById('checkoutPhone').value,
            data: document.getElementById('checkoutDate').value,
            hora: document.getElementById('checkoutTime').value,
            observacoes: document.getElementById('checkoutNotes').value,
            itens: cart,
            total: cart.reduce((sum, i) => sum + i.price, 0)
        };

        try {
            const res = await fetch('http://localhost:3000/api/pedidos', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(pedido)
            });

            const data = await res.json();

            if (data.ok) {
                showCartNotification('Pedido enviado 🚀');

                cart = [];
                saveCart();
                updateCartUI();
                form.reset();
                closeCheckoutModal();
            } else {
                alert('Erro ao enviar pedido');
            }

        } catch (err) {
            alert('Erro de conexão ❌');
            console.error(err);
        }
    });
}
