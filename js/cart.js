/* ==========================================================================
   Sabor Mineiro ACK - Gerenciamento Dinâmico de Produtos e Carrinho
   ========================================================================== */

const WHATSAPP_NUMBER = "17729403676";

// Catálogo de produtos padrão (fallback resiliente caso offline)
const DEFAULT_PRODUCTS = [
    {
        id: "frango",
        badge: { pt: "Favorito da Casa", en: "House Favorite" },
        badgeColor: "bg-orange-600",
        badgeIcon: "fa-star",
        name: {
            pt: "Caldo de Frango com Milho",
            en: "Chicken & Corn Chowder (Caldo de Frango)"
        },
        description: {
            pt: "Frango desfiado suculento, caldo super cremoso de milho verde fresco, milho inteiro, cheiro-verde e temperos especiais de Minas Gerais. Perfeito para aquecer os dias frios.",
            en: "Juicy shredded chicken breast, silky sweet corn chowder, whole corn kernels, fresh scallions, and traditional Minas Gerais seasoning. Perfect for cold island days."
        },
        extra: {
            pt: "Acompanha cheiro-verde e torradas artesanais quentinhas",
            en: "Includes fresh herbs and warm artisanal toast"
        },
        price: 20,
        image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
        imageFallback: "https://placehold.co/800x600/261c16/f39c12?text=Caldo+de+Frango",
        active: true
    },
    {
        id: "mandioca",
        badge: { pt: "Tradicional Mineiro", en: "Traditional Brazilian" },
        badgeColor: "bg-amber-600",
        badgeIcon: "fa-crown",
        name: {
            pt: "Caldo de Mandioca Especial",
            en: "Creamy Yucca & Bacon Soup (Caldo de Mandioca)"
        },
        description: {
            pt: "Mandioca selecionada extremamente aveludada, cozida lentamente com temperos caseiros, refogado de alho, cebola, bacon e cheiro-verde. Sabor marcante e inesquecível!",
            en: "Smooth, velvety cassava/yucca root slowly simmered with sautéed garlic, sweet onions, crispy bacon bits, and fresh herbs. Rich, hearty, and deeply satisfying!"
        },
        extra: {
            pt: "Acompanha torresmo / cheiro-verde e torradas",
            en: "Includes crispy bacon / fresh herbs and toast"
        },
        price: 20,
        image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80",
        imageFallback: "https://placehold.co/800x600/261c16/f39c12?text=Caldo+de+Mandioca",
        active: true
    }
];

// Lista de produtos ativa
let productsList = [...DEFAULT_PRODUCTS];

// Estado do carrinho: { [productId]: quantity }
const cart = {};

/**
 * Retorna o produto pelo ID
 * @param {string} id 
 */
function getProductById(id) {
    return productsList.find(p => p.id === id);
}

/**
 * Retorna o nome do produto no idioma ativo
 * @param {string} productId 
 */
function getItemName(productId) {
    const lang = (typeof getCurrentLanguage === 'function') ? getCurrentLanguage() : 'pt';
    const product = getProductById(productId);
    if (!product) return productId;
    return (product.name && (product.name[lang] || product.name.pt)) || productId;
}

/**
 * Carrega a lista de produtos (API -> localStorage -> JSON estático -> DEFAULT)
 */
async function loadProductsCatalog() {
    try {
        const res = await fetch('/api/products?t=' + Date.now());
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                productsList = data;
                try {
                    localStorage.setItem('sabor_mineiro_custom_products', JSON.stringify(data));
                } catch (e) {}
            }
        } else {
            throw new Error('API indisponível');
        }
    } catch (err) {
        const local = localStorage.getItem('sabor_mineiro_custom_products');
        if (local) {
            try {
                const parsed = JSON.parse(local);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    productsList = parsed;
                }
            } catch (e) {}
        } else {
            try {
                const jsonRes = await fetch('products.json?t=' + Date.now());
                if (jsonRes.ok) {
                    const jsonData = await jsonRes.json();
                    if (Array.isArray(jsonData) && jsonData.length > 0) {
                        productsList = jsonData;
                    }
                }
            } catch (e) {}
        }
    }

    // Inicializar estado do carrinho para os produtos
    productsList.forEach(p => {
        if (cart[p.id] === undefined) {
            cart[p.id] = 0;
        }
    });

    renderProductsGrid();
    renderCartSummary();
    updateOrderButton();
}

/**
 * Renderiza dinamicamente o grid de produtos no cardápio
 */
function renderProductsGrid() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    const lang = (typeof getCurrentLanguage === 'function') ? getCurrentLanguage() : 'pt';
    const isEn = lang === 'en';
    const activeProducts = productsList.filter(p => p.active !== false);

    if (activeProducts.length === 0) {
        grid.innerHTML = `
            <div class="col-span-2 text-center py-12 glass-card rounded-2xl p-6">
                <p class="text-gray-400 text-sm">Nenhum caldo disponível no momento.</p>
            </div>`;
        return;
    }

    grid.innerHTML = activeProducts.map((p) => {
        const name = (p.name && (p.name[lang] || p.name.pt)) || 'Caldo Especial';
        const desc = (p.description && (p.description[lang] || p.description.pt)) || '';
        const extra = (p.extra && (p.extra[lang] || p.extra.pt)) || '';
        const badgeText = (p.badge && (p.badge[lang] || p.badge.pt)) || '';
        const badgeColor = p.badgeColor || 'bg-amber-600';
        const badgeIcon = p.badgeIcon || 'fa-star';
        const price = p.price || 20;
        const qty = cart[p.id] || 0;
        const qtyLabel = isEn ? 'Quantity:' : 'Quantidade:';

        return `
            <div class="glass-card rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col justify-between" id="card-${p.id}">
                <div>
                    <div class="relative h-48 sm:h-64 overflow-hidden group">
                        <div class="absolute inset-0 img-skeleton"></div>
                        <img src="${p.image || p.imageFallback}" 
                             alt="${name}" 
                             class="w-full h-full object-cover transition duration-500 group-hover:scale-105 relative z-[1]"
                             loading="lazy"
                             onerror="this.src='${p.imageFallback || 'https://placehold.co/800x600/261c16/f39c12?text=Caldo'}'">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-[2]"></div>
                        
                        ${badgeText ? `
                            <span class="absolute top-3 sm:top-4 left-3 sm:left-4 ${badgeColor} text-white font-bold text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-lg uppercase tracking-wider z-[3]">
                                <i class="fa-solid ${badgeIcon} mr-1"></i> <span>${badgeText}</span>
                            </span>
                        ` : ''}

                        <div class="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 bg-black/60 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-lg border border-white/10 text-amber-400 font-bold text-lg sm:text-xl z-[3]">
                            $${price} <span class="text-[10px] sm:text-xs font-normal text-gray-300">USD</span>
                        </div>
                    </div>

                    <div class="p-5 sm:p-6 md:p-8">
                        <h4 class="text-xl sm:text-2xl font-bold text-white mb-3">${name}</h4>
                        <p class="text-gray-300 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6">
                            ${desc}
                        </p>
                        ${extra ? `
                            <div class="flex items-start gap-2 text-[11px] sm:text-xs text-amber-300 bg-amber-500/10 p-2.5 sm:p-3 rounded-xl mb-4 sm:mb-6 border border-amber-500/20">
                                <i class="fa-solid fa-circle-check text-amber-400 mt-0.5 flex-shrink-0"></i>
                                <span>${extra}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="px-5 sm:px-6 md:px-8 pb-5 sm:pb-6 pt-3 border-t border-white/5 flex items-center justify-between bg-black/20">
                    <span class="text-xs sm:text-sm text-gray-400 font-medium">${qtyLabel}</span>
                    <div class="flex items-center space-x-2 sm:space-x-3 bg-brand-dark/80 p-1 sm:p-1.5 rounded-xl border border-white/10">
                        <button onclick="updateQty('${p.id}', -1)" aria-label="Remover 1 ${name}" class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/5 hover:bg-amber-600/30 text-amber-400 flex items-center justify-center font-bold text-lg transition active:scale-90 touch-manipulation">
                            <i class="fa-solid fa-minus text-xs"></i>
                        </button>
                        <span id="qty-${p.id}" class="w-8 text-center font-bold text-lg text-white select-none">${qty}</span>
                        <button onclick="updateQty('${p.id}', 1)" aria-label="Adicionar 1 ${name}" class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center font-bold text-lg transition active:scale-90 touch-manipulation">
                            <i class="fa-solid fa-plus text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Exibe notificação temporária no topo da tela
 * @param {string} message 
 * @param {'success'|'warning'} type 
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    void toast.offsetHeight;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

/**
 * Atualiza a quantidade de um item no carrinho
 * @param {string} itemId 
 * @param {number} change 
 */
function updateQty(itemId, change) {
    if (cart[itemId] === undefined) {
        cart[itemId] = 0;
    }

    if (cart[itemId] + change >= 0) {
        cart[itemId] += change;
        
        const qtyEl = document.getElementById(`qty-${itemId}`);
        if (qtyEl) {
            qtyEl.innerText = cart[itemId];
            qtyEl.classList.remove('qty-animate');
            void qtyEl.offsetHeight;
            qtyEl.classList.add('qty-animate');
        }
        
        renderCartSummary();
        updateCartBadge();
        updateOrderButton();

        if (change > 0) {
            const t = (typeof getTranslation === 'function') ? getTranslation('toast_item_added') : 'adicionado!';
            showToast(`✅ ${getItemName(itemId)} ${t}`, 'success');
        }
    }
}

/**
 * Retorna o total de itens no carrinho
 */
function getTotalCartItems() {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

/**
 * Retorna o valor total do carrinho em USD
 */
function getTotalCartPrice() {
    let total = 0;
    for (const [id, qty] of Object.entries(cart)) {
        if (qty > 0) {
            const product = getProductById(id);
            const price = product ? (product.price || 20) : 20;
            total += qty * price;
        }
    }
    return total;
}

/**
 * Atualiza o badge numérico no topo (carrinho)
 */
function updateCartBadge() {
    const total = getTotalCartItems();
    const badge = document.getElementById('cart-badge');
    if (badge) {
        badge.textContent = total;
        badge.classList.toggle('visible', total > 0);
    }
}

/**
 * Verifica se os dados do cliente (nome e endereço) estão preenchidos
 */
function getCustomerData() {
    const nameInput = document.getElementById('customer-name');
    const addressInput = document.getElementById('customer-address');
    const name = nameInput ? nameInput.value.trim() : '';
    const address = addressInput ? addressInput.value.trim() : '';
    return {
        name,
        address,
        hasName: name.length > 0,
        hasAddress: address.length > 0,
        isComplete: name.length > 0 && address.length > 0
    };
}

/**
 * Habilita ou desabilita o botão de enviar pedido
 */
function updateOrderButton() {
    const totalItems = getTotalCartItems();
    const { isComplete, hasName, hasAddress } = getCustomerData();
    const btn = document.getElementById('btn-whatsapp-order');
    const hintEl = document.getElementById('order-hint');

    const canOrder = totalItems > 0 && isComplete;

    if (btn) {
        btn.disabled = !canOrder;
    }

    if (hintEl) {
        const t = (typeof getTranslation === 'function') ? getTranslation : (k) => k;

        if (totalItems === 0) {
            hintEl.textContent = t('order_empty_cart_hint');
            hintEl.className = 'order-hint order-hint--warning';
        } else if (!hasName && !hasAddress) {
            hintEl.textContent = t('order_fill_both_hint');
            hintEl.className = 'order-hint order-hint--warning';
        } else if (!hasName) {
            hintEl.textContent = t('order_fill_name_hint');
            hintEl.className = 'order-hint order-hint--warning';
        } else if (!hasAddress) {
            hintEl.textContent = t('order_fill_address_hint');
            hintEl.className = 'order-hint order-hint--warning';
        } else {
            hintEl.textContent = t('order_ready_hint');
            hintEl.className = 'order-hint order-hint--ready';
        }
    }
}

/**
 * Renderiza o resumo detalhado do carrinho
 */
function renderCartSummary() {
    const totalItems = getTotalCartItems();
    const totalPrice = getTotalCartPrice();
    const summaryEl = document.getElementById('cart-summary');
    const totalPriceEl = document.getElementById('total-price');

    const t = (typeof getTranslation === 'function') ? getTranslation : (k) => k;

    if (totalPriceEl) {
        totalPriceEl.innerText = totalPrice;
    }

    if (!summaryEl) return;

    if (totalItems === 0) {
        summaryEl.innerHTML = `<div class="text-gray-400 italic text-xs sm:text-sm">${t('cart_empty')}</div>`;
        return;
    }

    const itemWord = totalItems === 1 ? t('cart_item_singular') : t('cart_item_plural');

    let html = '<div class="space-y-0">';
    
    for (const [id, qty] of Object.entries(cart)) {
        if (qty > 0) {
            const product = getProductById(id);
            const price = product ? (product.price || 20) : 20;
            const subtotal = qty * price;
            html += `<div class="cart-item-row">
                <span class="flex items-center gap-2"><span class="text-base">🥣</span> <span class="font-medium">${qty}x ${getItemName(id)}</span></span>
                <span class="text-amber-400 font-bold ml-2 whitespace-nowrap">$${subtotal} USD</span>
            </div>`;
        }
    }
    
    html += `<div class="flex justify-between items-center pt-2 mt-2 border-t border-white/10">
        <span class="font-semibold text-white text-xs sm:text-sm">${t('cart_total_prefix')} (${totalItems} ${itemWord})</span>
        <span class="text-amber-400 font-extrabold text-sm sm:text-base">$${totalPrice}.00 USD</span>
    </div>`;
    html += '</div>';

    summaryEl.innerHTML = html;
}

// Estado de localização GPS
let customerLocation = null;

/**
 * Obtém a localização GPS atual do cliente via navegador
 */
async function getCurrentLocation() {
    const btn = document.getElementById('btn-get-location');
    const statusDiv = document.getElementById('location-status');
    const statusText = document.getElementById('location-status-text');
    const addressInput = document.getElementById('customer-address');
    const t = (typeof getTranslation === 'function') ? getTranslation : (k) => k;

    if (!navigator.geolocation) {
        showToast(t('location_error'), 'warning');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-amber-400"></i> <span>${t('location_fetching')}</span>`;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;

            customerLocation = { lat, lng, mapUrl };

            // Tentar reverse geocoding via OpenStreetMap (gratuito)
            let detectedAddress = '';
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.address) {
                        const a = data.address;
                        const road = a.road || a.pedestrian || a.street || '';
                        const num = a.house_number || '';
                        const town = a.city || a.town || a.village || a.suburb || 'Nantucket';
                        if (road) {
                            detectedAddress = num ? `${num} ${road}, ${town}` : `${road}, ${town}`;
                        } else if (data.display_name) {
                            detectedAddress = data.display_name.split(',').slice(0, 3).join(',').trim();
                        }
                    }
                }
            } catch (e) {
                // Silencioso se der timeout
            }

            if (addressInput) {
                if (detectedAddress) {
                    addressInput.value = detectedAddress;
                } else if (!addressInput.value.trim()) {
                    addressInput.value = `Nantucket, MA (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
                }
                addressInput.classList.add('border-emerald-500/50');
            }

            if (statusDiv && statusText) {
                statusDiv.classList.remove('hidden');
                statusText.textContent = t('location_success');
            }

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> <span class="text-emerald-400 font-semibold">${t('btn_use_location')}</span>`;
            }

            showToast(`📍 ${t('location_success')}`, 'success');
            updateOrderButton();
        },
        (err) => {
            console.warn('Geolocation error:', err);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-location-crosshairs text-amber-400"></i> <span>${t('btn_use_location')}</span>`;
            }
            showToast(t('location_error'), 'warning');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

/**
 * Monta e envia a mensagem formatada para o WhatsApp
 */
function sendWhatsAppOrder() {
    const totalItems = getTotalCartItems();
    const t = (typeof getTranslation === 'function') ? getTranslation : (k) => k;

    if (totalItems === 0) {
        showToast(t('toast_empty_cart'), "warning");
        return;
    }

    const { name, address, isComplete } = getCustomerData();

    if (!isComplete) {
        showToast(t('toast_fill_details'), "warning");
        if (!name) {
            const nameInput = document.getElementById('customer-name');
            if (nameInput) nameInput.focus();
        } else {
            const addressInput = document.getElementById('customer-address');
            if (addressInput) addressInput.focus();
        }
        return;
    }

    const totalPrice = getTotalCartPrice();
    const lang = (typeof getCurrentLanguage === 'function') ? getCurrentLanguage() : 'pt';

    let message;
    if (lang === 'en') {
        message = `*Hello! I'd like to place an order at Sabor Mineiro ACK!*\n\n`;
        message += `*ORDER ITEMS:*\n`;
        for (const [id, qty] of Object.entries(cart)) {
            if (qty > 0) {
                const product = getProductById(id);
                const price = product ? (product.price || 20) : 20;
                message += `• ${qty}x ${getItemName(id)} ($${qty * price})\n`;
            }
        }
        message += `\n*TOTAL:* $${totalPrice}.00 USD\n`;
        message += `*Customer:* ${name}\n`;
        message += `*Delivery Address:* ${address} (Nantucket)\n`;
        const mapUrl = (customerLocation && customerLocation.mapUrl)
            ? customerLocation.mapUrl
            : `https://maps.google.com/?q=${encodeURIComponent(address)}`;
        message += `📍 *Google Maps (GPS / Rota):* ${mapUrl}\n`;
        message += `\n_Awaiting confirmation and estimated delivery time!_`;
    } else {
        message = `*Olá! Gostaria de fazer um pedido no Sabor Mineiro ACK!*\n\n`;
        message += `*ITENS DO PEDIDO:*\n`;
        for (const [id, qty] of Object.entries(cart)) {
            if (qty > 0) {
                const product = getProductById(id);
                const price = product ? (product.price || 20) : 20;
                message += `• ${qty}x ${getItemName(id)} ($${qty * price})\n`;
            }
        }
        message += `\n*VALOR TOTAL:* $${totalPrice}.00 USD\n`;
        message += `*Cliente:* ${name}\n`;
        message += `*Endereço para entrega:* ${address}\n`;
        const mapUrl = (customerLocation && customerLocation.mapUrl)
            ? customerLocation.mapUrl
            : `https://maps.google.com/?q=${encodeURIComponent(address)}`;
        message += `📍 *Google Maps (GPS / Rota):* ${mapUrl}\n`;
        message += `\n_Aguardando confirmação e tempo estimado de entrega!_`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');

    resetCart();
}

/**
 * Reseta o carrinho e limpa os campos do formulário após envio do pedido
 */
function resetCart() {
    customerLocation = null;
    const statusDiv = document.getElementById('location-status');
    if (statusDiv) statusDiv.classList.add('hidden');
    const btnLoc = document.getElementById('btn-get-location');
    if (btnLoc) {
        const t = (typeof getTranslation === 'function') ? getTranslation : (k) => k;
        btnLoc.innerHTML = `<i class="fa-solid fa-location-crosshairs text-amber-400"></i> <span data-i18n="btn_use_location">${t('btn_use_location')}</span>`;
    }

    for (const id of Object.keys(cart)) {
        cart[id] = 0;
        const qtyEl = document.getElementById(`qty-${id}`);
        if (qtyEl) qtyEl.innerText = '0';
    }

    const nameInput = document.getElementById('customer-name');
    const addressInput = document.getElementById('customer-address');
    if (nameInput) nameInput.value = '';
    if (addressInput) addressInput.value = '';

    renderCartSummary();
    updateCartBadge();
    updateOrderButton();
}
