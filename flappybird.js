(() => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const overlay = document.getElementById('overlay');
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseOverlay = document.getElementById('pauseOverlay');
    const resumeBtn = document.getElementById('resumeBtn');
    const pauseRestartBtn = document.getElementById('pauseRestartBtn');
    const overlayHint = document.getElementById('overlayHint');
    const scoreEl = document.getElementById('score');
    const bestEl = document.getElementById('best');
    let overlayTimer;

    function handleResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    // IMAGES
    const bgImg = new Image();
    bgImg.src = 'img/background.png';

    const modiImg = new Image();
    modiImg.src = 'img/modi.png';

    const pipeTopImg = new Image();
    pipeTopImg.src = 'img/rahul_top.png';

    const pipeBottomImg = new Image();
    pipeBottomImg.src = 'img/rahul_bottom.png';

    // === AUDIO ===
    // flap sound (can be changed later)
    const flapSound = new Audio("sound/obsessed_modi_ji.mp3");
    flapSound.volume = 0.6;

    // running music (loops)
    const runningSound = new Audio("sound/obsessed_modi_ji.mp3");
    runningSound.loop = true;
    runningSound.volume = 0.6;

    // crash / out sound
    const outSound = new Audio("sound/Maza Nahi Aa Raha Hai Meme Download Mp3.mp3");
    outSound.volume = 0.9;

    let audioPrimed = false;

    // GAME STATE
    const G = { gravity: 0.277, flap: -7.2, pipeGap: 150, pipeFreq: 1495, pipeSpeed: 2.737 };
    let pipeSpacingPx = 420;

    const PIPE_FACE_MIN = 140;

    const bird = { x: 80, y: 0, r: 22, vel: 0, width: 46, height: 32, hitboxPadding: 6 };
    let pipes = [];
    let pipeCount = 0;
    let score = 0;
    let best = Number(localStorage.getItem('flappy-modi-best') || 0);
    let running = false;
    let paused = false;
    let gameOver = false;
    let loopId;

    bestEl.textContent = best;

    function reset() {
        pipes = [];
        pipeCount = 0;
        bird.y = canvas.height / 2;
        bird.vel = 0;
        score = 0;
        gameOver = false;

        pipeSpacingPx = Math.max(canvas.width * 0.30, 380);
        G.pipeFreq = (pipeSpacingPx / (G.pipeSpeed * 60)) * 1000;

        const firstX = canvas.width * 0.4;
        for (let x = firstX; x < canvas.width * 1.8; x += pipeSpacingPx) {
            spawnPipe(x);
        }

        scoreEl.textContent = score;
        overlayHint.textContent = 'Tap, click, or press space to flap.';
        restartBtn.classList.add('hidden');
        startBtn.classList.remove('hidden');
    }

    function flap() {
        if (gameOver) return;
        bird.vel = G.flap;
        
        try { 
            flapSound.currentTime = 0; 
            flapSound.play(); 
        } catch {}
    }

    function spawnPipe(xOverride) {
        const randomGap = Math.floor(Math.random() * (180 - 130 + 1)) + 130;
        const minTop = PIPE_FACE_MIN;
        const maxTop = canvas.height - randomGap - PIPE_FACE_MIN;
        const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
        const pipeX = typeof xOverride === 'number' ? xOverride : canvas.width + pipeSpacingPx;

        pipes.push({ x: pipeX, top: topHeight, gap: randomGap, passed: false });
        pipeCount++;
    }

    function update(delta) {
        bird.vel += G.gravity;
        bird.y += bird.vel;

        const birdHitboxTop = bird.y - bird.height / 2 + bird.hitboxPadding;
        const birdHitboxBottom = bird.y + bird.height / 2 - bird.hitboxPadding;

        if (birdHitboxBottom >= canvas.height || birdHitboxTop <= 0) {
            return triggerGameOver();
        }

        pipes.forEach(p => p.x -= G.pipeSpeed);
        pipes = pipes.filter(p => p.x > -80);

        for (const p of pipes) {
            const pipeWidth = 70;
            const bottomY = p.top + p.gap;

            const birdLeft = bird.x - bird.width / 2 + bird.hitboxPadding;
            const birdRight = bird.x + bird.width / 2 - bird.hitboxPadding;

            const inX = birdRight > p.x && birdLeft < p.x + pipeWidth;
            const hitTop = birdHitboxTop < p.top;
            const hitBottom = birdHitboxBottom > bottomY;

            if (inX && (hitTop || hitBottom)) {
                return triggerGameOver();
            }

            if (!p.passed && p.x + pipeWidth < bird.x) {
                p.passed = true;
                score += 1;
                scoreEl.textContent = score;
            }
        }
    }

    function draw() {
        if (bgImg.complete && bgImg.width > 0) {
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        pipes.forEach(p => {
            const drawWidth = 146;

            if (pipeTopImg.complete) {
                ctx.drawImage(pipeTopImg, p.x, p.top - pipeTopImg.height, drawWidth, pipeTopImg.height);
            }

            const bottomY = p.top + p.gap;

            if (pipeBottomImg.complete) {
                ctx.drawImage(pipeBottomImg, p.x, bottomY, drawWidth, pipeBottomImg.height);
            }
        });

        const drawX = bird.x - bird.width / 2;
        const drawY = bird.y - bird.height / 2;

        if (modiImg.complete) {
            ctx.save();
            ctx.translate(drawX + bird.width / 2, drawY + bird.height / 2);
            ctx.rotate(Math.min(Math.max(bird.vel / 10, -0.35), 0.5));
            ctx.drawImage(modiImg, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
            ctx.restore();
        }
    }

    let lastSpawn = 0;
    let lastTime = 0;

    function loop(timestamp) {
        if (!running || paused) return;

        const delta = timestamp - lastTime;
        lastTime = timestamp;

        if (timestamp - lastSpawn > G.pipeFreq) {
            spawnPipe();
            lastSpawn = timestamp;
        }

        update(delta);
        draw();

        loopId = requestAnimationFrame(loop);
    }

    function startGame() {
        clearTimeout(overlayTimer);
        reset();
        running = true;
        paused = false;

        overlay.classList.remove('visible');
        pauseBtn.classList.remove('hidden');
        pauseOverlay.classList.remove('visible');

        lastTime = performance.now();
        lastSpawn = lastTime;

        try {
            runningSound.currentTime = 0;
            runningSound.play();
        } catch {}

        loopId = requestAnimationFrame(loop);
    }

    function triggerGameOver() {
        running = false;
        gameOver = true;
        cancelAnimationFrame(loopId);
        
        try {
            runningSound.pause();
            runningSound.currentTime = 0;   // <- important reset
        } catch {}
        try {
            outSound.currentTime = 0;
            outSound.play();
        } catch {}

        if (score > best) {
            best = score;
            localStorage.setItem('flappy-modi-best', best);
            bestEl.textContent = best;
        }

        document.querySelector('.game-branding h1').textContent = "Game Over!";
        document.querySelector('.tagline').textContent = `You scored ${score} points`;
        overlayHint.textContent = '';

        startBtn.classList.add('hidden');
        restartBtn.classList.remove('hidden');

        clearTimeout(overlayTimer);
        overlayTimer = setTimeout(() => overlay.classList.add('visible'), 400);
    }

    function onUserFlap() {
        if (!running) startGame();
        else flap();
    }

    function primeAudio() {
        if (audioPrimed) return;
        audioPrimed = true;

        const sounds = [runningSound, flapSound, outSound];

        sounds.forEach(snd => {
            try {
                snd.play().then(() => snd.pause()).catch(() => {});
            } catch {}
        });

        document.removeEventListener('pointerdown', primeAudio);
        document.removeEventListener('keydown', primeAudio);
    }

    window.addEventListener('keydown', e => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            onUserFlap();
        }

        if (gameOver && e.code === 'Enter') {
            document.querySelector('.game-branding h1').textContent = "Flappy Modi";
            document.querySelector('.tagline').textContent = "Tap, click, or hit space to keep Modi flying.";
            startGame();
        }
    });

    canvas.addEventListener('pointerdown', onUserFlap);
    startBtn.addEventListener('click', startGame);

    restartBtn.addEventListener('click', () => {
        document.querySelector('.game-branding h1').textContent = "Flappy Modi";
        document.querySelector('.tagline').textContent = "Tap, click, or hit space to keep Modi flying.";
        startGame();
    });

    pauseBtn.addEventListener('click', () => {
        if (!running || gameOver) return;
        paused = true;
        pauseOverlay.classList.add('visible');
        try { runningSound.pause(); } catch {}
    });

    resumeBtn.addEventListener('click', () => {
        paused = false;
        pauseOverlay.classList.remove('visible');

        try { runningSound.play(); } catch {}

        lastTime = performance.now();
        loopId = requestAnimationFrame(loop);
    });

    pauseRestartBtn.addEventListener('click', () => {
        document.querySelector('.game-branding h1').textContent = "Flappy Modi";
        document.querySelector('.tagline').textContent = "Tap, click, or hit space to keep Modi flying.";
        startGame();
    });

    document.addEventListener('pointerdown', primeAudio);
    document.addEventListener('keydown', primeAudio);

    handleResize();
    bird.y = canvas.height / 2;
    draw();
    overlay.classList.add('visible');
})();
