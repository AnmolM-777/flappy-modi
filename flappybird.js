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

	// Handle full-screen canvas resizing
	function handleResize() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	window.addEventListener('resize', handleResize);
	handleResize(); // Initial size

	// Assets
	const bgImg = new Image();
	bgImg.src = 'img/background.png';

	const modiImg = new Image();
	modiImg.src = 'img/modi.png';

	const pipeTopImg = new Image();
	pipeTopImg.src = 'img/rahul_top.png';

	const pipeBottomImg = new Image();
	pipeBottomImg.src = 'img/rahul_bottom.png';

	const flapSound = new Audio("sounds/modi's_song.mp3");
	const crashSound = new Audio('sounds/crash.mp3');
	const bgMusic = new Audio("sounds/modi's_song.mp3");
	bgMusic.loop = true;
	bgMusic.volume = 0.5;
	flapSound.volume = 0.8;
	crashSound.volume = 0.9;
	flapSound.preload = 'auto';
	crashSound.preload = 'auto';
	bgMusic.preload = 'auto';

	let audioPrimed = false;

	// Game state
	const G = { gravity: 0.277, flap: -7.2, pipeGap: 150, pipeFreq: 1495, pipeSpeed: 2.737 };
	let pipeSpacingPx = 420; // will be recalculated on reset based on viewport
	const PIPE_FACE_MIN = 140; // ensure faces stay visible for both top and bottom
	const bird = { x: 80, y: 0, r: 22, vel: 0, width: 46, height: 32, hitboxPadding: 6 };
	let pipes = [];
	let pipeCount = 0; // Track number of pipes spawned
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
		// Recompute spacing based on current viewport and pipe speed
		pipeSpacingPx = Math.max(canvas.width * 0.30, 380);
		G.pipeFreq = (pipeSpacingPx / (G.pipeSpeed * 60)) * 1000; // align spawn time with travel distance
		// Seed pipes across the screen so they are present immediately
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
		try { flapSound.currentTime = 0; flapSound.play(); } catch (e) { /* ignore */ }
	}

	function spawnPipe(xOverride) {
		const randomGap = Math.floor(Math.random() * (180 - 130 + 1)) + 130; // Gap between 130-180
		const minTop = PIPE_FACE_MIN;
		const maxTop = canvas.height - randomGap - PIPE_FACE_MIN;
		const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
		const pipeX = typeof xOverride === 'number' ? xOverride : canvas.width + pipeSpacingPx;
		pipes.push({ x: pipeX, top: topHeight, gap: randomGap, passed: false });
		pipeCount++;
	}

	function update(delta) {
		// Bird physics
		bird.vel += G.gravity;
		bird.y += bird.vel;

		// Ground / ceiling collision with hitbox padding
		const birdHitboxTop = bird.y - bird.height / 2 + bird.hitboxPadding;
		const birdHitboxBottom = bird.y + bird.height / 2 - bird.hitboxPadding;

		if (birdHitboxBottom >= canvas.height || birdHitboxTop <= 0) {
			return triggerGameOver();
		}

		// Pipes movement
		pipes.forEach(p => p.x -= G.pipeSpeed);
		pipes = pipes.filter(p => p.x > -80);

		// Scoring and collision with hitbox padding
		for (const p of pipes) {
			const pipeWidth = 70;
			const bottomY = p.top + p.gap;
			
			// Bird hitbox dimensions
			const birdLeft = bird.x - bird.width / 2 + bird.hitboxPadding;
			const birdRight = bird.x + bird.width / 2 - bird.hitboxPadding;
			
			// Pipe collision zones
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
		// Background - fill canvas with image scaled to fit
		if (bgImg.complete && bgImg.width > 0) {
			ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
		} else {
			// Fallback: clear canvas (transparent)
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}

		// Pipes
		pipes.forEach(p => {
			const pipeWidth = 70; // collision width
			const drawWidth = 146; // stretched visual width (30% increase)
			if (pipeTopImg.complete) {
				ctx.drawImage(pipeTopImg, p.x, p.top - pipeTopImg.height, drawWidth, pipeTopImg.height);
			} else {
				ctx.fillStyle = '#274064';
				ctx.fillRect(p.x, 0, pipeWidth, p.top);
			}

			const bottomY = p.top + p.gap;
			const bottomHeight = canvas.height - bottomY;
			if (pipeBottomImg.complete) {
				ctx.drawImage(pipeBottomImg, p.x, bottomY, drawWidth, pipeBottomImg.height);
			} else {
				ctx.fillStyle = '#274064';
				ctx.fillRect(p.x, bottomY, pipeWidth, bottomHeight);
			}
		});

		// Bird (Modi)
		const drawX = bird.x - bird.width / 2;
		const drawY = bird.y - bird.height / 2;
		if (modiImg.complete) {
			ctx.save();
			ctx.translate(drawX + bird.width / 2, drawY + bird.height / 2);
			ctx.rotate(Math.min(Math.max(bird.vel / 10, -0.35), 0.5));
			ctx.drawImage(modiImg, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
			ctx.restore();
		} else {
			ctx.fillStyle = '#ffb703';
			ctx.beginPath();
			ctx.arc(drawX + bird.width / 2, drawY + bird.height / 2, bird.r, 0, Math.PI * 2);
			ctx.fill();
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
		lastSpawn = lastTime; // spawn cadence handled by seeded pipes + pipeFreq
		try { bgMusic.currentTime = 0; bgMusic.play(); } catch (e) { /* ignore */ }
		loopId = requestAnimationFrame(loop);
	}

	function triggerGameOver() {
		running = false;
		gameOver = true;
		cancelAnimationFrame(loopId);
		try { bgMusic.pause(); } catch (e) { /* ignore */ }
		try { crashSound.currentTime = 0; crashSound.play(); } catch (e) { /* ignore */ }
		if (score > best) {
			best = score;
			localStorage.setItem('flappy-modi-best', best);
			bestEl.textContent = best;
		}
		
		// Update overlay text for game over
		document.querySelector('.game-branding h1').textContent = "Game Over!";
		document.querySelector('.tagline').textContent = `You scored ${score} points`;
		overlayHint.textContent = '';
		
		startBtn.classList.add('hidden');
		restartBtn.classList.remove('hidden');
		
		clearTimeout(overlayTimer);
		overlayTimer = setTimeout(() => overlay.classList.add('visible'), 400);
	}

	function onUserFlap() {
		if (!running) {
			startGame();
		} else {
			flap();
		}
	}

	function primeAudio() {
		if (audioPrimed) return;
		audioPrimed = true;
		const sounds = [bgMusic, flapSound, crashSound];
		sounds.forEach(snd => {
			snd.volume = snd.volume; // no-op touch to ensure property applied
			try {
				snd.play().then(() => snd.pause()).catch(() => {});
			} catch (e) {
				/* ignore */
			}
		});
		document.removeEventListener('pointerdown', primeAudio);
		document.removeEventListener('keydown', primeAudio);
	}

	// Input bindings
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
		try { bgMusic.pause(); } catch (e) { /* ignore */ }
	});

	resumeBtn.addEventListener('click', () => {
		paused = false;
		pauseOverlay.classList.remove('visible');
		try { bgMusic.play(); } catch (e) { /* ignore */ }
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

	// Initial setup
	handleResize();
	bird.y = canvas.height / 2;
	draw();
	overlay.classList.add('visible');
})();
