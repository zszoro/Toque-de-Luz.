// Shopping Cart System
let cart = [];

// Set minimum date to today
document.addEventListener('DOMContentLoaded', function() {
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

// Cart Functions
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

function addPackageToCart(packageType) {
    const packages = {
        'inicial': {
            name: 'Pacote Inicial',
            price: 310,
            description: '2 Massagens Relaxantes, 1 Óleo Essencial, 1 Reiki Básico'
        },
        'bem-estar': {
            name: 'Pacote Bem-Estar',
            price: 540,
            description: '3 Massagens, 2 Óleos, 2 Reiki'
        },
        'premium': {
            name: 'Pacote Premium',
            price: 900,
            description: '5 Massagens, Kit Óleos'
        }
    };

    const pkg = packages[packageType];

    const item = {
        id: Date.now(),
        name: pkg.name,
        price: pkg.price,
        duration: pkg.description,
        type: 'package'
    };

    cart.push(item);
    saveCart();
    updateCartUI();
    showCartNotification(pkg.name);
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('toqueDeluzCart', JSON.stringify(cart));
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');

    cartCount.textContent = cart.length;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Seu carrinho está vazio</p>';
        checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div>
                <h4>${item.name}</h4>
                <p>${item.duration}</p>
                <span>R$ ${item.price.toFixed(2)}</span>
                <button onclick="removeFromCart(${item.id})">×</button>
            </div>
        `).join('');
        checkoutBtn.disabled = false;
    }

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    cartTotal.textContent = `R$ ${total.toFixed(2)}`;
}// Checkout
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

function closeCheckoutModal() {
    document.getElementById('checkoutModal').style.display = 'none';
}

function showCartNotification(name) {
    alert(`${name} adicionado ao carrinho`);
}

// 🔥 ENVIO PARA BACKEND (PARTE MAIS IMPORTANTE)
document.addEventListener('DOMContentLoaded', function() {
    const checkoutForm = document.getElementById('checkoutForm');

    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async function(e) {
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
                    alert("Pedido enviado com sucesso 🚀");

                    cart = [];
                    saveCart();
                    updateCartUI();
                    checkoutForm.reset();
                    closeCheckoutModal();
                } else {
                    alert("Erro ao enviar pedido");
                }

            } catch (err) {
                alert("Erro de conexão ❌");
                console.error(err);
            }
        });
    }
});
