// Shopping Cart System
let cart = [];

// INIT
document.addEventListener('DOMContentLoaded', function () {
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
});

// ADD ITEM
function addToCart(name, price, duration) {
    const item = {
        id: Date.now(),
        name,
        price,
        duration,
        type: 'service'
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

// UI
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
                    <h4>${item.name}</h4>
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

// ABRIR CARRINHO
function toggleCart(event) {
    if (event) event.preventDefault();

    const sidebar = document.getElementById('cartSidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('active');
}

// NOTIFICAÇÃO VERDE
function showCartNotification(itemName) {
    const notification = document.createElement('div');

    notification.style.position = 'fixed';
    notification.style.top = '80px';
    notification.style.right = '20px';
    notification.style.background = '#22c55e';
    notification.style.color = 'white';
    notification.style.padding = '12px 18px';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
    notification.style.zIndex = '9999';
    notification.style.fontWeight = 'bold';

    notification.innerText = `✓ ${itemName} adicionado ao carrinho`;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);
}// CHECKOUT MODAL
function openCheckoutModal() {
    if (cart.length === 0) return;

    const modal = document.getElementById('checkoutModal');
    const checkoutItems = document.getElementById('checkoutItems');
    const checkoutTotal = document.getElementById('checkoutTotal');

    checkoutItems.innerHTML = cart.map(item => `
        <div>
            <span>${item.name}</span>
            <span>${item.duration}</span>
            <span>R$ ${item.price.toFixed(2)}</span>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    checkoutTotal.textContent = `R$ ${total.toFixed(2)}`;

    modal.style.display = 'block';
}

// FECHAR
function closeCheckoutModal() {
    document.getElementById('checkoutModal').style.display = 'none';
}

// ENVIO PRO BACKEND
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('checkoutForm');

    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const name = document.getElementById('checkoutName').value;
        const email = document.getElementById('checkoutEmail').value;
        const phone = document.getElementById('checkoutPhone').value;
        const date = document.getElementById('checkoutDate').value;
        const time = document.getElementById('checkoutTime').value;
        const notes = document.getElementById('checkoutNotes').value;

        const itens = cart.map(item => ({
            nome: item.name,
            duracao: item.duration,
            preco: item.price
        }));

        const total = cart.reduce((sum, item) => sum + item.price, 0);

        const pedido = {
            nome: name,
            email,
            telefone: phone,
            data: date,
            hora: time,
            itens,
            total,
            observacoes: notes
        };

        console.log("📤 Enviando:", pedido);

        try {
            const res = await fetch('http://localhost:3000/api/pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pedido)
            });

            const data = await res.json();

            if (data.ok) {
                showCartNotification("Pedido enviado com sucesso 🚀");

                cart = [];
                saveCart();
                updateCartUI();
                form.reset();
                closeCheckoutModal();
            } else {
                alert("Erro ao enviar pedido");
            }

        } catch (err) {
            alert("Erro de conexão ❌");
            console.error(err);
        }
    });
});
