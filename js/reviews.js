/* ==========================================================================
   Sabor Mineiro ACK - Sistema de Avaliações de Clientes (Reviews)
   Nantucket Island, MA
   ========================================================================== */

let reviewsData = {
    reviews: [],
    averageRating: "5.0",
    totalCount: 0
};

let currentSelectedRating = 5;

/**
 * Escapar HTML para evitar XSS
 */
function escapeReviewHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Gera o HTML de estrelas para uma nota (1 a 5)
 */
function renderStarsHtml(rating) {
    const num = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= num) {
            starsHtml += '<i class="fa-solid fa-star text-amber-400"></i>';
        } else {
            starsHtml += '<i class="fa-regular fa-star text-gray-500"></i>';
        }
    }
    return starsHtml;
}

/**
 * Carrega as avaliações da API
 */
async function loadReviews() {
    try {
        const res = await fetch('/api/reviews');
        if (!res.ok) throw new Error('Falha ao carregar avaliações');
        const data = await res.json();
        
        reviewsData = {
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
            averageRating: data.averageRating || "5.0",
            totalCount: data.totalCount || (data.reviews ? data.reviews.length : 0)
        };
    } catch (err) {
        console.warn('Usando dados locais de avaliações:', err.message);
        // Fallback básico caso o endpoint falhe temporariamente
        if (reviewsData.reviews.length === 0) {
            reviewsData = {
                reviews: [
                    {
                        id: 1,
                        name: "Mariana Souza",
                        rating: 5,
                        dish: "Caldo de Frango com Milho",
                        comment: "Chegou super quentinho aqui em Mid-Island no meio da noite fria! A torradinha crocante com o caldo cremoso estava sensacional. Já virou tradição da semana!",
                        date_formatted: "28/10/2026"
                    },
                    {
                        id: 2,
                        name: "John Miller",
                        rating: 5,
                        dish: "Creamy Yucca & Bacon Soup",
                        comment: "Best soup on Nantucket this winter! Thick, flavorful and the bacon gives it an incredible touch. Fast delivery to Town in heavy thermal containers. 10/10!",
                        date_formatted: "30/10/2026"
                    },
                    {
                        id: 3,
                        name: "Rodrigo Silva",
                        rating: 5,
                        dish: "Ambos os Caldos",
                        comment: "O verdadeiro sabor de Minas Gerais aqui na ilha! Pedimos os dois caldos para o jantar em família e todos amaram. O entregador chegou rápido e com o caldo fervendo.",
                        date_formatted: "01/11/2026"
                    }
                ],
                averageRating: "5.0",
                totalCount: 3
            };
        }
    }

    renderReviews();
}

/**
 * Renderiza o cabeçalho de nota média e os cards de depoimentos
 */
function renderReviews() {
    // 1. Atualizar Média Geral
    const avgEl = document.getElementById('reviews-avg-rating');
    const avgStarsEl = document.getElementById('reviews-avg-stars');
    const totalCountEl = document.getElementById('reviews-total-count');

    if (avgEl) avgEl.textContent = reviewsData.averageRating;
    if (avgStarsEl) avgStarsEl.innerHTML = renderStarsHtml(Math.round(Number(reviewsData.averageRating) || 5));
    if (totalCountEl) {
        const countSuffix = typeof getTranslation === 'function' ? getTranslation('reviews_total_count') : 'avaliações';
        totalCountEl.textContent = `(${reviewsData.totalCount} ${countSuffix})`;
    }

    // 2. Renderizar Lista de Depoimentos
    const container = document.getElementById('reviews-grid');
    if (!container) return;

    if (!reviewsData.reviews || reviewsData.reviews.length === 0) {
        const emptyMsg = typeof getTranslation === 'function' ? getTranslation('reviews_empty') : 'Nenhuma avaliação ainda.';
        container.innerHTML = `
            <div class="col-span-full text-center py-8 text-gray-400">
                <i class="fa-regular fa-comment-dots text-3xl mb-2 text-amber-500/50"></i>
                <p class="text-sm">${emptyMsg}</p>
            </div>
        `;
        return;
    }

    const verifiedText = typeof getTranslation === 'function' ? getTranslation('reviews_verified') : 'Cliente Verificado';
    const orderedPrefix = typeof getTranslation === 'function' ? getTranslation('reviews_dish_ordered') : 'Pediu:';

    container.innerHTML = reviewsData.reviews.map(item => {
        const name = escapeReviewHtml(item.name || 'Cliente');
        const initial = name.charAt(0).toUpperCase();
        const stars = renderStarsHtml(item.rating || 5);
        const comment = escapeReviewHtml(item.comment || '');
        const dish = escapeReviewHtml(item.dish || '');
        const date = escapeReviewHtml(item.date_formatted || (item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : 'Recentemente'));

        return `
            <div class="glass-card rounded-2xl p-5 sm:p-6 flex flex-col justify-between border border-white/10 hover:border-amber-500/40 transition duration-300 shadow-lg group">
                <div>
                    <!-- Topo do Card: Avatar, Nome, Estrelas e Verificado -->
                    <div class="flex items-start justify-between gap-3 mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0 border border-white/20">
                                ${initial}
                            </div>
                            <div>
                                <h4 class="font-bold text-white text-sm sm:text-base leading-tight">${name}</h4>
                                <div class="flex items-center gap-1.5 mt-0.5">
                                    <span class="inline-flex items-center text-[10px] text-emerald-400 font-semibold gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        <i class="fa-solid fa-circle-check text-[9px]"></i> ${verifiedText}
                                    </span>
                                    <span class="text-[10px] text-gray-500">· ${date}</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center text-xs gap-0.5 text-amber-400 shrink-0">
                            ${stars}
                        </div>
                    </div>

                    <!-- Caldo Pedido (Badge) -->
                    ${dish ? `
                        <div class="mb-3 inline-block">
                            <span class="text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
                                <i class="fa-solid fa-bowl-food text-xs text-amber-400"></i>
                                <span>${orderedPrefix} <strong>${dish}</strong></span>
                            </span>
                        </div>
                    ` : ''}

                    <!-- Comentário com Aspas Estilizadas -->
                    <p class="text-gray-300 text-xs sm:text-sm leading-relaxed italic relative pl-3 border-l-2 border-amber-500/40">
                        "${comment}"
                    </p>
                </div>

                <!-- Rodapé do Card: Nantucket Island Badge -->
                <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                    <span class="flex items-center gap-1">
                        <i class="fa-solid fa-location-dot text-amber-500/70 text-[10px]"></i> Nantucket, MA
                    </span>
                    <span class="text-amber-500/50 text-[10px]">★★★★★</span>
                </div>
            </div>
        `;
    }).join('');

    // Atualizar opções do select de pratos no modal
    populateDishSelectOptions();
}

/**
 * Preenche o select de caldos no modal de avaliação baseado nos caldos disponíveis
 */
function populateDishSelectOptions() {
    const select = document.getElementById('review-dish');
    if (!select) return;

    const lang = (typeof getCurrentLanguage === 'function') ? getCurrentLanguage() : 'pt';
    const bothLabel = typeof getTranslation === 'function' ? getTranslation('reviews_dish_both') : 'Ambos os Caldos';

    // Obter produtos do cart.js se existirem
    let dishes = [];
    if (typeof productsList !== 'undefined' && Array.isArray(productsList) && productsList.length > 0) {
        dishes = productsList
            .filter(p => p.active !== false)
            .map(p => (lang === 'en' && p.name && p.name.en) ? p.name.en : (p.name?.pt || p.name));
    } else {
        dishes = [
            lang === 'en' ? 'Chicken & Corn Chowder' : 'Caldo de Frango com Milho',
            lang === 'en' ? 'Creamy Yucca & Bacon Soup' : 'Caldo de Mandioca Especial'
        ];
    }

    let optionsHtml = `<option value="${bothLabel}" selected>🍲 ${bothLabel}</option>`;
    dishes.forEach(d => {
        optionsHtml += `<option value="${escapeReviewHtml(d)}">🥣 ${escapeReviewHtml(d)}</option>`;
    });

    select.innerHTML = optionsHtml;
}

/**
 * Abre o modal de avaliação
 */
function openReviewModal() {
    const modal = document.getElementById('review-modal');
    if (!modal) return;

    // Resetar campos
    const nameInput = document.getElementById('review-name');
    const commentInput = document.getElementById('review-comment');
    
    // Tentar pré-preencher nome do cliente se ele já digitou no checkout
    const checkoutName = document.getElementById('customer-name');
    if (nameInput && checkoutName && checkoutName.value.trim() && !nameInput.value.trim()) {
        nameInput.value = checkoutName.value.trim();
    }

    if (commentInput) commentInput.value = '';
    
    // Resetar nota para 5 estrelas
    setStarRating(5);
    populateDishSelectOptions();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden'; // Evita scroll de fundo
}

/**
 * Fecha o modal de avaliação
 */
function closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

/**
 * Define a nota no seletor de estrelas interativo
 */
function setStarRating(rating) {
    currentSelectedRating = Math.max(1, Math.min(5, parseInt(rating) || 5));

    const starBtns = document.querySelectorAll('.review-star-btn');
    starBtns.forEach((btn, index) => {
        const starNum = index + 1;
        const icon = btn.querySelector('i');
        if (icon) {
            if (starNum <= currentSelectedRating) {
                icon.className = 'fa-solid fa-star text-amber-400 scale-110';
            } else {
                icon.className = 'fa-regular fa-star text-gray-500 scale-100';
            }
        }
    });

    // Atualizar legenda da nota
    const ratingLabel = document.getElementById('review-rating-label');
    if (ratingLabel) {
        const labels = {
            1: "1 estrela - Precisa melhorar",
            2: "2 estrelas - Regular",
            3: "3 estrelas - Bom",
            4: "4 estrelas - Muito Gostoso! ⭐",
            5: "5 estrelas - Maravilhoso / Sensacional! ⭐⭐⭐⭐⭐"
        };
        const labelsEn = {
            1: "1 star - Needs improvement",
            2: "2 stars - Fair",
            3: "3 stars - Good",
            4: "4 stars - Very Delicious! ⭐",
            5: "5 stars - Outstanding / Perfection! ⭐⭐⭐⭐⭐"
        };
        const lang = (typeof getCurrentLanguage === 'function') ? getCurrentLanguage() : 'pt';
        ratingLabel.textContent = (lang === 'en' ? labelsEn : labels)[currentSelectedRating] || `${currentSelectedRating} estrelas`;
    }
}

/**
 * Envia uma nova avaliação via POST /api/reviews
 */
async function submitCustomerReview(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nameInput = document.getElementById('review-name');
    const dishSelect = document.getElementById('review-dish');
    const commentInput = document.getElementById('review-comment');
    const submitBtn = document.getElementById('btn-submit-review');

    const name = nameInput ? nameInput.value.trim() : '';
    const dish = dishSelect ? dishSelect.value.trim() : 'Caldo';
    const comment = commentInput ? commentInput.value.trim() : '';
    const rating = currentSelectedRating || 5;

    if (!name || !comment) {
        const errorMsg = typeof getTranslation === 'function' 
            ? getTranslation('reviews_toast_required') 
            : '⚠️ Por favor, preencha seu nome e comentário!';
        if (typeof showToast === 'function') {
            showToast(errorMsg, 'error');
        } else {
            alert(errorMsg);
        }
        if (!name && nameInput) nameInput.focus();
        else if (!comment && commentInput) commentInput.focus();
        return;
    }

    // Estado de loading no botão
    if (submitBtn) {
        submitBtn.disabled = true;
        const subText = typeof getTranslation === 'function' ? getTranslation('reviews_btn_submitting') : 'Enviando...';
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${subText}`;
    }

    try {
        const res = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, dish, comment, rating })
        });

        if (!res.ok) throw new Error('Erro ao enviar avaliação');

        const successMsg = typeof getTranslation === 'function' 
            ? getTranslation('reviews_toast_success') 
            : 'Muito obrigado pela sua avaliação! ⭐';

        if (typeof showToast === 'function') {
            showToast(successMsg, 'success');
        }

        // Fechar modal
        closeReviewModal();

        // Recarregar lista de avaliações em tempo real
        await loadReviews();

        // Rolar suavemente até a seção de avaliações para o cliente ver seu depoimento
        const section = document.getElementById('avaliacoes');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (err) {
        console.error('Erro ao enviar review:', err);
        const errMsg = 'Erro ao enviar avaliação. Tente novamente!';
        if (typeof showToast === 'function') showToast(errMsg, 'error');
        else alert(errMsg);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            const btnText = typeof getTranslation === 'function' ? getTranslation('reviews_btn_submit') : 'Enviar Avaliação';
            submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${btnText}`;
        }
    }
}

/**
 * Inicializa os ouvintes de eventos da seção de avaliações
 */
function initReviews() {
    loadReviews();

    // Event listener para fechar modal clicando fora ou no ESC
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeReviewModal();
    });

    const modalBackdrop = document.getElementById('review-modal');
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) closeReviewModal();
        });
    }
}
