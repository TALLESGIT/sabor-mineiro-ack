/* ==========================================================================
   Sabor Mineiro ACK - Animação de Neve em Canvas
   Otimizado para performance em dispositivos móveis e desktop
   ========================================================================== */

(function initSnowAnimation() {
    const canvas = document.getElementById('snowCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId = null;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // Debounce no resize para evitar cálculos excessivos
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCanvas, 150);
    });
    resizeCanvas();

    // Redução de partículas no mobile para poupar bateria e manter 60 FPS
    const isMobile = window.innerWidth < 768;
    const flakeCount = isMobile ? 25 : 45;
    const flakes = [];

    for (let i = 0; i < flakeCount; i++) {
        flakes.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 3 + 1,
            d: Math.random() * flakeCount,
            speed: Math.random() * 0.8 + 0.2,
            sway: Math.random() * 0.5 + 0.3
        });
    }

    function drawSnow() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.beginPath();
        for (let i = 0; i < flakeCount; i++) {
            const f = flakes[i];
            ctx.moveTo(f.x, f.y);
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2, true);
        }
        ctx.fill();
        moveSnow();
    }

    let angle = 0;
    function moveSnow() {
        angle += 0.01;
        for (let i = 0; i < flakeCount; i++) {
            const f = flakes[i];
            f.y += f.speed;
            f.x += Math.sin(angle + f.d) * f.sway;

            if (f.y > canvas.height) {
                flakes[i].x = Math.random() * canvas.width;
                flakes[i].y = -f.r;
            }
            // Reposicionamento horizontal cíclico
            if (f.x > canvas.width + 5) f.x = -5;
            if (f.x < -5) f.x = canvas.width + 5;
        }
    }

    function animateSnow() {
        drawSnow();
        animationId = requestAnimationFrame(animateSnow);
    }

    // Iniciar animação
    animateSnow();

    // Pausar animação quando a aba não estiver visível (economia de bateria/CPU)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (animationId) cancelAnimationFrame(animationId);
        } else {
            animateSnow();
        }
    });
})();
