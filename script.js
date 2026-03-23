// Shopping Cart System
let cart = [];

// Set minimum date to today
document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('checkoutDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }

    // Load cart from localStorage
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
        name: name,
        price: price,
        duration: duration,
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
            description: '2 Massagens Relaxantes, 1 Óleo Essencial, 1 Reiki Básico, Consulta Gratuita'
        },
        'bem-estar': {
            name: 'Pacote Bem-Estar',
            price: 540,
            description: '3 Massagens, 2 Óleos, 2 Reiki Completo, Kit Aroma, Acompanhamento'
        },
        'premium': {
            name: 'Pacote Premium',
            price: 900,
            description: '5 Massagens, Kit Óleos, 3 Reiki Cristais, 1 Quick Massagem, Acompanhamento 3 Meses'
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

    // Update count
    cartCount.textContent = cart.length;

    // Update items display
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart">Seu carrinho está vazio</p>';
        checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>${item.duration}</p>
                </div>
                <span class="cart-item-price">R$ ${item.price.toFixed(2)}</span>
                <button class="remove-item" onclick="removeFromCart(${item.id})">×</button>
            </div>
        `).join('');
        checkoutBtn.disabled = false;
    }

    // Update total
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    cartTotal.textContent = `R$ ${total.toFixed(2)}`;
}

function toggleCart(event) {
    event.preventDefault();
    const sidebar = document.getElementById('cartSidebar');
    sidebar.classList.toggle('active');
}

function showCartNotification(itemName) {
    // Show a quick notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background-color: ${getComputedStyle(document.documentElement).getPropertyValue('--primary-color')};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 4000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = `✓ ${itemName} adicionado ao carrinho!`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Checkout Functions
function openCheckoutModal() {
    if (cart.length === 0) return;

    const modal = document.getElementById('checkoutModal');
    const checkoutItems = document.getElementById('checkoutItems');
    const checkoutTotal = document.getElementById('checkoutTotal');

    // Populate checkout summary
    checkoutItems.innerHTML = cart.map(item => `
        <div class="checkout-item">
            <span class="checkout-item-name">${item.name}</span>
            <span class="checkout-item-duration">${item.duration}</span>
            <span class="checkout-item-price">R$ ${item.price.toFixed(2)}</span>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    checkoutTotal.textContent = `R$ ${total.toFixed(2)}`;

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Close cart sidebar
    document.getElementById('cartSidebar').classList.remove('active');
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function closeConfirmationModal() {
    document.getElementById('confirmationModal').style.display = 'none';
    document.body.style.overflow = 'auto';

    // Clear cart after confirmation
    cart = [];
    saveCart();
    updateCartUI();
}

// Checkout form submission
document.addEventListener('DOMContentLoaded', function() {
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Get form values
            const name = document.getElementById('checkoutName').value;
            const email = document.getElementById('checkoutEmail').value;
            const phone = document.getElementById('checkoutPhone').value;
            const date = document.getElementById('checkoutDate').value;
            const time = document.getElementById('checkoutTime').value;
            const notes = document.getElementById('checkoutNotes').value;

            // Format date
            const dateObj = new Date(date + 'T00:00:00');
            const formattedDate = dateObj.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Get cart items summary
            const itemsList = cart.map(item => `<li>${item.name} - R$ ${item.price.toFixed(2)}</li>`).join('');
            const total = cart.reduce((sum, item) => sum + item.price, 0);

            // Create confirmation message
            const confirmationHTML = `
                <p><strong>Nome:</strong> ${name}</p>
                <p><strong>E-mail:</strong> ${email}</p>
                <p><strong>Telefone:</strong> ${phone}</p>
                <p><strong>Data Preferencial:</strong> ${formattedDate}</p>
                <p><strong>Horário:</strong> ${time}</p>
                <p><strong>Serviços/Pacotes:</strong></p>
                <ul style="margin-left: 1.5rem;">${itemsList}</ul>
                <p><strong>Total:</strong> R$ ${total.toFixed(2)}</p>
                ${notes ? `<p><strong>Observações:</strong> ${notes}</p>` : ''}
                <p style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px solid #8FBC8F;">
                    Você receberá uma confirmação por e-mail em breve!
                </p>
            `;

            // Store booking
            const booking = {
                name,
                email,
                phone,
                date: formattedDate,
                time,
                items: cart,
                total: total,
                notes,
                timestamp: new Date().toISOString()
            };

            let bookings = JSON.parse(localStorage.getItem('bookings')) || [];
            bookings.push(booking);
            localStorage.setItem('bookings', JSON.stringify(bookings));

            // Show confirmation
            document.getElementById('confirmationDetails').innerHTML = confirmationHTML;
            closeCheckoutModal();
            document.getElementById('confirmationModal').style.display = 'block';
            document.body.style.overflow = 'hidden';

            // Reset form
            checkoutForm.reset();

            console.log('Agendamento realizado:', booking);
        });
    }
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe service cards
document.querySelectorAll('.service-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s, transform 0.5s';
    observer.observe(card);
});


// Custom Package Modal Functions
let selectedServices = [];
let customPackageTotal = 0;

function openCustomPackageModal() {
    document.getElementById('customPackageModal').style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeCustomPackageModal() {
    document.getElementById('customPackageModal').style.display = 'none';
    document.body.style.overflow = 'auto'; // Re-enable scrolling
    resetModalSelections();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('customPackageModal');
    if (event.target == modal) {
        closeCustomPackageModal();
    }
}

function resetModalSelections() {
    // Reset all checkboxes and quantity inputs
    document.querySelectorAll('.service-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });

    document.querySelectorAll('.quantity-input').forEach(input => {
        input.value = 0;
        input.disabled = true;
    });

    selectedServices = [];
    updateModalPrices();
}

// Handle checkbox changes
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners to all checkboxes
    document.querySelectorAll('.service-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const quantityInput = this.closest('.modal-service-item').querySelector('.quantity-input');

            if (this.checked) {
                quantityInput.disabled = false;
                quantityInput.value = 1;
            } else {
                quantityInput.disabled = true;
                quantityInput.value = 0;
            }

            updateModalPrices();
        });
    });

    // Add event listeners to all quantity inputs
    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('input', function() {
            const checkbox = this.closest('.modal-service-item').querySelector('.service-checkbox');

            if (parseInt(this.value) > 0) {
                checkbox.checked = true;
            } else {
                checkbox.checked = false;
                this.disabled = true;
            }

            updateModalPrices();
        });
    });
});

function updateModalPrices() {
    let total = 0;
    selectedServices = [];

    document.querySelectorAll('.service-checkbox').forEach(checkbox => {
        if (checkbox.checked) {
            const serviceName = checkbox.getAttribute('data-name');
            const servicePrice = parseFloat(checkbox.getAttribute('data-price'));
            const quantity = parseInt(checkbox.closest('.modal-service-item').querySelector('.quantity-input').value) || 1;

            total += servicePrice * quantity;
            selectedServices.push({
                name: serviceName,
                price: servicePrice,
                quantity: quantity,
                subtotal: servicePrice * quantity
            });
        }
    });

    customPackageTotal = total;
    const discount = total * 0.15; // 15% discount
    const finalPrice = total - discount;

    // Update display
    document.getElementById('totalPrice').textContent = `R$ ${total.toFixed(2)}`;
    document.getElementById('discountAmount').textContent = `- R$ ${discount.toFixed(2)}`;
    document.getElementById('finalPrice').textContent = `R$ ${finalPrice.toFixed(2)}`;
}

function confirmCustomPackage() {
    if (selectedServices.length === 0) {
        alert('Por favor, selecione pelo menos um serviço para continuar.');
        return;
    }

    // Create a summary of selected services
    const servicesSummary = selectedServices.map(s =>
        `${s.quantity}x ${s.name}`
    ).join(', ');

    // Calculate totals
    const discount = customPackageTotal * 0.15;
    const finalPrice = customPackageTotal - discount;

    // Add custom package to cart
    const item = {
        id: Date.now(),
        name: 'Pacote Personalizado',
        price: finalPrice,
        duration: servicesSummary,
        type: 'custom-package'
    };

    cart.push(item);
    saveCart();
    updateCartUI();

    // Close modal
    closeCustomPackageModal();

    // Show notification
    showCartNotification('Pacote Personalizado');

    // Show summary alert
    alert(`Pacote Personalizado Criado!\n\nServiços: ${servicesSummary}\n\nTotal: R$ ${customPackageTotal.toFixed(2)}\nDesconto (15%): R$ ${discount.toFixed(2)}\nTotal Final: R$ ${finalPrice.toFixed(2)}\n\nAdicionado ao carrinho!`);
}
