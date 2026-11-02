/* ==========================================================================
   Sabor Mineiro ACK - Inicialização e Efeitos de Interface
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Efeito de encolher cabeçalho ao rolar
    const header = document.getElementById('main-header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 80) {
                header.classList.add('py-2');
                header.classList.remove('py-3');
            } else {
                header.classList.add('py-3');
                header.classList.remove('py-2');
            }
        }, { passive: true });
    }

    // 2. Intersection Observer para animações de fade-in ao rolar
    if ('IntersectionObserver' in window) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -40px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in-up');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observar cards e seção de checkout
        document.querySelectorAll('.glass-card, #checkout-section').forEach(el => {
            el.style.opacity = '0';
            observer.observe(el);
        });
    }

    // 3. Carregar catálogo dinâmico de produtos
    if (typeof loadProductsCatalog === 'function') {
        loadProductsCatalog();
    }

    // 4. Estado inicial do botão de pedido
    if (typeof updateOrderButton === 'function') {
        updateOrderButton();
    }

    // 5. Listeners de input nos campos de nome e endereço
    //    para atualizar o estado do botão em tempo real
    const nameInput = document.getElementById('customer-name');
    const addressInput = document.getElementById('customer-address');

    if (nameInput) {
        nameInput.addEventListener('input', () => {
            if (typeof updateOrderButton === 'function') updateOrderButton();
        });
    }
    if (addressInput) {
        addressInput.addEventListener('input', () => {
            if (typeof updateOrderButton === 'function') updateOrderButton();
        });
    }

    // 6. Inicializar sistema de idiomas
    if (typeof initLanguage === 'function') {
        initLanguage();
    }

    // 7. Inicializar sistema de avaliações dos clientes
    if (typeof initReviews === 'function') {
        initReviews();
    }

    // 8. Atalho secreto para o administrador acessar o painel
    //    (5 cliques rápidos no copyright do rodapé OU pressionar Alt+A)
    let secretAdminClicks = 0;
    let secretAdminTimer = null;
    const secretTrigger = document.getElementById('secret-admin-trigger');

    if (secretTrigger) {
        secretTrigger.addEventListener('click', () => {
            secretAdminClicks++;
            clearTimeout(secretAdminTimer);
            if (secretAdminClicks >= 5) {
                window.location.href = 'admin.html';
                secretAdminClicks = 0;
            } else {
                secretAdminTimer = setTimeout(() => { secretAdminClicks = 0; }, 2500);
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'a' || e.key === 'A')) {
            window.location.href = 'admin.html';
        }
    });
});
