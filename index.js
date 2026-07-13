const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

canvas.width = 1024;
canvas.height = 576;

c.imageSmoothingEnabled = false;

function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

const upButton = document.getElementById('up');
const downButton = document.getElementById('down');
const leftButton = document.getElementById('left');
const rightButton = document.getElementById('right');
const attackButton = document.getElementById('attack');
const inventoryButton = document.getElementById('inventory-btn');
const pauseButton = document.getElementById('pause-btn');

// Evita el menú contextual (long-press) en todos los botones táctiles
// y en el canvas, para que mantener presionado nunca abra un popup
// nativo de "Guardar imagen / Compartir / Imprimir".
const touchControlButtons = [
    upButton, downButton, leftButton, rightButton,
    attackButton, inventoryButton, pauseButton
];
for (const btn of touchControlButtons) {
    if (!btn) continue;
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const image = new Image();
const image2 = new Image();
const image3 = new Image();
const getoUpImage = new Image();
const getoDownImage = new Image();
const getoLeftImage = new Image();
const getoRightImage = new Image();

const gojoUpImage = new Image();
const gojoDownImage = new Image();
const gojoLeftImage = new Image();
const gojoRightImage = new Image();

const blackRabbitUpImage = new Image();
const blackRabbitDownImage = new Image();
const blackRabbitLeftImage = new Image();
const blackRabbitRightImage = new Image();
const whiteRabbitUpImage = new Image();
const whiteRabbitDownImage = new Image();
const whiteRabbitLeftImage = new Image();
const whiteRabbitRightImage = new Image();

const heartImage = new Image();
const noteImage = new Image();
const letter = new Image();
const bossImage = new Image();
const danceGetoImage = new Image();
const danceGojoImage = new Image();
const danceAuthorImage = new Image();
const cakeImage = new Image();
const topImage = new Image();
const topImage2 = new Image();
const deadGojoImage = new Image();

let currentMap = 1;
let currentMapImage = image;
let currentCollisionsMap;

const MAP1_TO_MAP2_TRIGGER_ROW = 0;
const MAP1_TO_MAP2_TRIGGER_COLUMN = 14;

const MAP2_TO_MAP1_TRIGGER_ROW = 29;
const MAP2_TO_MAP1_TRIGGER_COLUMN = 14;

const MAP2_ENTRY_ROW = 28;
const MAP2_ENTRY_COLUMN = 14;
const MAP1_ENTRY_ROW = 1;
const MAP1_ENTRY_COLUMN = 14;
let MAP2_ENTRY_X, MAP2_ENTRY_Y, MAP1_ENTRY_X, MAP1_ENTRY_Y;

let hearts = [];
let curses = [];
let groundNotes = [];
let PN = null;
let groundLetter = null;
let boss = null;

// =====================================================================
// SISTEMA DE ANIMACIÓN POR SPRITESHEET
// =====================================================================
const SPRITE_FRAME_COUNT = 4;
// FIX #1: frame "idle" (parado) por defecto para todos los personajes.
// Se usa como frame inicial y como frame de congelado al detenerse,
// en vez de quedar en 0 o en un frame aleatorio.
const IDLE_FRAME = 1;

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 90;
const MINIMAP_MARGIN = 16;
const MINIMAP_X = canvas.width - MINIMAP_WIDTH - MINIMAP_MARGIN;
const MINIMAP_Y = MINIMAP_MARGIN + 30;
const MINIMAP_DOT_SIZE = 5;

const ANIMATION_IMAGES = {};
let spritesLoaded = 0;
let spritesTotal = 0;

function loadAnimationSources(onAllLoaded) {
    for (const character in ANIMATION_SOURCES) {
        for (const state in ANIMATION_SOURCES[character]) {
            spritesTotal += Object.keys(ANIMATION_SOURCES[character][state]).length;
        }
    }
    for (const character in ANIMATION_SOURCES) {
        ANIMATION_IMAGES[character] = {};
        for (const state in ANIMATION_SOURCES[character]) {
            ANIMATION_IMAGES[character][state] = {};
            for (const direction in ANIMATION_SOURCES[character][state]) {
                const img = new Image();
                img.onload = () => {
                    spritesLoaded++;
                    if (spritesLoaded === spritesTotal && typeof onAllLoaded === "function") {
                        onAllLoaded();
                    }
                };
                img.src = ANIMATION_SOURCES[character][state][direction];
                ANIMATION_IMAGES[character][state][direction] = img;
            }
        }
    }
}

function getFrameSourceRect(frameIndex) {
    return {
        sx: frameIndex * SPRITE_FRAME_SIZE,
        sy: 0,
        sw: SPRITE_FRAME_SIZE,
        sh: SPRITE_FRAME_SIZE,
    };
}

class AnimationController {
    constructor(character, frameDuration = 120, attackFrameDuration = 100) {
        this.character = character;
        this.state = "walk";
        this.direction = "front";
        // FIX #1: el frame inicial ahora es IDLE_FRAME (2) en vez de 0,
        // así el personaje aparece en la postura idle correcta desde el
        // primer render (soluciona a Geto no iniciando en la postura correcta).
        this.frame = IDLE_FRAME;
        this.elapsed = 0;
        this.frameDuration = frameDuration;
        // FIX (Requerimiento 3): duración de frame DEDICADA para el estado
        // "attack", fijada por defecto a 200ms (equivalente a "velocidad
        // 200" pedida). Antes, el ataque reutilizaba this.frameDuration
        // (150ms, pensado para caminar) y al tener pocos frames en un ciclo
        // muy corto, se percibía disparado/demasiado rápido.
        this.attackFrameDuration = attackFrameDuration;
        this.playing = true;
    }

    setAnimation(state, direction = "front") {
        if (this.state === state && this.direction === direction) return;
        this.state = state;
        this.direction = direction;
        this.frame = 0;
        this.elapsed = 0;
    }

    update(deltaTimeMs) {
        if (!this.playing) return;
        this.elapsed += deltaTimeMs;
        // FIX (Requerimiento 3): se selecciona la duración de frame según
        // el estado actual. Si es "attack", se usa attackFrameDuration
        // (200ms); para cualquier otro estado (walk, dance, etc.) se
        // mantiene el comportamiento original con this.frameDuration.
        const currentDuration = this.state === "attack" ? this.attackFrameDuration : this.frameDuration;
        while (this.elapsed >= currentDuration) {
            this.elapsed -= currentDuration;
            this.frame = (this.frame + 1) % SPRITE_FRAME_COUNT;
        }
    }

    // FIX #1 y #3: detiene la reproducción y fija el frame en IDLE_FRAME (2).
    // Se usa cada vez que un personaje deja de moverse, evitando que la
    // animación quede congelada en un frame aleatorio o siga reproduciéndose
    // en loop cuando en realidad está quieto.
    pauseAtIdle() {
        this.playing = false;
        this.frame = IDLE_FRAME;
        this.elapsed = 0;
    }

    getImage() {
        const byState = ANIMATION_IMAGES[this.character]?.[this.state];
        if (!byState) return null;
        return byState[this.direction] || byState.none || null;
    }

    /** true si la imagen del frame actual ya cargó y es utilizable. */
    isReady() {
        const img = this.getImage();
        return !!(img && img.complete && img.naturalWidth > 0);
    }

    draw(ctx, screenX, screenY, drawWidth, drawHeight) {
        const image = this.getImage();
        if (!image || !image.complete || image.naturalWidth === 0) return;
        const { sx, sy, sw, sh } = getFrameSourceRect(this.frame);
        ctx.drawImage(image, sx, sy, sw, sh, screenX, screenY, drawWidth, drawHeight);
    }
}

// =====================================================================
// SISTEMA DE VIDAS / DAÑO
// =====================================================================
const HITS_PER_LIFE = 3;
const CURSE_HITS_PER_LIFE = 2;  
const INVULNERABILITY_MS = 1000;
const BLINK_INTERVAL_MS = 100;
const HIT_STUN_FRAMES = 20; // FIX: constante que faltaba y rompía applyDamage()

// FIX (Requerimiento 1): duración en milisegundos del "salto de ataque"
// (ida + vuelta) que Geto y Gojo realizan sobre la maldición atacada.
// Se comparte entre ambos personajes para que el salto y la animación de
// "attack" (200ms por frame) queden sincronizados visualmente.
const ATTACK_JUMP_DURATION = 500;

const GOJO_DEATH_BLINK_TIMES = 3;          
const GOJO_DEATH_BLINK_INTERVAL_MS = 220;

// --- Sistema viejo de animación por contador de frames de juego (aún usado como fallback) ---
const SPRITE_FRAME_SIZE = 32;

function updateAnimationFrame(entity, totalFrames) {
    if (totalFrames <= 1) { entity.frame = 0; return; }
    entity.frameTimer++;
    if (entity.frameTimer >= entity.frameInterval) {
        entity.frameTimer = 0;
        entity.frame = (entity.frame + 1) % totalFrames;
    }
}

function updateAttackAnimationFrame(entity, totalFrames) {
    if (totalFrames <= 1) { entity.attackFrame = 0; return; }
    entity.attackFrameTimer++;
    if (entity.attackFrameTimer >= entity.attackFrameInterval) {
        entity.attackFrameTimer = 0;
        entity.attackFrame = (entity.attackFrame + 1) % totalFrames;
    }
}

function drawSpriteFrame(sheetImage, entity, screenX, screenY, drawWidth, drawHeight) {
    const sx = entity.frame * SPRITE_FRAME_SIZE;
    c.drawImage(
        sheetImage,
        sx, 0, SPRITE_FRAME_SIZE, SPRITE_FRAME_SIZE,
        screenX, screenY, drawWidth, drawHeight
    );
}

function applyDamage(entity, amount = 1) {
    if (!entity.alive || entity.invulnerable) return;

    entity.hits += amount;

    if (entity.hits >= entity.hitsPerLife) {
        entity.hits = 0;
        entity.lives -= 1;
    }

    if (entity.lives <= 0) {
        entity.alive = false;
        entity.state = "dying";
        if (typeof entity.onDeath === "function") entity.onDeath();
        return;
    }

    entity.invulnerable = true;
    entity.invulnerableUntil = performance.now() + INVULNERABILITY_MS;

    if (typeof entity.damage === "number" && typeof entity.attackCooldown === "number") {
        entity.attackCooldown = Math.max(entity.attackCooldown, HIT_STUN_FRAMES);
    }
}

function updateInvulnerability(entity) {
    if (entity.invulnerable && performance.now() >= entity.invulnerableUntil) {
        entity.invulnerable = false;
    }
}

function isBlinkVisible(entity) {
    if (!entity.invulnerable) return true;
    return Math.floor(performance.now() / BLINK_INTERVAL_MS) % 2 === 0;
}

function drawHealthBar(screenX, screenY, width, entity) {
    const totalHits = entity.lives * entity.hitsPerLife - entity.hits;
    const maxHits = entity.maxLives * entity.hitsPerLife;
    const ratio = Math.max(0, totalHits / maxHits);

    const barHeight = 6;
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillRect(screenX, screenY, width, barHeight);
    c.fillStyle = ratio > 0.3 ? "#4caf50" : "#e53935";
    c.fillRect(screenX, screenY, width * ratio, barHeight);
    c.strokeStyle = "black";
    c.strokeRect(screenX, screenY, width, barHeight);
}

const geto = {
    x: 0,
    y: 0,
    size: 64,
    lives: 3,
    maxLives: 3,
    hits: 0,
    hitsPerLife: HITS_PER_LIFE,
    alive: true,
    invulnerable: false,
    invulnerableUntil: 0,
    attackRange: 45,
    attackCooldown: 0,
    attacking: false,

    state: "idle",
    direction: "down",
    // FIX #1: Geto inicia en el frame idle (2) en vez de 0.
    frame: IDLE_FRAME,
    frameTimer: 0,
    frameInterval: 8,
    walkFrameCount: 4,

    attackFrame: 0,
    attackFrameTimer: 0,
    attackFrameInterval: 4,
    attackFrameCount: 3,

    // ATTACK REWORK: estado del salto de ataque de Geto. Como la cámara
    // mantiene a Geto siempre fijo en el centro de la pantalla, el
    // "salto" ya no se simula desplazando a Geto, sino desplazando el
    // MAPA (mapX/mapY) hasta que la maldición objetivo quede centrada.
    // attackTarget referencia a la maldición sobre la que se saltó.
    // jumpStartMapX/Y guardan el offset del mapa al iniciar el ataque y
    // jumpTargetMapX/Y el offset final (mapa centrado en la maldición).
    attackTarget: null,
    jumpElapsed: 0,
    jumpDuration: ATTACK_JUMP_DURATION,
    jumpStartMapX: 0,
    jumpStartMapY: 0,
    jumpTargetMapX: 0,
    jumpTargetMapY: 0,

    // FIX: Geto ahora tiene su propio AnimationController.
    animation: new AnimationController("geto", 150),

    onDeath() {
        gameOver = true;
    }
};

let gameOver = false;
let metGojo = false;

class Gojo {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 64;
        this.active = true;
        this.followingEnabled = false;
        this.state = "idle";
        this.speed = 2;
        // FIX #4: distancia de seguimiento reducida (antes 70) para que
        // Gojo se mantenga mucho más cerca de Geto y el seguimiento se
        // sienta más fluido.
        this.followDistance = 50;
        // FIX #5 (ANTI-JITTER): distancia de histéresis para detenerse.
        // Gojo empieza a moverse solo cuando supera "followDistance" y
        // deja de moverse solo cuando entra por debajo de "stopDistance"
        // (menor que followDistance). Esta zona muerta evita que, al
        // estar justo en el límite de 50px, Gojo cruce esa frontera de
        // ida y vuelta en frames consecutivos, lo cual antes disparaba
        // this.direction/setAnimation() constantemente y hacía que la
        // animación de caminar pareciera reproducirse a toda velocidad.
        this.stopDistance = 38;
        this.attackRange = 60;
        this.attackCooldown = 0;
        this.lives = 3;
        this.maxLives = 3;
        this.hits = 0;
        this.hitsPerLife = HITS_PER_LIFE;
        this.alive = true;
        this.invulnerable = false;
        this.invulnerableUntil = 0;
        // FIX #2: dirección inicial explícita ("down"), coincide con la
        // clave "down" usada ahora en ANIMATION_SOURCES.gojo.
        this.direction = "down";
        this.radius = 20;

        // FIX #3: bandera que indica si Gojo se movió en este frame; se usa
        // para no reproducir la animación de "walk" cuando está detenido.
        this.isMoving = false;

        this.frame = IDLE_FRAME;
        this.frameTimer = 0;
        this.frameInterval = 8;
        this.walkFrameCount = 4;

        this.attackFrame = 0;
        this.attackFrameTimer = 0;
        this.attackFrameInterval = 4;
        this.attackFrameCount = 3;
        this.animation = new AnimationController("gojo", 150);

        // FIX (Requerimiento 2): temporizador dedicado para la animación de
        // ataque. Mientras sea > 0, Gojo se considera "atacando" y no debe
        // volver a la animación de caminar aunque followGeto() se ejecute
        // en el mismo frame.
        this.attackAnimTimer = 0;
        this.attackAnimDuration = ATTACK_JUMP_DURATION;

        // FIX (Requerimiento 1): estado del salto de ataque sobre la
        // maldición objetivo. attackTarget se usa además para elevar
        // temporalmente el orden de dibujo (z-order) de Gojo por encima
        // de la maldición atacada.
        this.attackJump = null;
        this.attackTarget = null;

        // Sistema de muerte/resurrección
        this.deathActive = false;
        this.deathDialogueVisible = false;
        this.posicionMuerte = { x: 0, y: 0 };
        this.blinkVisible = true;
        this.blinkTimer = 0;
        this.blinkToggles = 0;
        this.blinkDone = false;
    }

    onDeath() {
        this.posicionMuerte = { x: this.x, y: this.y };
        this.deathActive = true;
        this.deathDialogueVisible = true;
        this.blinkVisible = true;
        this.blinkTimer = 0;
        this.blinkToggles = 0;
        this.blinkDone = false;
        this.active = false; // oculta el sprite normal mientras está "muerto"
    }

    updateDeathBlink(dt) {
        if (!this.deathActive || this.blinkDone) return;
        this.blinkTimer += dt;
        if (this.blinkTimer < GOJO_DEATH_BLINK_INTERVAL_MS) return;
        this.blinkTimer -= GOJO_DEATH_BLINK_INTERVAL_MS;
        this.blinkVisible = !this.blinkVisible;
        this.blinkToggles++;
        if (this.blinkToggles >= GOJO_DEATH_BLINK_TIMES * 2) {
            this.blinkDone = true;
            this.blinkVisible = true; // queda fijo visible
        }
    }

    drawDead(mapX, mapY) {
        if (!this.deathActive) return;
        if (!this.blinkDone && !this.blinkVisible) return;
        const screenX = mapX + this.posicionMuerte.x - this.size / 2;
        const screenY = mapY + this.posicionMuerte.y - this.size / 2;
        if (deadGojoImage.complete && deadGojoImage.naturalWidth > 0) {
            c.drawImage(deadGojoImage, screenX, screenY, this.size, this.size);
        } else {
            c.fillStyle = "#444";
            c.fillRect(screenX, screenY, this.size, this.size);
            c.strokeStyle = "#999";
            c.strokeRect(screenX, screenY, this.size, this.size);
        }
    }

    resurrect() {
        this.x = this.posicionMuerte.x;
        this.y = this.posicionMuerte.y;
        this.lives = 1;
        this.hits = 0;
        this.alive = true;
        this.active = true;
        this.direction = "down";
        this.invulnerable = true;
        this.invulnerableUntil = performance.now() + INVULNERABILITY_MS;
        this.animation.setAnimation("walk", this.direction);
        this.animation.pauseAtIdle();
        this.deathActive = false;
        this.deathDialogueVisible = false;
    }

    followGeto() {
        const dx = geto.x - this.x;
        const dy = geto.y - this.y;
        const dist = Math.hypot(dx, dy);

        
        if (dist > this.followDistance) {
            this.isMoving = true;
        } else if (dist < this.stopDistance) {
            this.isMoving = false;
        }
        // Si dist está entre stopDistance y followDistance, se conserva el
        // estado anterior de isMoving (zona muerta / dead zone).

        if (this.isMoving && dist > 0) {
            // FIX #5 (ANTI-JITTER): el paso de movimiento ahora se escala
            // por deltaTime (normalizado a ~60fps) en vez de aplicar
            // "this.speed" como un valor fijo por tick. Con un paso fijo,
            // en frames más largos Gojo podía sobrepasar (overshoot) la
            // posición de Geto y rebotar de un lado a otro del punto de
            // destino, generando además microcambios de signo en dx/dy
            // que disparaban cambios de dirección en cada frame.
            const normalizedDelta = Math.min(deltaTime || 16.6, 100) / (1000 / 60);
            const stepX = (dx / dist) * this.speed * normalizedDelta;
            const stepY = (dy / dist) * this.speed * normalizedDelta;
            
            const resolved = resolveMoveWithCollisions(this.x, this.y, stepX, stepY, this.radius, 12);
            
            this.x = resolved.x;
            this.y = resolved.y;

            // FIX #5 (ANTI-JITTER): solo se recalcula/actualiza la
            // dirección si la distancia restante supera un pequeño umbral.
            // Cerca del objetivo, dx/dy pueden invertir de signo por
            // diferencias de un par de píxeles; sin este umbral, eso
            // cambiaba this.direction en cada tick y, por lo tanto,
            // volvía a resetear el AnimationController vía setAnimation()
            // en Gojo.update(), produciendo el efecto de animación
            // "acelerada"/entrecortada al acercarse a Geto.
            if (dist > 4) {
                const newDirection = Math.abs(dx) > Math.abs(dy)
                    ? (dx < 0 ? "left" : "right")
                    : (dy < 0 ? "up" : "down");
                if (newDirection !== this.direction) {
                    this.direction = newDirection;
                    this.frame = 0;
                    this.frameTimer = 0;
                }
            }
            updateAnimationFrame(this, this.walkFrameCount);
        } else {
            // FIX #1 y #3: Gojo está detenido (dentro de la zona de
            // histéresis): el frame legado queda fijo en IDLE_FRAME en
            // vez de 0.
            this.frame = IDLE_FRAME;
            this.frameTimer = 0;
        }
    }

    attackNearestCurse() {
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
            return;
        }
        let target = null;
        let bestDist = Infinity;
        for (const curse of curses) {
            if (!curse.alive) continue;
            const dist = Math.hypot(curse.x - this.x, curse.y - this.y);
            if (dist < this.attackRange && dist < bestDist) {
                bestDist = dist;
                target = curse;
            }
        }
        if (boss && boss.alive) {
            const dist = Math.hypot(boss.x - this.x, boss.y - this.y);
            if (dist < this.attackRange && dist < bestDist) {
                bestDist = dist;
                target = boss;
            }
        }
        if (target) {
            applyDamage(target, 1);
            this.attackCooldown = 30;
            this.attackFrame = 0;
            this.attackFrameTimer = 0;

            // FIX (Requerimiento 2): se orienta a Gojo hacia el objetivo y
            // se dispara explícitamente el estado "attack" junto con su
            // temporizador dedicado (attackAnimTimer). Antes NADA en esta
            // función tocaba this.state ni ningún timer, por lo que
            // Gojo.update() jamás detectaba que debía reproducir la
            // animación de golpe.
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            this.direction = Math.abs(dx) > Math.abs(dy)
                ? (dx < 0 ? "left" : "right")
                : (dy < 0 ? "up" : "down");

            this.state = "attack";
            this.attackAnimTimer = this.attackAnimDuration;

            // ATTACK REWORK: arranca el desplazamiento de ataque de Gojo
            // sobre la maldición/boss objetivo. startX/Y = posición actual
            // de Gojo, targetX/Y = posición del enemigo en el instante del
            // golpe (copia estática para que el movimiento no persiga al
            // enemigo si este se desplaza durante la animación). A
            // diferencia del sistema anterior, este es un movimiento de
            // IDA ÚNICAMENTE: Gojo se queda posicionado exactamente sobre
            // la maldición, sin regresar a su posición original.
            this.attackTarget = target;
            this.attackJump = {
                startX: this.x,
                startY: this.y,
                targetX: target.x,
                targetY: target.y,
                elapsed: 0,
                duration: this.attackAnimDuration
            };
        }
    }

    // ATTACK REWORK: interpola la posición real (x, y) de Gojo durante el
    // desplazamiento de ataque, moviéndolo físicamente desde su posición
    // inicial hasta la posición EXACTA de la maldición objetivo (quedando
    // superpuesto sobre ella). Es un movimiento de UNA SOLA DIRECCIÓN: al
    // terminar, Gojo se fija en las coordenadas del objetivo y se queda
    // ahí permanentemente (no regresa a la posición previa al ataque).
    updateAttackJump() {
        const jump = this.attackJump;
        if (!jump) return;
        jump.elapsed += deltaTime;
        const t = Math.min(1, jump.elapsed / jump.duration);

        this.x = jump.startX + (jump.targetX - jump.startX) * t;
        this.y = jump.startY + (jump.targetY - jump.startY) * t;

        if (jump.elapsed >= jump.duration) {
            this.x = jump.targetX;
            this.y = jump.targetY;
            this.attackJump = null;
            this.attackTarget = null;
        }
    }

    heal(amount = 1) {
        if (this.hits > 0) {
            this.hits = Math.max(0, this.hits - amount);
        } else if (this.lives < this.maxLives) {
            this.lives = Math.min(this.lives + 1, this.maxLives);
        }
    }

    update() {
        if (!this.active) return;
        updateInvulnerability(this);
        if (!this.alive) {
            this.state = "dying";
            return;
        }
        if (!this.followingEnabled) {
            this.state = "idle";
            // FIX #1: frame legado fijo en IDLE_FRAME en vez de 0.
            this.frame = IDLE_FRAME;
            this.frameTimer = 0;
            this.animation.setAnimation("walk", this.direction);
            // FIX #1: se usa pauseAtIdle() para garantizar que el
            // AnimationController quede fijo en el frame idle (2).
            this.animation.pauseAtIdle();
            return;
        }

        // FIX (Requerimiento 2): se cuenta regresivamente el temporizador
        // dedicado de la animación de ataque (en milisegundos, vía
        // deltaTime real) en vez de depender de un this.state que nunca
        // llegaba a "attack".
        if (this.attackAnimTimer > 0) {
            this.attackAnimTimer -= deltaTime;
            if (this.attackAnimTimer < 0) this.attackAnimTimer = 0;
        }

        // FIX (Requerimiento 1 y 2): mientras el desplazamiento de ataque
        // está activo se omite followGeto() por completo (no debe
        // moverse "de seguimiento" y de "ataque" al mismo tiempo, y
        // tampoco debe reorientarse/reiniciar la animación a mitad del
        // golpe). En su lugar se interpola la posición mediante
        // updateAttackJump().
        if (this.attackJump) {
            this.isMoving = false;
            this.updateAttackJump();
        } else {
            this.state = "follow";
            this.followGeto();
        }

        this.attackNearestCurse();

        // FIX (Requerimiento 2): ahora sí se evalúa correctamente si Gojo
        // está en pleno golpe (temporizador > 0) para decidir la clave de
        // animación a reproducir.
        const isAttackingNow = this.attackAnimTimer > 0;
        if (isAttackingNow) this.state = "attack";

        this.animation.setAnimation(isAttackingNow ? "attack" : "walk", this.direction);
        if (isAttackingNow || this.isMoving) {
            this.animation.playing = true;
            this.animation.update(deltaTime);
        } else {
            this.animation.pauseAtIdle();
        }

        for (const curse of curses) {
            if (!curse.alive) continue;
            const dist = Math.hypot(curse.x - this.x, curse.y - this.y);
            if (dist < 30) applyDamage(this, curse.damage);
        }
    }

    getSprite() {
        switch (this.direction) {
            case "up": return gojoUpImage;
            case "left": return gojoLeftImage;
            case "right": return gojoRightImage;
            case "down":
            default: return gojoDownImage;
        }
    }

    draw(mapX, mapY) {
        if (!this.active) return;
        if (!isBlinkVisible(this)) return;
        const screenX = mapX + this.x - this.size / 2;
        const screenY = mapY + this.y - this.size / 2;

        // FIX: se usa el AnimationController; si su imagen aún no cargó,
        // se cae al sprite estático viejo como respaldo.
        if (this.animation.isReady()) {
            this.animation.draw(c, screenX, screenY, this.size, this.size);
        } else {
            c.drawImage(this.getSprite(), screenX, screenY, this.size, this.size);
        }
        drawHealthBar(screenX, screenY - 10, this.size, this);
    }
}

const gojo = new Gojo(0, 0);

const SOLID_TILE_VALUE = 84;

function isTileSolidAtWorldPos(worldX, worldY) {
    const tileSize = 16 * mapScale;
    const col = Math.floor(worldX / tileSize);
    const row = Math.floor(worldY / tileSize);
    return currentCollisionsMap[row]?.[col] === SOLID_TILE_VALUE;
}

function resolveMoveWithCollisions(fromX, fromY, dx, dy, radius, hitbox = 0) {
    let newX = fromX;
    let newY = fromY;
    const tryX = fromX + dx;

const blockedX =
    isTileSolidAtWorldPos(
        tryX + Math.sign(dx) * (radius - hitbox),
        fromY - radius + hitbox + 2
    ) ||
    isTileSolidAtWorldPos(
        tryX + Math.sign(dx) * (radius - hitbox),
        fromY + radius - hitbox - 2
    );

if (!blockedX || dx === 0)
    newX = tryX;

const tryY = fromY + dy;

const blockedY =
    isTileSolidAtWorldPos(
        newX - radius + hitbox + 2,
        tryY + Math.sign(dy) * (radius - hitbox)
    ) ||
    isTileSolidAtWorldPos(
        newX + radius - hitbox - 2,
        tryY + Math.sign(dy) * (radius - hitbox)
    );

if (!blockedY || dy === 0)
    newY = tryY;
    return { x: newX, y: newY };
}

class Curse {
    constructor(x, y, type, noteId) {
        this.x = x;
        this.y = y;
        this.hitbox = 12;
        this.type = type;
        this.noteId = noteId;
        this.alive = true;
        this.state = "idle";
        this.direction = "left";
        this.speed = 1.3;
        this.radius = 14;
        this.size = 48; 
        // FIX #1: frame legado inicia en IDLE_FRAME en vez de 0.
        this.frame = IDLE_FRAME;
        this.frameTimer = 0;
        this.animationSpeed = 8;
        this.frameInterval = this.animationSpeed;
        this.walkFrameCount = 4;
        this.attackCooldown = 0;
        this.damage = 1;
        this.detectDistance = 170;
        this.attackDistance = 40;
        this.contactDistance = 26;
        this.lives = 1;
        this.maxLives = 1;
        this.hits = 0;
        this.hitsPerLife = CURSE_HITS_PER_LIFE;
        this.deathTimer = 0;
        this.animation = new AnimationController(type === "black" ? "blackRabbit" : "whiteRabbit", 100);
    }

    findTarget() {
        const candidates = [{ ref: geto, dist: Math.hypot(geto.x - this.x, geto.y - this.y) }];
        if (gojo.active && gojo.alive && gojo.followingEnabled) {
            candidates.push({ ref: gojo, dist: Math.hypot(gojo.x - this.x, gojo.y - this.y) });
        }
        candidates.sort((a, b) => a.dist - b.dist);
        return candidates[0];
    }

    update() {
        updateInvulnerability(this);
        if (!this.alive) {
            this.state = "dying";
            this.deathTimer++;
            return;
        }
        const nearest = this.findTarget();
        if (!nearest) return;
        if (this.state === "idle") {
            if (nearest.dist < this.detectDistance) this.state = "chase";
        } else if (this.state === "chase") {
            if (nearest.dist < this.attackDistance) {
                this.state = "attack";
            } else if (nearest.dist > this.detectDistance * 1.4) {
                this.state = "idle";
            } else {
                this.moveToward(nearest.ref);
            }
        } else if (this.state === "attack") {
            if (nearest.dist > this.attackDistance) {
                this.state = "chase";
            } else {
                this.tryAttack(nearest.ref);
            }
        }
        if (nearest.dist < this.contactDistance) {
            if (this.state !== "attack") this.state = "attack";
            this.tryAttack(nearest.ref);
        }

        // FIX #1: cuando el conejo no está persiguiendo (idle/attack/dying),
        // su animación se congela en el frame idle (2) en vez de quedarse
        // en un frame aleatorio del último ciclo de "walk".
        this.animation.setAnimation("walk", this.direction);
        if (this.state === "chase") {
            this.animation.playing = true;
            this.animation.update(deltaTime);
        } else {
            this.animation.pauseAtIdle();
        }
    }

    moveToward(target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        const stepX = (dx / dist) * this.speed;
        const stepY = (dy / dist) * this.speed;
        const resolved = resolveMoveWithCollisions(this.x, this.y, stepX, stepY, this.radius);
        this.x = resolved.x;
        this.y = resolved.y;

        this.direction = Math.abs(dx) > Math.abs(dy)
            ? (dx < 0 ? "left" : "right")
            : (dy < 0 ? "up" : "down");

        updateAnimationFrame(this, this.walkFrameCount);
    }

    tryAttack(target) {
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
            return;
        }
        applyDamage(target, this.damage);
        this.attackCooldown = 45;
    }

    onDeath() {
        score += 10;
        if (this.noteId) {
            groundNotes.push({ x: this.x, y: this.y, id: this.noteId, collected: false });
        }
    }

    getSprite() {
        const isBlack = this.type === "black";
        switch (this.direction) {
            case "up": return isBlack ? blackRabbitUpImage : whiteRabbitUpImage;
            case "down": return isBlack ? blackRabbitDownImage : whiteRabbitDownImage;
            case "right": return isBlack ? blackRabbitRightImage : whiteRabbitRightImage;
            case "left":
            default: return isBlack ? blackRabbitLeftImage : whiteRabbitLeftImage;
        }
    }

    draw(mapX, mapY) {
    if (this.state === "dying" && this.deathTimer > 30) return;
    if (!isBlinkVisible(this)) return;
    const screenX = mapX + this.x - this.size / 2;
    const screenY = mapY + this.y - this.size / 2;
    c.save();
    if (this.state === "dying") {
        c.globalAlpha = Math.max(0, 1 - this.deathTimer / 30);
    }
    if (this.animation.isReady()) {
        this.animation.draw(c, screenX, screenY, this.size, this.size);
    } else {
        c.drawImage(this.getSprite(), screenX, screenY, this.size, this.size);
    }
    c.restore();
    if (this.state !== "dying") drawHealthBar(screenX, screenY - 8, this.size, this);
    }
}

class Boss {
    constructor(x, y, letterId) {
        this.x = x;
        this.y = y;
        this.size = 128;
        this.letterId = letterId || "1";
        this.alive = true;
        this.state = "dormant";
        this.speed = 1.6;
        this.radius = 50; 
        this.attackRange = 70;
        this.aggroRange = 260;
        this.attackCooldown = 0;
        this.damage = 1;
        this.deathTimer = 0;
        this.lives = 1;
        this.maxLives = 1;
        this.hits = 0;
        this.hitsPerLife = 6;
        this.retreatTimer = 0;

        // FIX #2: se inicializa una dirección por defecto ("down"); antes
        // quedaba undefined hasta el primer movimiento, lo que impedía
        // resolver la imagen de animación mientras el Boss estaba "dormant".
        this.direction = "down";

        // FIX #1: frame legado inicia en IDLE_FRAME en vez de 0.
        this.frame = IDLE_FRAME;
        this.frameTimer = 0;
        this.frameInterval = 10;
        this.walkFrameCount = 4;

        // FIX: propiedades de la animación de ataque que faltaban
        // (evita NaN en updateAttackAnimationFrame).
        this.attackFrame = 0;
        this.attackFrameTimer = 0;
        this.attackFrameInterval = 6;
        this.attackFrameCount = 3;

        this.animation = new AnimationController("boss", 150);
    }

    findTarget() {
        const candidates = [{ ref: geto, dist: Math.hypot(geto.x - this.x, geto.y - this.y) }];
        if (gojo.active && gojo.alive && gojo.followingEnabled) {
            candidates.push({ ref: gojo, dist: Math.hypot(gojo.x - this.x, gojo.y - this.y) });
        }
        candidates.sort((a, b) => a.dist - b.dist);
        return candidates[0];
    }

    update() {
        updateInvulnerability(this);
        if (!this.alive) {
            this.state = "dying";
            this.deathTimer++;
            return;
        }
        const target = this.findTarget();
        if (!target) return;
        if (this.state === "dormant") {
            if (target.dist < this.aggroRange) {
                this.state = "approach";
            }
            this.animation.setAnimation("walk", this.direction);
            // FIX #1: se usa pauseAtIdle() para fijar el frame idle (2)
            // mientras el Boss está inactivo, en vez de solo pausar sin
            // garantizar el frame.
            this.animation.pauseAtIdle();
            return;
        }
        if (this.state === "approach") {
            if (target.dist < this.attackRange) {
                this.state = "attack";
                this.attackFrame = 0;
                this.attackFrameTimer = 0;
            } else {
                this.moveToward(target.ref);
                updateAnimationFrame(this, this.walkFrameCount);
            }
        } else if (this.state === "attack") {
            this.tryAttack(target.ref);
            updateAttackAnimationFrame(this, this.attackFrameCount);
            if (this.attackCooldown === 0) {
                this.state = "retreat";
                this.retreatTimer = 60;
            }
        } else if (this.state === "retreat") {
            this.moveAway(target.ref);
            updateAnimationFrame(this, this.walkFrameCount);
            this.retreatTimer--;
            if (this.retreatTimer <= 0) this.state = "approach";
        }

        // FIX: sincroniza el AnimationController con el estado de la IA.
        const animState = this.state === "attack" ? "attack" : "walk";
        this.animation.setAnimation(animState, this.direction);
        this.animation.playing = true;
        this.animation.update(deltaTime);
    }

   moveToward(target) {
        const dx = target.x - this.x, dy = target.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        const stepX = (dx / dist) * this.speed;
        const stepY = (dy / dist) * this.speed;

        const resolved = resolveMoveWithCollisions(this.x, this.y, stepX, stepY, this.radius);

        // Si el movimiento quedó bloqueado (la posición resuelta es
        // prácticamente igual a la posición actual), el Boss esquiva el
        // obstáculo desplazándose en la dirección PERPENDICULAR a su
        // rumbo original, en vez de quedarse atascado contra la pared.
        const blocked = Math.hypot(resolved.x - this.x, resolved.y - this.y) < 0.05;
        if (blocked) {
            const perpX = -stepY;
            const perpY = stepX;
            const altResolved = resolveMoveWithCollisions(this.x, this.y, perpX, perpY, this.radius);
            this.x = altResolved.x;
            this.y = altResolved.y;
        } else {
            this.x = resolved.x;
            this.y = resolved.y;
        }

        this.direction = Math.abs(dx) > Math.abs(dy)
            ? (dx < 0 ? "left" : "right")
            : (dy < 0 ? "up" : "down");
    }

        moveAway(target) {
            const dx = this.x - target.x, dy = this.y - target.y;
            const dist = Math.hypot(dx, dy) || 1;
            const stepX = (dx / dist) * this.speed;
            const stepY = (dy / dist) * this.speed;

            const resolved = resolveMoveWithCollisions(this.x, this.y, stepX, stepY, this.radius);

            const blocked = Math.hypot(resolved.x - this.x, resolved.y - this.y) < 0.05;
            if (blocked) {
                const perpX = -stepY;
                const perpY = stepX;
                const altResolved = resolveMoveWithCollisions(this.x, this.y, perpX, perpY, this.radius);
                this.x = altResolved.x;
                this.y = altResolved.y;
            } else {
                this.x = resolved.x;
                this.y = resolved.y;
            }

            this.direction = Math.abs(dx) > Math.abs(dy)
                ? (dx < 0 ? "left" : "right")
                : (dy < 0 ? "up" : "down");
        }

    tryAttack(target) {
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
            return;
        }
        applyDamage(target, this.damage);
        this.attackCooldown = 60;
    }

    onDeath() {
        groundLetter = { x: this.x, y: this.y, id: this.letterId, collected: false };
    }

    draw(mapX, mapY) {
        if (this.state === "dying" && this.deathTimer > 60) return;
        if (!isBlinkVisible(this)) return;
        const screenX = mapX + this.x - this.size / 2;
        const screenY = mapY + this.y - this.size / 2;
        c.save();
        if (this.state === "dying") c.globalAlpha = Math.max(0, 1 - this.deathTimer / 60);
        // FIX #2: dibujo vía AnimationController con fallback a bossImage.
        // Ahora que direction se inicializa y las claves coinciden con
        // "up"/"down"/"left"/"right", el Boss anima correctamente en las
        // 4 direcciones en vez de depender de un único sprite estático.
        if (this.animation.isReady()) {
            this.animation.draw(c, screenX, screenY, this.size, this.size);
        } else {
            c.drawImage(bossImage, screenX, screenY, this.size, this.size);
        }
        c.restore();
        if (this.state !== "dying") drawHealthBar(screenX, screenY - 12, this.size, this);
    }
}

let score = 0;

const inventory = {
    PN: false,
    notes: [],
    letters: []
};

let activeDocument = null;

const POPUP_WIDTH = 360;
const POPUP_HEIGHT = 520;
const POPUP_X = (canvas.width - POPUP_WIDTH) / 2;
const POPUP_Y = (canvas.height - POPUP_HEIGHT) / 2;

const letterImage = new Image();
letterImage.src = "images/letter.png";

const NOTES = {
    "PN": { title: "Nota Principal", text: "Explora el mapa, encuentra a Gojo y derrota las maldiciones para conseguir más notas y puntos, puedes conseguir puntos bonus si encuentras los corazones y también te regenarán 1/3 de vida a ti o a Gojo, el botón de estrella es para atacar, debes saltar sobre las maldiciones para derrotarlas, mucha suerte. Espero te guste y te diviertas precioso 😺🌷 (Los controles en PC son WASD para moverse y Space para saltar, el inventario se abre con I y pausa con Enter)" },
    1: { title: "Nota 1", text: "Eres muy fuerte y capáz, nunca te rindas" },
    2: { title: "Nota 2", text: "Eres lo más importante en mi vida" },
    3: { title: "Nota 3", text: "Adoro tu sonrisa, tus ojos y tus risos preciosos" },
    4: { title: "Nota 4", text: "Admiro mucho la persona que eres, estoy realmente orgulloso de quién eres" },
    5: { title: "Nota 5", text: "Tienes la sonrisa más preciosa que he visto" },
    6: { title: "Nota 6", text: "Admiro lo buen estudiante, amigo, hijo, primo, y sobrino que eres" },
    7: { title: "Nota 7", text: "Espero que este día sea un día hermoso para ti, mereces más de lo que crees, más de lo que quieres, y muchisimo más de lo que has recibido" },
    8: { title: "Nota 8", text: "Eres una gran persona, jamás dudes del valor que tienes" },
    9: { title: "Nota 9", text: "Eres más especial en mi vida de lo que crees" },
    10: { title: "Nota 10", text: "Aunque esto no sea la gran cosa fue hecho con mucho amor (y algo de estrés JAJJAJA, pero sobre todo amor)" },
    11: { title: "Nota 11", text: "Gracias por ser luz en oscuridad, y calma en tormenta, gracias por ser mi lugar seguro y apoyo" },
    12: { title: "Nota 12", text: "Eres el sol de mi luna, el mar de mi arena y el Suguru de mi Satoru" },
    13: { title: "Nota 13", text: "Tenerte en mi vida se siente como ese rayito de sol que pega y calienta en los días fríos, o como la brisa refrescante que sopla en los días calurosos" },
    14: { title: "Nota 14", text: "Cada parte de tu ser me parece tan interesante, tan admirable, y tan linda, e incluso las partes de ti que no logras apreciar o que dices son defectos, para mi son maravillosas" },
    15: { title: "Nota 15", text: "Me encanta pasar tiempo contigo, me encanta tu compañía, se siente cálida y acogedora, contigo siento que incluso en los peores momentos se puede encontrar calma" },
    16: { title: "Nota 16", text: "Puede que no todos los días sean buenos, pero eso no significa que mañana sea igual, siempre habrá una solución al problema, y aunque no la encuentres en ese preciso instante, con calma y paciencia la encontrarás" },
    17: { title: "Nota 17", text: "Siempre que tengas miedo, o que la tristeza invada tu mente y tu corazón puedes contar conmigo, puede que yo no sea el mejor dando consejos, o el mejor consolando, pero siempre trataré de hacerte sentir mejor, aunque sea momentáneamente, pero con hacerte olvidar tus problemas por lo menos un momento me bastaría" },
    18: { title: "Nota 18", text: "Haces mis días bonitos" },
    19: { title: "Nota 19", text: "19 años ya, qué se siente usar bastón corazón? 🫰🏾🥺 Broma JAJAJA" },
};

const DOCUMENTS = {};
for (const key in NOTES) {
    const documentId = key === "PN" ? "PN" : `note${key}`;
    DOCUMENTS[documentId] = NOTES[key];
}
DOCUMENTS.letter1 = {
    title: "La Carta",
    text: "Bueno, primero que nada no sé como iniciar esta carta JAJAJAJ, así que me disculpo de antemano si llega a ser rara, incómoda o algo por el estilo, la verdad no espero que sea perfecta y simplememte dejaré que las palabras salgan por si solas. Antes que nada, feliz cumpleaños preciosote, ya 19 vueltas al sol como dicen los señores JAJAJAJA, sé que no nos conocemos desde hace tanto tiempo, pero todo los momentos que he compartido a tu lado realmente los atesoro con el alma, sin importar las circunstancias de estos, eres muy importante en mi vida y en la vida de muchas personas y estoy tan feliz de que sigas aquí, estoy sumamente orgulloso de ti, no lo digo como simples palabras vacías, lo digo de verdad, eres una persona admirable, un estudiante increíble, un gran amigo y sin duda una persona maravillosa, auque tú no pienses así de ti mismo, yo no puedo no ver lo increíble que eres, y si, cada quien tiene sus defectos y cada quien cometió errores, pero de ahí es donde se aprende y se mejora, ¿no?. Yo realmente veo el esfuerzo que haces todos los días por ser mejor persona, de verdad te admiro y te veo como un ejemplo a seguir, te respeto. Esto lo estoy escribiendo un lunes 22 de junio, espero que el día de tu cumple lo pases super bien y disfrutes con las personas que quieres, que puedas disfrutar tu día como se debe y que sientas que eso es lo que mereces, sé que mi regalo no es mucho, pero ta hecho con mucho cariño para ti. Yo realmente no sé hacer cartas, pero quiero felicitarte por llegar hasta aquí, porque sé que no ha sido fácil, y aún sigue sin serlo, falta camino por recorrer, y vas bien, vas excelente, no te rindas nunca, sé que eres capáz de cumplir todo lo que te propongas, aunque tú no lo veas aún, eres muy inteligente y tienes muchas caracteristicas que te hacen único, quisiera que pudieras ver a travéz de mis ojos lo que realmente eres, nunca dudes de lo que vales, ni dejes que otros te hagan sentir que vales menos, y si en algún momento sientes que no eres importante para nadie o que nadie te ama, quiero que sepas que aquí estoy yo, mientras yo exista siempre habrá alguien que te ame con todo su ser y para quien seas la persona más importante en su vida. Una vez más FELIZ CUMPLEAÑOOOSS DANIII 🥳🥳💕💕"
};

function wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const lines = wrapText(ctx, text, maxWidth);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const centerX = x + maxWidth / 2;
    lines.forEach((line, i) => {
        const lineCenterY = y + i * lineHeight + lineHeight / 2;
        ctx.fillText(line, centerX, lineCenterY);
    });
    ctx.restore();
    return lines.length;
}

const DOC_MARGIN = 24;
const DOC_BODY_LINE_HEIGHT = 19;
const DOC_SCROLLBAR_WIDTH = 6;

function openDocument(documentId) {
    if (!DOCUMENTS[documentId]) {
        console.warn(`No existe DOCUMENTS["${documentId}"]`);
        return;
    }
    activeDocument = { id: documentId, scrollOffset: 0 };
}

function closeDocument() {
    if (!activeDocument) return;
    const { id } = activeDocument;
    if (id === "PN") {
        inventory.PN = true;
    } else if (id.startsWith("note")) {
        const noteId = id.replace("note", "");
        if (!inventory.notes.includes(noteId)) inventory.notes.push(noteId);
    } else if (id.startsWith("letter")) {
        const letterId = id.replace("letter", "");
        if (!inventory.letters.includes(letterId)) inventory.letters.push(letterId);
        startEnding();
    }
    activeDocument = null;
}

function measureDocumentHeight(ctx, entry, maxWidth) {
    ctx.font = `10px 'Press Start 2P', 'Courier New', monospace`;
    const bodyLines = wrapText(ctx, entry.text, maxWidth).length;
    return bodyLines * DOC_BODY_LINE_HEIGHT;
}

function drawDocumentViewer() {
    if (!activeDocument) return;
    const entry = DOCUMENTS[activeDocument.id];
    if (!entry) return;

    c.save();
    c.fillStyle = "rgba(0, 0, 0, 0.5)";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.restore();

    if (letterImage.complete) {
        c.drawImage(letterImage, POPUP_X + 10, POPUP_Y + 10, POPUP_WIDTH - 20, POPUP_HEIGHT - 60);
    }

    const areaX = POPUP_X + 10 + DOC_MARGIN;
    const areaY = POPUP_Y + 10 + DOC_MARGIN;
    const areaWidth = POPUP_WIDTH - 20 - DOC_MARGIN * 2 - (DOC_SCROLLBAR_WIDTH + 6);
    const areaHeight = POPUP_HEIGHT - 60 - DOC_MARGIN * 2;
    const DOC_TEXT_TOP_OFFSET = 10;
    const textAreaY = areaY + DOC_TEXT_TOP_OFFSET;
    const textAreaHeight = areaHeight - DOC_TEXT_TOP_OFFSET;

    const bodyHeight = measureDocumentHeight(c, entry, areaWidth);
    const maxScroll = Math.max(0, bodyHeight - textAreaHeight);
    activeDocument.scrollOffset = Math.min(Math.max(0, activeDocument.scrollOffset), maxScroll);

    c.save();
    c.beginPath();
    c.rect(areaX, areaY, areaWidth, areaHeight);
    c.clip();

    c.fillStyle = "#2b2b2b";
    c.textAlign = "center";

    let cursorY;
    if (bodyHeight <= textAreaHeight) {
        cursorY = textAreaY + (textAreaHeight - bodyHeight) / 2;
    } else {
        cursorY = textAreaY - activeDocument.scrollOffset;
    }
    c.font = "10px 'Press Start 2P', 'Courier New', monospace";
    drawWrappedText(c, entry.text, areaX, cursorY, areaWidth, DOC_BODY_LINE_HEIGHT);

    c.restore();

    if (maxScroll > 0) {
        const trackX = areaX + areaWidth + 6;
        c.fillStyle = "rgba(255,255,255,0.15)";
        c.fillRect(trackX, areaY, DOC_SCROLLBAR_WIDTH, areaHeight);
        const thumbHeight = Math.max(20, areaHeight * (areaHeight / bodyHeight));
        const scrollRatio = activeDocument.scrollOffset / maxScroll;
        const thumbY = areaY + scrollRatio * (areaHeight - thumbHeight);
        c.fillStyle = "rgba(255,255,255,0.7)";
        c.fillRect(trackX, thumbY, DOC_SCROLLBAR_WIDTH, thumbHeight);
    }

    c.save();
    c.fillStyle = "white";
    c.font = "10px 'Press Start 2P', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    const POPUP_X_CENTRO = POPUP_X + POPUP_WIDTH / 2;
    c.fillText("Desliza para leer más — toca sin arrastrar para cerrar (Enter)", POPUP_X_CENTRO, POPUP_Y + POPUP_HEIGHT - 15);
    c.restore();
}

function scrollDocument(delta) {
    if (!activeDocument) return;
    activeDocument.scrollOffset += delta;
    if (activeDocument.scrollOffset < 0) activeDocument.scrollOffset = 0;
}

canvas.addEventListener('wheel', (e) => {
    if (!activeDocument) return;
    e.preventDefault();
    scrollDocument(e.deltaY);
}, { passive: false });

let docTouchStartY = 0;
let docTouchMoved = false;
const DOC_TAP_THRESHOLD = 10;

canvas.addEventListener('touchstart', (e) => {
    if (activeDocument) {
        docTouchStartY = e.touches[0].clientY;
        docTouchMoved = false;
    }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    if (!activeDocument) return;
    const currentY = e.touches[0].clientY;
    const delta = docTouchStartY - currentY;
    if (Math.abs(delta) > DOC_TAP_THRESHOLD) docTouchMoved = true;
    scrollDocument(delta);
    docTouchStartY = currentY;
}, { passive: true });

canvas.addEventListener('touchend', () => {
    if (activeDocument && !docTouchMoved) closeDocument();
});

canvas.addEventListener('click', () => { if (activeDocument) closeDocument(); });

let inventoryOpen = false;
function toggleInventory() { inventoryOpen = !inventoryOpen; }

let paused = false;
function togglePause() { paused = !paused; }

let inventoryItemRects = [];

canvas.addEventListener('click', (e) => {
    if (!inventoryOpen || activeDocument) return;
    const { x: clickX, y: clickY } = getCanvasCoords(e);
    for (const item of inventoryItemRects) {
        if (clickX >= item.x && clickX <= item.x + item.w && clickY >= item.y - 16 && clickY <= item.y + 6) {
            openDocument(item.documentId);
            inventoryOpen = false;
            break;
        }
    }
});

function drawInventory() {
    if (!inventoryOpen) return;
    c.fillStyle = "rgba(0,0,0,0.85)";
    c.fillRect(60, 60, canvas.width - 120, canvas.height - 120);
    c.fillStyle = "white";
    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";

    const INVENTORY_HEADER_TOP = 60;
    const INVENTORY_HEADER_HEIGHT = 70;
    const headerCenterY = INVENTORY_HEADER_TOP + INVENTORY_HEADER_HEIGHT / 2;

    c.font = "10px 'Press Start 2P', sans-serif";
    c.fillText("Inventario (toca un ítem para volver a leerlo)", canvas.width / 2, headerCenterY);

    inventoryItemRects = [];
    let offsetY = 130;
    const itemWidth = canvas.width - 160;

    c.font = "14px 'Press Start 2P', sans-serif";

    if (inventory.PN) {
        c.fillText("📜 Principal Note", canvas.width / 2, offsetY - 5);
        inventoryItemRects.push({ x: 80, y: offsetY, w: itemWidth, documentId: "PN" });
        offsetY += 26;
    }
    inventory.notes.forEach((id) => {
        c.fillText(`📝 Nota ${id}`, canvas.width / 2, offsetY - 5);
        inventoryItemRects.push({ x: 80, y: offsetY, w: itemWidth, documentId: `note${id}` });
        offsetY += 26;
    });
    inventory.letters.forEach((id) => {
        c.fillText(`✉️ Letter`, canvas.width / 2, offsetY - 5);
        inventoryItemRects.push({ x: 80, y: offsetY, w: itemWidth, documentId: `letter${id}` });
        offsetY += 26;
    });
    c.restore();
}

const PICKUP_DISTANCE = 20;
const NOTE_POINTS = 10;
const MAP_DARKNESS = 0.25;

function healGeto(amount = 1) {
    if (geto.hits > 0) {
        geto.hits = Math.max(0, geto.hits - amount);
    } else if (geto.lives < geto.maxLives) {
        geto.lives = Math.min(geto.lives + 1, geto.maxLives);
    }
}

function checkPickups() {
    if (PN && !PN.collected) {
        if (Math.hypot(geto.x - PN.x, geto.y - PN.y) < PICKUP_DISTANCE) {
            PN.collected = true;
            openDocument("PN");
        }
    }
    for (const note of groundNotes) {
        if (note.collected) continue;
        if (Math.hypot(geto.x - note.x, geto.y - note.y) < PICKUP_DISTANCE) {
            note.collected = true;
            score += NOTE_POINTS;
            openDocument(`note${note.id}`);
        }
    }
    if (groundLetter && !groundLetter.collected) {
        if (Math.hypot(geto.x - groundLetter.x, geto.y - groundLetter.y) < PICKUP_DISTANCE) {
            groundLetter.collected = true;
            openDocument(`letter${groundLetter.id}`);
        }
    }

   for (const heart of hearts) {
        if (heart.collected) continue;
        if (Math.hypot(geto.x - heart.x, geto.y - heart.y) < PICKUP_DISTANCE) {
            heart.collected = true;

            // Si Gojo está muerto, este corazón lo revive (sin importar
            // la vida de Geto) en vez de otorgar puntos o curar.
            if (gojo.deathActive) {
                gojo.resurrect();
                continue;
            }

            score += 5;
            const getoFullLife = geto.hits === 0 && geto.lives === geto.maxLives;
            if (getoFullLife && gojo.active) {
                gojo.heal(1);
            } else {
                healGeto(1);
            }
        }
    } 
}

let dialogueVisible = false;

function isInputLocked() {
    return activeDocument !== null || dialogueVisible || paused;
}

const GOJO_ENCOUNTER_RADIUS = 90;

function checkGojoEncounter() {
    if (metGojo || currentMap !== 1) return;
    const dist = Math.hypot(geto.x - gojo.x, geto.y - gojo.y);
    if (dist < GOJO_ENCOUNTER_RADIUS) {
        metGojo = true;
        dialogueVisible = true;
    }
}

function closeGojoDialogue() {
    if (!dialogueVisible) return;
    dialogueVisible = false;
    gojo.followingEnabled = true;
}

function drawDialogue() {
    if (!dialogueVisible) return;
    const dialogueText = "Gojo: \"Hay algo en este bosque que ha estado alterando a los conejos, deberíamos investigar.\"";
    const hintText = "(Enter o toca la pantalla para continuar)";

    const DIALOGUE_MARGIN = 24;
    const DIALOGUE_LINE_HEIGHT = 20;
    const DIALOGUE_FONT = "12px 'Press Start 2P', sans-serif";

    // Se mide el texto ANTES de saber la altura final de la caja, ya que
    // esa altura ahora depende de cuántas líneas ocupe el diálogo.
    c.font = DIALOGUE_FONT;
    const maxTextWidth = canvas.width - 80 - DIALOGUE_MARGIN * 2;
    const dialogueLines = wrapText(c, dialogueText, maxTextWidth);
    const textBlockHeight = dialogueLines.length * DIALOGUE_LINE_HEIGHT;

    // La caja crece hacia arriba según cuántas líneas necesite el texto,
    // dejando siempre espacio fijo abajo para la pista de "Enter...".
    const boxW = canvas.width - 80;
    const boxH = textBlockHeight + DIALOGUE_MARGIN * 2 + 30;
    const boxX = 40;
    const boxY = canvas.height - boxH - 40;
    const boxCenterX = boxX + boxW / 2;

    c.fillStyle = "rgba(0,0,0,0.8)";
    c.fillRect(boxX, boxY, boxW, boxH);
    c.strokeStyle = "white";
    c.strokeRect(boxX, boxY, boxW, boxH);

    c.save();
    c.fillStyle = "white";
    c.font = DIALOGUE_FONT;
    drawWrappedText(c, dialogueText, boxX + DIALOGUE_MARGIN, boxY + DIALOGUE_MARGIN, maxTextWidth, DIALOGUE_LINE_HEIGHT);

    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "9px 'Press Start 2P', sans-serif";
    c.fillText(hintText, boxCenterX, boxY + boxH - 15);
    c.restore();
}

function drawGojoDeathDialogue() {
    if (!gojo.deathDialogueVisible) return;
    const boxW = 480;
    const boxH = 70;
    const boxX = canvas.width / 2 - boxW / 2;
    const boxY = 20;

    c.save();
    c.fillStyle = "rgba(0,0,0,0.8)";
    c.fillRect(boxX, boxY, boxW, boxH);
    c.strokeStyle = "white";
    c.strokeRect(boxX, boxY, boxW, boxH);
    c.fillStyle = "white";
    c.font = "12px 'Press Start 2P', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("Encuentra un corazón para revivir a Gojo", canvas.width / 2, boxY + boxH / 2);
    c.restore();
}

canvas.addEventListener('click', () => { if (dialogueVisible && !activeDocument) closeGojoDialogue(); });

function startEnding() {
    loadMap3();
    saveProgress();
}

function saveProgress() {
    try {
        localStorage.setItem("jjk_game_save", JSON.stringify({
            completed: true,
            score,
            inventory
        }));
    } catch (e) {
        console.warn("No se pudo guardar el progreso:", e);
    }
}

function loadMap3() {
    currentMap = 3;
    currentMapImage = image3;
    curses = [];
    boss = null;
    hearts = [];
}

const gojoDanceAnim = new AnimationController("gojo", 150);
gojoDanceAnim.setAnimation("dance", "none");
const getoDanceAnim = new AnimationController("geto", 150);
getoDanceAnim.setAnimation("dance", "none");
const playerDanceAnim = new AnimationController("player", 150);
playerDanceAnim.setAnimation("dance", "none");

function drawEndingScene() {
    c.drawImage(currentMapImage, 0, 0, canvas.width, canvas.height);
    c.drawImage(cakeImage, canvas.width / 2 - 40, canvas.height / 2 - 20, 80, 80);

    gojoDanceAnim.update(deltaTime);
    getoDanceAnim.update(deltaTime);
    playerDanceAnim.update(deltaTime);

    if (getoDanceAnim.isReady()) {
        getoDanceAnim.draw(c, canvas.width / 2 - 160, canvas.height / 2 - 60, 64, 64);
    } else {
        c.drawImage(danceGetoImage, canvas.width / 2 - 160, canvas.height / 2 - 60, 64, 64);
    }

    if (gojoDanceAnim.isReady()) {
        gojoDanceAnim.draw(c, canvas.width / 2 + 80, canvas.height / 2 - 60, 64, 64);
    } else {
        c.drawImage(danceGojoImage, canvas.width / 2 + 80, canvas.height / 2 - 60, 64, 64);
    }

    if (playerDanceAnim.isReady()) {
        playerDanceAnim.draw(c, canvas.width / 2 - 40, canvas.height / 2 - 60, 64, 64);
    } else {
        c.drawImage(danceAuthorImage, canvas.width / 2 - 40, canvas.height / 2 - 60, 64, 64);
    }

    drawRestartButton("¡Felicidades! Toca para volver a empezar");
}

function restartGame() {
    geto.lives = geto.maxLives;
    geto.hits = 0;
    geto.alive = true;
    geto.invulnerable = false;
    geto.attackTarget = null;
    geto.jumpElapsed = 0;
    geto.jumpStartMapX = 0;
    geto.jumpStartMapY = 0;
    geto.jumpTargetMapX = 0;
    geto.jumpTargetMapY = 0;
    geto.direction = "down";

    gojo.lives = gojo.maxLives;
    gojo.hits = 0;
    gojo.alive = true;
    gojo.active = true;
    gojo.followingEnabled = false;
    gojo.direction = "down";
    gojo.frame = IDLE_FRAME;
    gojo.frameTimer = 0;
    gojo.isMoving = false;
    gojo.attackAnimTimer = 0;
    gojo.attackJump = null;
    gojo.attackTarget = null;
    gojo.deathDialogueVisible = false;


    inventory.notes = [];
    inventory.letters = [];
    inventory.PN = false;

    score = 0;
    gameOver = false;
    metGojo = false;
    dialogueVisible = false;
    activeDocument = null;
    paused = false;
    inventoryOpen = false;

    currentMap = 1;
    currentMapImage = image;
    currentCollisionsMap = collisionsMap;
    mapX = -480;
    mapY = -440;

    if (typeof mapData1 !== "undefined") loadMapObjects(mapData1);
}

function drawRestartButton(label) {
    const btnW = 440;
    const btnH = 50;
    const btnX = (canvas.width - btnW) / 2;
    const btnY = canvas.height - 80;
    c.fillStyle = "#333";
    c.fillRect(btnX, btnY, btnW, btnH);
    c.strokeStyle = "white";
    c.strokeRect(btnX, btnY, btnW, btnH);

    c.save();
    c.fillStyle = "white";
    c.font = "12px 'Press Start 2P', sans-serif";
    c.textAlign = "center";
    c.fillText(label, btnX + btnW / 2, btnY + 30);
    c.restore();

    canvas.onclick = (e) => {
        const { x: clickX, y: clickY } = getCanvasCoords(e);
        if (clickX > btnX && clickX < btnX + btnW && clickY > btnY && clickY < btnY + btnH) {
            restartGame();
            canvas.onclick = null;
        }
    };
}

// ---------------------------------------------------------------------
// HUD EN HTML/CSS: referencias a los elementos del DOM (definidos en tu
// HTML dentro de #game-viewport) y sincronización de su escala con el
// tamaño real en pantalla del canvas.
// ---------------------------------------------------------------------
const gameViewport = document.getElementById('game-viewport');
const hudHeartsContainer = document.getElementById('hud-hearts');
const hudScoreValue = document.getElementById('hud-score-value');

const heartElements = []; // un <div class="hud-heart"> por cada vida máxima

function buildHeartElements(maxLives) {
    hudHeartsContainer.innerHTML = '';
    heartElements.length = 0;
    for (let i = 0; i < maxLives; i++) {
        const heartEl = document.createElement('div');
        heartEl.className = 'hud-heart';
        heartEl.innerHTML = '<div class="heart-bg"></div><div class="heart-fill"></div>';
        hudHeartsContainer.appendChild(heartEl);
        heartElements.push(heartEl);
    }
}
buildHeartElements(geto.maxLives);

// Actualiza --hud-scale (usada por el CSS del puntaje) cada vez que el
// canvas cambia de tamaño real en pantalla, sin importar el dispositivo.
function updateHUDScale() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return; // canvas aún no visible
    const scale = rect.width / canvas.width; // canvas.width = 1024 (resolución interna)
    gameViewport.style.setProperty('--hud-scale', scale);
}

const hudResizeObserver = new ResizeObserver(updateHUDScale);
hudResizeObserver.observe(canvas);
window.addEventListener('orientationchange', updateHUDScale);
updateHUDScale();

window.addEventListener('resize', updateHUDScale);
window.addEventListener('orientationchange', updateHUDScale);
updateHUDScale();

/**
 * Dibuja un minimapa en la esquina superior derecha: el mapa completo
 * escalado a MINIMAP_WIDTH x MINIMAP_HEIGHT, con un punto rojo marcando
 * la posición real de Geto dentro del mundo.
 */
function drawMinimap() {
    const mapImg = currentMapImage;
    if (!mapImg.complete || mapImg.naturalWidth === 0) return;

    // Tamaño REAL del mundo actual (en píxeles), igual al usado para
    // dibujar el mapa grande: mapImg.width * mapScale.
    const worldWidth = mapImg.width * mapScale;
    const worldHeight = mapImg.height * mapScale;

    c.save();

    // Fondo + borde del minimapa, para que se distinga del juego detrás.
    c.fillStyle = "rgba(0,0,0,0.5)";
    c.fillRect(MINIMAP_X - 2, MINIMAP_Y - 2, MINIMAP_WIDTH + 4, MINIMAP_HEIGHT + 4);

    // Recorta el dibujo del mapa para que no se salga del recuadro.
    c.beginPath();
    c.rect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    c.clip();

    c.drawImage(mapImg, MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Posición real de Geto en el mundo, igual al cálculo de centerX/centerY en start().
    const worldX = -mapX + (canvas.width / 2 - playerSize / 2) + playerSize / 2;
    const worldY = -mapY + (canvas.height / 2 - playerSize / 2) + playerSize / 2;

    // Convierte esa posición a la escala reducida del minimapa.
    const dotX = MINIMAP_X + (worldX / worldWidth) * MINIMAP_WIDTH;
    const dotY = MINIMAP_Y + (worldY / worldHeight) * MINIMAP_HEIGHT;

    c.restore(); // quita el clip antes de dibujar el punto y el borde

    c.fillStyle = "#e53935";
    c.beginPath();
    c.arc(dotX, dotY, MINIMAP_DOT_SIZE, 0, Math.PI * 2);
    c.fill();

    c.strokeStyle = "white";
    c.lineWidth = 1;
    c.strokeRect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);
}

function drawHUD() {
    // Ya no se dibuja nada en el canvas: el HUD real vive en el DOM
    // (#hud-hearts y #hud-score, definidos en tu HTML). Esta función
    // ahora solo SINCRONIZA esos elementos con tus variables de juego
    // reales (geto.lives, geto.hits, score), manteniendo toda la lógica
    // igual que antes.
    for (let i = 0; i < geto.maxLives; i++) {
        const heartEl = heartElements[i];
        if (!heartEl) continue;

        let fraction;
        if (i < geto.lives - 1) {
            fraction = 1;
        } else if (i === geto.lives - 1) {
            fraction = Math.max(0, 1 - geto.hits / geto.hitsPerLife);
        } else {
            fraction = 0;
        }

        const fillEl = heartEl.querySelector('.heart-fill');
        const hiddenPercent = (1 - fraction) * 100;
        fillEl.style.clipPath = `inset(0 ${hiddenPercent}% 0 0)`;
    }

    hudScoreValue.textContent = score;
}

function drawPauseOverlay() {
    if (!paused) return;
    c.save();
    c.fillStyle = "rgba(0, 0, 0, 0.6)";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = "white";
    c.font = "20px 'Press Start 2P', sans-serif";
    c.textAlign = "center";
    c.fillText("PAUSA", canvas.width / 2, canvas.height / 2);
    c.font = "12px 'Press Start 2P', sans-serif";
    c.fillText("Presiona Enter o el botón de pausa para continuar", canvas.width / 2, canvas.height / 2 + 40);
    c.restore();
}

let movingUp = false, movingDown = false, movingRight = false, movingLeft = false;
let currentImage = getoDownImage;
let loaded = 0;

const mapScale = 4;
const playerSize = 64;
let mapX = -480;
let mapY = -440;

{
    const tileSizeForEntry = 16 * mapScale;
    const playerScreenX = canvas.width / 2 - playerSize / 2;
    const playerScreenY = canvas.height / 2 - playerSize / 2;

    const map2TargetCenterX = MAP2_ENTRY_COLUMN * tileSizeForEntry + tileSizeForEntry / 2;
    const map2TargetCenterY = MAP2_ENTRY_ROW * tileSizeForEntry + tileSizeForEntry / 2;
    MAP2_ENTRY_X = playerScreenX + playerSize / 2 - map2TargetCenterX;
    MAP2_ENTRY_Y = playerScreenY + playerSize / 2 - map2TargetCenterY;

    const map1TargetCenterX = MAP1_ENTRY_COLUMN * tileSizeForEntry + tileSizeForEntry / 2;
    const map1TargetCenterY = MAP1_ENTRY_ROW * tileSizeForEntry + tileSizeForEntry / 2;
    MAP1_ENTRY_X = playerScreenX + playerSize / 2 - map1TargetCenterX;
    MAP1_ENTRY_Y = playerScreenY + playerSize / 2 - map1TargetCenterY;
}

const collisionsMap = [];
const collisionsMap2 = [];
const mapWidth = 40;
const mapWidth2 = 40;

for (let i = 0; i < collisions.length; i += mapWidth) {
    collisionsMap.push(collisions.slice(i, i + mapWidth));
}
for (let i = 0; i < collisions2.length; i += mapWidth2) {
    collisionsMap2.push(collisions2.slice(i, i + mapWidth2));
}
currentCollisionsMap = collisionsMap;

function getObjectProperty(object, propertyName) {
    if (!object.properties) return null;
    const found = object.properties.find(p => p.name === propertyName);
    return found ? found.value : null;
}

function loadMapObjects(mapData) {
    hearts = [];
    curses = [];
    groundNotes = [];
    PN = null;
    groundLetter = null;
    boss = null;

    const objectsLayer = mapData.layers.find(layer => layer.name === "Objects");
    if (!objectsLayer) return;

    for (const object of objectsLayer.objects) {
        const x = object.x * mapScale;
        const y = object.y * mapScale;

        switch (object.name) {
            case "H":
                hearts.push({ x, y, collected: false });
                break;
            case "BR":
                curses.push(new Curse(x, y, "black", getObjectProperty(object, "noteId")));
                break;
            case "WR":
                curses.push(new Curse(x, y, "white", getObjectProperty(object, "noteId")));
                break;
            case "PN":
                PN = { x, y, id: getObjectProperty(object, "PN"), collected: false };
                break;
            case "Boss":
                boss = new Boss(x, y, getObjectProperty(object, "letter"));
                break;
            case "Gojo":
                if (!gojo.followingEnabled) {
                    gojo.x = x;
                    gojo.y = y;
                }
                break;
        }
    }
}

if (typeof mapData1 !== "undefined") loadMapObjects(mapData1);

function performAttack() {
    if (geto.attackCooldown > 0 || gameOver || isInputLocked()) return;
    geto.attacking = true;
    geto.attackCooldown = 20;
    geto.attackFrame = 0;
    geto.attackFrameTimer = 0;

    // FIX (Requerimiento 1): además de aplicar daño en área a todas las
    // maldiciones/boss dentro de rango (comportamiento original), se
    // registra cuál es el objetivo MÁS CERCANO para usarlo como destino
    // del ataque de Geto.
    let jumpTarget = null;
    let bestDist = Infinity;

    for (const curse of curses) {
        if (!curse.alive) continue;
        const dist = Math.hypot(curse.x - geto.x, curse.y - geto.y);
        if (dist < geto.attackRange) {
            applyDamage(curse, 1);
            if (dist < bestDist) {
                bestDist = dist;
                jumpTarget = curse;
            }
        }
    }

    if (boss && boss.alive) {
        const dist = Math.hypot(boss.x - geto.x, boss.y - geto.y);
        if (dist < geto.attackRange) {
            applyDamage(boss, 1);
            if (dist < bestDist) {
                bestDist = dist;
                jumpTarget = boss;
            }
        }
    }

    if (jumpTarget) {
        // FIX (orientación de ataque): antes de saltar, Geto voltea a
        // mirar EXACTAMENTE hacia la maldición objetivo (basado en la
        // posición relativa dx/dy entre Geto y el objetivo), en vez de
        // conservar/forzar cualquier otra dirección. Este bloque solo se
        // ejecuta cuando SÍ hay un objetivo (jumpTarget); si el ataque no
        // impacta a ninguna maldición, currentImage/geto.direction no se
        // tocan en absoluto y Geto simplemente conserva la dirección que
        // ya tenía (nunca se fuerza a mirar hacia abajo por defecto).
        const facingDx = jumpTarget.x - geto.x;
        const facingDy = jumpTarget.y - geto.y;
        if (Math.abs(facingDx) > Math.abs(facingDy)) {
            currentImage = facingDx < 0 ? getoLeftImage : getoRightImage;
            geto.direction = facingDx < 0 ? "left" : "right";
        } else {
            currentImage = facingDy < 0 ? getoUpImage : getoDownImage;
            geto.direction = facingDy < 0 ? "up" : "down";
        }

        // ATTACK REWORK: Geto SIEMPRE permanece fijo en el centro exacto
        // de la pantalla (nunca cambian sus coordenadas de renderizado en
        // el viewport). Para simular que "salta" sobre la maldición, en
        // vez de mover a Geto se recalcula y se desplaza el MAPA
        // (mapX/mapY) hasta que la maldición objetivo quede EXACTAMENTE
        // centrada en pantalla — es decir, el mundo se teletransporta
        // debajo de Geto. jumpStartMapX/Y guardan el offset de mapa
        // actual (punto de partida de la interpolación) y
        // jumpTargetMapX/Y el offset final que centra a la maldición.
        // Es un movimiento de UNA SOLA DIRECCIÓN: al terminar la
        // animación el mapa se queda fijo en la nueva posición para
        // siempre, sin regresar jamás al offset anterior.
        geto.attackTarget = jumpTarget;
        geto.jumpElapsed = 0;
        geto.jumpDuration = ATTACK_JUMP_DURATION;
        geto.jumpStartMapX = mapX;
        geto.jumpStartMapY = mapY;
        geto.jumpTargetMapX = canvas.width / 2 - jumpTarget.x;
        geto.jumpTargetMapY = canvas.height / 2 - jumpTarget.y;
    }
}

window.addEventListener('keydown', (event) => {
    const isCloseKey = event.key === 'Enter';

    if (activeDocument) {
        if (isCloseKey) closeDocument();
        return;
    }

    if (dialogueVisible) {
        if (isCloseKey) closeGojoDialogue();
        return;
    }

    if (gameOver) {
        if (event.key === 'Enter') restartGame();
        return;
    }

    if (event.code === 'Space') performAttack();
    if (event.key === 'i' || event.key === 'I') {
        if (isInputLocked()) return;
        toggleInventory();
    }
    if (event.key === 'Enter') {
        togglePause();
    }
});

if (inventoryButton) {
    inventoryButton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (isInputLocked()) return;
        toggleInventory();
    });
}

if (attackButton) {
    attackButton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        performAttack();
    });
}

if (pauseButton) {
    pauseButton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (activeDocument !== null || dialogueVisible) return;
        togglePause();
    });
}

// Intento de bloqueo real de orientación horizontal (solo funciona en
// navegadores compatibles y tras interacción del usuario; si falla o
// no está disponible, el truco CSS de arriba sigue como respaldo).
function tryLockLandscape() {
    if (document.fullscreenElement && screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
            // Silenciosamente ignorado: el CSS de rotación forzada cubre este caso.
        });
    }
}

document.body.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().then(tryLockLandscape).catch(() => {});
    }
}, { once: true });

// FIX: deltaTime y lastFrameTime ahora son globales, declaradas ANTES de start().
let lastFrameTime = performance.now();
let deltaTime = 0;

function start() {
    const __now = performance.now();
    deltaTime = __now - lastFrameTime; // FIX: ya no es "const" local, reutiliza la global
    lastFrameTime = __now;

    if (gameOver) {
        c.clearRect(0, 0, canvas.width, canvas.height);
        c.fillStyle = "black";
        c.fillRect(0, 0, canvas.width, canvas.height);
        c.fillStyle = "white";
        c.font = "18px 'Press Start 2P', sans-serif";
        c.textAlign = "center";
        c.fillText("Has perdido todas las vidas", canvas.width / 2, canvas.height / 2 - 60);
        c.textAlign = "left";
        drawRestartButton("Reiniciar partida");
        requestAnimationFrame(start);
        return;
    }

    if (currentMap === 3) {
        drawEndingScene();
        requestAnimationFrame(start);
        return;
    }

    const x = canvas.width / 2 - playerSize / 2;
    const y = canvas.height / 2 - playerSize / 2;

    const centerX = -mapX + x + playerSize / 2;
    const centerY = -mapY + y + playerSize / 2;

    geto.x = centerX;
    geto.y = centerY;

    const tileSize = 16 * mapScale;
    const row = Math.floor(centerY / tileSize);
    const column = Math.floor(centerX / tileSize);
    const hitbox = 20;

    const rowUp = Math.floor((centerY - playerSize / 2 + hitbox) / tileSize);
    const rowDown = Math.floor((centerY + playerSize / 2 - hitbox + 8) / tileSize);
    const columnLeft = Math.floor((centerX - playerSize / 2 + hitbox) / tileSize);
    const columnRight = Math.floor((centerX + playerSize / 2 - hitbox) / tileSize);

    const uiBlocked = isInputLocked();

    if (!uiBlocked) {
        if (movingUp && currentCollisionsMap[rowUp]?.[column] !== 84) {
            mapY += 2;
        }
        if (movingDown && currentCollisionsMap[rowDown]?.[column] !== 84) {
            mapY -= 2;
        }
        if (movingRight && currentCollisionsMap[row]?.[columnRight] !== 84) {
            mapX -= 2;
        }
        if (movingLeft && currentCollisionsMap[row]?.[columnLeft] !== 84) {
            mapX += 2;
        }
    }

    const getoIsMoving = !uiBlocked && (movingUp || movingDown || movingLeft || movingRight);
    geto.state = geto.attacking ? "attack" : (getoIsMoving ? "walk" : "idle");
    if (getoIsMoving) {
        updateAnimationFrame(geto, geto.walkFrameCount);
    } else {
        // FIX #1: Geto detenido se congela en el frame idle (2) en vez de 0.
        geto.frame = IDLE_FRAME;
        geto.frameTimer = 0;
    }

    // FIX: sincroniza el AnimationController de Geto con la dirección
    // actual (deducida de "currentImage", que ya maneja el input) y con
    // el estado (walk/attack), y lo actualiza con deltaTime real.
    let getoAnimDirection = "front";
    if (currentImage === getoUpImage) getoAnimDirection = "back";
    else if (currentImage === getoLeftImage) getoAnimDirection = "left";
    else if (currentImage === getoRightImage) getoAnimDirection = "right";
    else getoAnimDirection = "front";

    geto.animation.setAnimation(geto.attacking ? "attack" : "walk", getoAnimDirection);
    // FIX #1: si Geto no se está moviendo ni atacando, su
    // AnimationController se fija en el frame idle (2) en vez de quedar
    // en un frame aleatorio del último ciclo de caminata.
    if (getoIsMoving || geto.attacking) {
        geto.animation.playing = true;
        geto.animation.update(deltaTime);
    } else {
        geto.animation.pauseAtIdle();
    }

    // ATTACK REWORK: interpolación del "salto de ataque" de Geto. En vez
    // de desplazar visualmente a Geto (que debe permanecer siempre fijo
    // en el centro de la pantalla), se interpola directamente el offset
    // del MAPA (mapX/mapY) desde su valor al iniciar el ataque
    // (jumpStartMapX/Y) hasta el valor que deja centrada a la maldición
    // objetivo (jumpTargetMapX/Y). Es una interpolación de IDA
    // ÚNICAMENTE: al llegar a t=1 el mapa se queda fijo en la posición
    // final para siempre (no hay animación de regreso), cumpliendo la
    // regla de no-retorno. Mientras el salto está en curso, este bloque
    // sobrescribe cualquier cambio de mapX/mapY hecho por el movimiento
    // normal del jugador en este mismo frame, priorizando el ataque.
    if (geto.attackTarget) {
        geto.jumpElapsed += deltaTime;
        const t = Math.min(1, geto.jumpElapsed / geto.jumpDuration);
        mapX = geto.jumpStartMapX + (geto.jumpTargetMapX - geto.jumpStartMapX) * t;
        mapY = geto.jumpStartMapY + (geto.jumpTargetMapY - geto.jumpStartMapY) * t;
        if (geto.jumpElapsed >= geto.jumpDuration) {
            mapX = geto.jumpTargetMapX;
            mapY = geto.jumpTargetMapY;
            geto.attackTarget = null;
        }
    }

    const playerCenterX = -mapX + x + playerSize / 2;
    const playerCenterY = -mapY + y + playerSize / 2;
    const playerRow = Math.floor(playerCenterY / tileSize);
    const playerColumn = Math.floor(playerCenterX / tileSize);

    if (currentMap === 1 && playerRow === MAP1_TO_MAP2_TRIGGER_ROW && playerColumn === MAP1_TO_MAP2_TRIGGER_COLUMN) {
        currentMap = 2;
        currentMapImage = image2;
        currentCollisionsMap = collisionsMap2;
        mapX = MAP2_ENTRY_X;
        mapY = MAP2_ENTRY_Y;
        if (typeof mapData2 !== "undefined") loadMapObjects(mapData2);
        if (gojo.active && gojo.followingEnabled) {
            const arrivalCenterX = -mapX + x + playerSize / 2;
            const arrivalCenterY = -mapY + y + playerSize / 2;
            gojo.x = arrivalCenterX + 40;
            gojo.y = arrivalCenterY + 20;
        }
    }
    if (currentMap === 2 && playerRow === MAP2_TO_MAP1_TRIGGER_ROW && playerColumn === MAP2_TO_MAP1_TRIGGER_COLUMN) {
        currentMap = 1;
        currentMapImage = image;
        currentCollisionsMap = collisionsMap;
        mapX = MAP1_ENTRY_X;
        mapY = MAP1_ENTRY_Y;
        if (typeof mapData1 !== "undefined") loadMapObjects(mapData1);
        if (gojo.active && gojo.followingEnabled) {
            const arrivalCenterX = -mapX + x + playerSize / 2;
            const arrivalCenterY = -mapY + y + playerSize / 2;
            gojo.x = arrivalCenterX + 40;
            gojo.y = arrivalCenterY + 20;
        }
    }

    const getoWasInvulnerable = geto.invulnerable;
    updateInvulnerability(geto);
    if (getoWasInvulnerable && !geto.invulnerable) {
        currentImage = getoDownImage;
        directionKeyStack.length = 0;
    }
    if (geto.attackCooldown > 0) {
        geto.attackCooldown--;
        if (geto.attackCooldown === 0) geto.attacking = false;
    }
    
    if (!paused) {
        checkGojoEncounter();
        gojo.update();
        for (const curse of curses) curse.update();
        if (boss) boss.update();
        checkPickups();
    }
    gojo.updateDeathBlink(deltaTime);

    c.clearRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    c.drawImage(currentMapImage, mapX, mapY, currentMapImage.width * mapScale, currentMapImage.height * mapScale);

    for (const heart of hearts) {
        if (heart.collected) continue;
        c.drawImage(heartImage, mapX + heart.x - 12, mapY + heart.y - 12, 24, 24);
    }

    for (const note of groundNotes) {
        if (note.collected) continue;
        c.drawImage(noteImage, mapX + note.x - 12, mapY + note.y - 12, 24, 24);
    }

    if (groundLetter && !groundLetter.collected) {
        c.drawImage(letter, mapX + groundLetter.x - 14, mapY + groundLetter.y - 14, 28, 28);
    }

    if (PN && !PN.collected) {
        c.drawImage(noteImage, mapX + PN.x - 12, mapY + PN.y - 12, 24, 24);
    }

    // FIX (Y-SORTING): en vez de dibujar en un orden fijo (Geto siempre
    // debajo, luego curses, gojo y boss siempre encima), se arma una lista
    // de entidades dinámicas junto con su coordenada Y de mundo y se
    // ordenan ascendentemente por esa Y antes de dibujarlas. Así, quien
    // tenga la Y mayor (esté más abajo en pantalla) se dibuja al final —
    // y por lo tanto queda por encima — replicando la perspectiva de
    // profundidad típica de un juego top-down.
    //
    // FIX (Requerimiento 1): además, si Geto o Gojo están en pleno ataque
    // sobre una maldición (attackTarget definido), su clave de orden
    // ("sortY") se fuerza a "attackTarget.y + 1" en vez de su propia Y.
    // Esto garantiza que se dibujen JUSTO DESPUÉS que la maldición
    // atacada en el arreglo ordenado, quedando visualmente por
    // delante/encima de ella durante la animación, sin importar la
    // posición Y real de ambos.
    const depthEntities = [];

    depthEntities.push({
        y: geto.attackTarget ? geto.attackTarget.y + 1 : geto.y,
        draw: () => {
            if (isBlinkVisible(geto)) {
                // ATTACK REWORK: Geto se dibuja SIEMPRE en las coordenadas
                // fijas de pantalla (x, y) — el centro del viewport — sin
                // ningún offset de dibujo adicional, ya que ahora es el
                // mapa (mapX/mapY) el que se desplaza para dar la
                // ilusión del salto.
                if (geto.animation.isReady()) {
                    geto.animation.draw(c, x, y, playerSize, playerSize);
                } else {
                    c.drawImage(currentImage, x, y, playerSize, playerSize);
                }
                drawHealthBar(x, y - 10, playerSize, geto);
            }
        }
    });

    for (const curse of curses) {
        depthEntities.push({ y: curse.y, draw: () => curse.draw(mapX, mapY) });
    }

    depthEntities.push({
        y: gojo.attackTarget ? gojo.attackTarget.y + 1 : gojo.y,
        draw: () => gojo.draw(mapX, mapY)
    });

    if (boss) {
        depthEntities.push({ y: boss.y, draw: () => boss.draw(mapX, mapY) });
    }

    depthEntities.sort((a, b) => a.y - b.y);
    for (const entity of depthEntities) entity.draw();

    if (currentMap === 1) {
        c.drawImage(topImage, mapX, mapY, topImage.width * mapScale, topImage.height * mapScale);
    } else {
        c.drawImage(topImage2, mapX, mapY, topImage2.width * mapScale, topImage2.height * mapScale);
    }
    
    c.fillStyle = `rgba(0, 0, 0, ${MAP_DARKNESS})`;
    c.fillRect(0, 0, canvas.width, canvas.height);

    drawHUD();
    drawDialogue();
    drawMinimap();
    gojo.drawDead(mapX, mapY);
    drawGojoDeathDialogue();
    drawDocumentViewer();
    drawInventory();
    drawPauseOverlay();

    requestAnimationFrame(start);
}

function check() {
    loaded++;
    if (loaded === 23) start();
}

function bindDirectionButton(button, image, setMoving) {
    button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (isInputLocked()) return;
        currentImage = image;
        setMoving(true);
    });
    button.addEventListener('pointerup', (e) => {
        e.preventDefault();
        setMoving(false);
    });
    button.addEventListener('pointercancel', () => setMoving(false));
}

bindDirectionButton(rightButton, getoRightImage, v => movingRight = v);
bindDirectionButton(leftButton, getoLeftImage, v => movingLeft = v);
bindDirectionButton(upButton, getoUpImage, v => movingUp = v);
bindDirectionButton(downButton, getoDownImage, v => movingDown = v);
const directionKeyStack = [];

function keyToDirection(key) {
    switch (key) {
        case 'd': case 'D': case 'ArrowRight': return 'right';
        case 'a': case 'A': case 'ArrowLeft': return 'left';
        case 'w': case 'W': case 'ArrowUp': return 'up';
        case 's': case 'S': case 'ArrowDown': return 'down';
        default: return null;
    }
}

function updateCurrentImageFromStack() {
    const activeDirection = directionKeyStack[directionKeyStack.length - 1];
    switch (activeDirection) {
        case 'right': currentImage = getoRightImage; break;
        case 'left': currentImage = getoLeftImage; break;
        case 'up': currentImage = getoUpImage; break;
        case 'down': currentImage = getoDownImage; break;
    }
}

window.addEventListener('keydown', (event) => {
    const direction = keyToDirection(event.key);
    if (!direction) return;
    if (isInputLocked()) return;

    if (direction === 'right') movingRight = true;
    if (direction === 'left') movingLeft = true;
    if (direction === 'up') movingUp = true;
    if (direction === 'down') movingDown = true;

    if (!directionKeyStack.includes(direction)) directionKeyStack.push(direction);
    updateCurrentImageFromStack();
});

window.addEventListener('keyup', (event) => {
    const direction = keyToDirection(event.key);
    if (!direction) return;

    if (direction === 'right') movingRight = false;
    if (direction === 'left') movingLeft = false;
    if (direction === 'up') movingUp = false;
    if (direction === 'down') movingDown = false;

    const index = directionKeyStack.indexOf(direction);
    if (index !== -1) directionKeyStack.splice(index, 1);
    updateCurrentImageFromStack();
});

image.onload = check;
image2.onload = check;
getoDownImage.onload = check;
getoUpImage.onload = check;
getoRightImage.onload = check;
getoLeftImage.onload = check;
gojoUpImage.onload = check;
gojoDownImage.onload = check;
gojoLeftImage.onload = check;
gojoRightImage.onload = check;
blackRabbitUpImage.onload = check;
blackRabbitDownImage.onload = check;
blackRabbitLeftImage.onload = check;
blackRabbitRightImage.onload = check;
whiteRabbitUpImage.onload = check;
whiteRabbitDownImage.onload = check;
whiteRabbitLeftImage.onload = check;
whiteRabbitRightImage.onload = check;
heartImage.onload = check;
noteImage.onload = check;
letter.onload = check;
topImage.onload = check;
topImage2.onload = check;

image.src = 'images/Map1.png';
image2.src = 'images/Map2.png';
image3.src = 'images/Map3.png';
topImage.src = 'images/Map1CapaSup.png';
topImage2.src = 'images/Map2CapaSup.png';
getoUpImage.src = 'images/backGeto.png';
getoDownImage.src = 'images/frontGeto.png';
getoRightImage.src = 'images/rightGeto.png';
getoLeftImage.src = 'images/leftGeto.png';
gojoUpImage.src = 'images/backGojo.png';
gojoDownImage.src = 'images/frontGojo.png';
gojoLeftImage.src = 'images/leftGojo.png';
gojoRightImage.src = 'images/rightGojo.png';
blackRabbitUpImage.src = 'images/rabbitBack.png';
blackRabbitDownImage.src = 'images/rabbitFront.png';
blackRabbitLeftImage.src = 'images/rabbitLeft.png';
blackRabbitRightImage.src = 'images/rabbiRight.png';
whiteRabbitUpImage.src = 'images/WRabbitBack.png';
whiteRabbitDownImage.src = 'images/WRabbitFront.png';
whiteRabbitLeftImage.src = 'images/WRabbitLeft.png';
whiteRabbitRightImage.src = 'images/WRabbitRight.png';
heartImage.src = "images/heart.png";
noteImage.src = "images/note.png";
letter.src = "images/bossLetter.png";
bossImage.src = "images/bossFront.png";
danceGetoImage.src = "images/danceGeto.png";
danceGojoImage.src = "images/danceGojo.png";
danceAuthorImage.src = "images/meDance.png";
cakeImage.src = "images/cake.png";
deadGojoImage.src = "images/deadGojo.png";

// FIX #2: se renombran las claves "front"/"back" a "down"/"up" para
// blackRabbit, whiteRabbit, gojo y boss. Estos personajes guardan su
// dirección (this.direction) como "up"/"down"/"left"/"right" (no como
// "front"/"back", que es exclusivo del esquema de Geto). Con las claves
// antiguas, AnimationController.getImage() nunca encontraba coincidencia
// para "up"/"down" y esos personajes se quedaban sin animación de
// spritesheet (y por lo tanto sin animar) al moverse arriba o abajo.
// Geto conserva front/back porque su código arma explícitamente esa
// dirección ("front"/"back"/"left"/"right") en la función start().
const ANIMATION_SOURCES = {
    blackRabbit: {
        walk: {
            down: "images/frontRabittWalk.png",
            up:   "images/backRabittWalk.png",
            left:  "images/leftRabittWalk.png",
            right: "images/rightRabittWalk.png",
        },
    },
    whiteRabbit: {
        walk: {
            down: "images/frontWRabittWalk.png",
            up:   "images/backWRabittWalk.png",
            left:  "images/leftWRabittWalk.png",
            right: "images/rightWRabittWalk.png",
        },
    },
    gojo: {
        walk: {
            down: "images/frontGojoWalk.png",
            up:   "images/backGojoWalk.png",
            left:  "images/leftGojoWalk.png",
            right: "images/rightGojoWalk.png",
        },
        attack: {
            down: "images/frontGojoAttack.png",
            up:   "images/backGojoAttack.png",
            left:  "images/leftGojoAttack.png",
            right: "images/rightGojoAttack.png",
        },
        dance: {
            none: "images/danceGojo.png",
        },
    },
    geto: {
        walk: {
            front: "images/frontGetoWalk.png",
            back:  "images/backGetoWalk.png",
            left:  "images/leftGetoWalk.png",
            right: "images/rightGetoWalk.png",
        },
        attack: {
            front: "images/frontGetoAttack.png",
            back:  "images/backGetoAttack.png",
            left:  "images/leftGetoAttack.png",
            right: "images/rightGetoAttack.png",
        },
        dance: {
            none: "images/danceGeto.png",
        },
    },
    boss: {
        walk: {
            down: "images/frontBossWalk.png",
            up:   "images/backBossWalk.png",
            left:  "images/leftBossWalk.png",
            right: "images/rightBossWalk.png",
        },
        attack: {
            down: "images/frontBossAttack.png",
            up:   "images/backBossAttack.png",
            left:  "images/leftBossAttack.png",
            right: "images/rightBossAttack.png",
        },
    },
    player: {
        dance: {
            none: "images/meDance.png",
        },
    },
};

loadAnimationSources(() => {
    console.log("Spritesheets de animación cargados correctamente.");
});
