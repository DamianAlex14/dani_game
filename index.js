const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

canvas.width = 1024;
canvas.height = 576;

c.imageSmoothingEnabled = false;

/**
 * Traduce las coordenadas de un evento de mouse/touch (que vienen en
 * píxeles de PANTALLA) a píxeles INTERNOS del canvas (1024x576), sin
 * importar a qué tamaño el navegador esté mostrando el canvas realmente
 * (por el max-width:100vw / max-height:100vh del CSS).
 */
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

const image = new Image();
const image2 = new Image(); // Mapa 2
const image3 = new Image(); // Mapa 3 (escena final)
const getoUpImage = new Image();
const getoDownImage = new Image();
const getoLeftImage = new Image();
const getoRightImage = new Image();

// --- Sprites de Gojo por dirección ---
const gojoUpImage = new Image();
const gojoDownImage = new Image();
const gojoLeftImage = new Image();
const gojoRightImage = new Image();

// --- Sprites de las maldiciones (conejos) por dirección ---
const blackRabbitUpImage = new Image();
const blackRabbitDownImage = new Image();
const blackRabbitLeftImage = new Image();
const blackRabbitRightImage = new Image();
const whiteRabbitUpImage = new Image();
const whiteRabbitDownImage = new Image();
const whiteRabbitLeftImage = new Image();
const whiteRabbitRightImage = new Image();

const heartImage = new Image();
const noteImage = new Image(); // sprite genérico de "nota en el suelo"
const letter = new Image();
const bossImage = new Image();
const danceGetoImage = new Image();
const danceGojoImage = new Image();
const danceAuthorImage = new Image();
const cakeImage = new Image();
const topImage = new Image();
const topImage2 = new Image();

// Sistema de cambio de mapa
let currentMap = 1;
let currentMapImage = image;
let currentCollisionsMap;

// Casilla de activación (trigger tile) para pasar del Mapa 1 al Mapa 2
const MAP1_TO_MAP2_TRIGGER_ROW = 0;
const MAP1_TO_MAP2_TRIGGER_COLUMN = 14;

const MAP2_TO_MAP1_TRIGGER_ROW = 29;
const MAP2_TO_MAP1_TRIGGER_COLUMN = 14;

// Punto de entrada al Mapa 2 (fila/columna -> se calcula en píxeles debajo)
const MAP2_ENTRY_ROW = 28;
const MAP2_ENTRY_COLUMN = 14;
const MAP1_ENTRY_ROW = 1;
const MAP1_ENTRY_COLUMN = 14;
let MAP2_ENTRY_X, MAP2_ENTRY_Y, MAP1_ENTRY_X, MAP1_ENTRY_Y;

// --- Objetos del mapa actual (se llenan con loadMapObjects) ---
let hearts = [];       // corazones recogibles
let curses = [];       // instancias de Curse (conejos)
let groundNotes = [];  // notas caídas en el suelo, listas para recoger
let PN = null;         // Principal Note física en el mapa
let groundLetter = null; // Letter física en el suelo (la deja el boss)
let boss = null;       // instancia de Boss (si el mapa tiene uno)

// =====================================================================
// SISTEMA DE VIDAS / DAÑO (constantes compartidas por Geto, Gojo, Curse y Boss)
// =====================================================================
const HITS_PER_LIFE = 3;           // golpes que aguanta cada "vida"
const INVULNERABILITY_MS = 1000;   // 1s de parpadeo tras recibir daño
const BLINK_INTERVAL_MS = 100;     // velocidad del parpadeo visual
const HIT_STUN_FRAMES = 20;        // congela el contraataque del enemigo tras recibir un golpe exitoso   // velocidad del parpadeo visual

// =====================================================================
// ARQUITECTURA DE ANIMACIÓN POR SPRITESHEET (preparación)
// -----------------------------------------------------------------------
// Todos los spritesheets futuros (caminar, atacar) se organizan como una
// hoja larga horizontal donde cada frame mide SPRITE_FRAME_SIZE x
// SPRITE_FRAME_SIZE píxeles. Para animar solo hay que ir corriendo el
// recorte de origen (sx) en múltiplos de SPRITE_FRAME_SIZE.
// =====================================================================
const SPRITE_FRAME_SIZE = 32;

/**
 * Avanza el frame de animación de una entidad según un temporizador.
 * entity necesita: { frame, frameTimer, frameInterval } y se le pasa
 * cuántos frames tiene la animación activa (totalFrames), para hacer loop.
 */
function updateAnimationFrame(entity, totalFrames) {
    if (totalFrames <= 1) { entity.frame = 0; return; }
    entity.frameTimer++;
    if (entity.frameTimer >= entity.frameInterval) {
        entity.frameTimer = 0;
        entity.frame = (entity.frame + 1) % totalFrames;
    }
}

/**
 * Dibuja el frame actual de un spritesheet (32x32 por frame, en fila
 * horizontal) escalado al tamaño de destino deseado.
 * sheetImage: Image ya cargada, con frames de SPRITE_FRAME_SIZE x SPRITE_FRAME_SIZE.
 * entity: necesita al menos { frame }.
 */
/**
 * Igual que updateAnimationFrame pero para el ciclo de ANIMACIÓN DE ATAQUE,
 * que se guarda en campos separados (attackFrame/attackFrameTimer/
 * attackFrameInterval) para no pisar la animación de caminar.
 */
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

/**
 * Aplica daño genérico a cualquier entidad con el "contrato" de vidas:
 * { lives, hits, hitsPerLife, invulnerable, invulnerableUntil, alive, onDeath() }
 * Se reutiliza para Geto, Gojo, Curse y Boss para no repetir lógica.
 */
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

    // Invulnerabilidad temporal + parpadeo, para dar feedback y evitar
    // que un mismo golpe reste varias vidas en un solo frame de contacto.
    entity.invulnerable = true;
    entity.invulnerableUntil = performance.now() + INVULNERABILITY_MS;

    // Regla de prioridad de combate: si a quien se acaba de golpear es
    // un enemigo (Curse o Boss — se identifican porque son los únicos
    // con "damage" y "attackCooldown" propios), se congela momentáneamente
    // su capacidad de contraatacar. Así, si Geto o Gojo golpean con éxito
    // a una maldición o al Boss, este NO puede devolver el golpe en el
    // mismo instante.
    if (typeof entity.damage === "number" && typeof entity.attackCooldown === "number") {
        entity.attackCooldown = Math.max(entity.attackCooldown, HIT_STUN_FRAMES);
    }
}

/** Actualiza el flag de invulnerabilidad cuando el tiempo expira. */
function updateInvulnerability(entity) {
    if (entity.invulnerable && performance.now() >= entity.invulnerableUntil) {
        entity.invulnerable = false;
    }
}

/** Devuelve true en ventanas alternas mientras dura la invulnerabilidad (efecto parpadeo). */
function isBlinkVisible(entity) {
    if (!entity.invulnerable) return true;
    return Math.floor(performance.now() / BLINK_INTERVAL_MS) % 2 === 0;
}

/**
 * Dibuja una barra de vida sencilla encima de una entidad.
 * currentLives/hitsLeftInLife se usan para mostrar progreso dentro de la vida actual.
 */
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

    // --- Preparado para animación por spritesheet (walk) ---
    state: "idle",           // idle | walk | attack | dying
    direction: "down",       // down | up | left | right (espejo del currentImage actual)
    frame: 0,
    frameTimer: 0,
    frameInterval: 8,        // cuántos frames de juego dura cada frame de animación
    walkFrameCount: 4,       // TODO: ajustar según el spritesheet real de caminar

    // --- Preparado para animación de ataque ---
    attackFrame: 0,
    attackFrameTimer: 0,
    attackFrameInterval: 4,
    attackFrameCount: 3,     // TODO: ajustar según el spritesheet real de ataque

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
        this.speed = 2.2;
        this.followDistance = 70;
        this.attackRange = 60;
        this.attackCooldown = 0;
        this.lives = 3;
        this.maxLives = 3;
        this.hits = 0;
        this.hitsPerLife = HITS_PER_LIFE;
        this.alive = true;
        this.invulnerable = false;
        this.invulnerableUntil = 0;
        this.direction = "down";
        this.radius = 20;

        this.frame = 0;
        this.frameTimer = 0;
        this.frameInterval = 8;
        this.walkFrameCount = 4;

        this.attackFrame = 0;
        this.attackFrameTimer = 0;
        this.attackFrameInterval = 4;
        this.attackFrameCount = 3;
    }

    onDeath() {}

    followGeto() {
        const dx = geto.x - this.x;
        const dy = geto.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > this.followDistance) {
            const stepX = (dx / dist) * this.speed;
            const stepY = (dy / dist) * this.speed;

            const resolved = resolveMoveWithCollisions(this.x, this.y, stepX, stepY, this.radius);
            this.x = resolved.x;
            this.y = resolved.y;

            const newDirection = Math.abs(dx) > Math.abs(dy)
                ? (dx < 0 ? "left" : "right")
                : (dy < 0 ? "up" : "down");
            if (newDirection !== this.direction) {
                this.direction = newDirection;
                this.frame = 0;
                this.frameTimer = 0;
            }
            updateAnimationFrame(this, this.walkFrameCount);
        } else {
            this.frame = 0;
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
            this.frame = 0;
            this.frameTimer = 0;
            return;
        }
        this.state = "follow";
        this.followGeto();
        this.attackNearestCurse();
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
        const sprite = this.getSprite();
        c.drawImage(sprite, screenX, screenY, this.size, this.size);
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

function resolveMoveWithCollisions(fromX, fromY, dx, dy, radius) {
    let newX = fromX;
    let newY = fromY;
    const tryX = fromX + dx;
    const blockedX =
        isTileSolidAtWorldPos(tryX + Math.sign(dx) * radius, fromY - radius + 2) ||
        isTileSolidAtWorldPos(tryX + Math.sign(dx) * radius, fromY + radius - 2);
    if (!blockedX || dx === 0) newX = tryX;
    const tryY = fromY + dy;
    const blockedY =
        isTileSolidAtWorldPos(newX - radius + 2, tryY + Math.sign(dy) * radius) ||
        isTileSolidAtWorldPos(newX + radius - 2, tryY + Math.sign(dy) * radius);
    if (!blockedY || dy === 0) newY = tryY;
    return { x: newX, y: newY };
}

class Curse {
    constructor(x, y, type, noteId) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.noteId = noteId;
        this.alive = true;
        this.state = "idle";
        this.direction = "left";
        this.speed = 1.3;
        this.radius = 14;
        // --- Preparado para animación por spritesheet (walk) ---
        this.frame = 0;
        this.frameTimer = 0;
        this.animationSpeed = 8;
        this.frameInterval = this.animationSpeed; // alias usado por updateAnimationFrame()
        this.walkFrameCount = 4; // TODO: ajustar según el spritesheet real del conejo
        this.attackCooldown = 0;
        this.damage = 1;
        // Radio de detección reducido (antes 220) para que los conejos
        // no "vean" a Geto/Gojo desde tan lejos.
        this.detectDistance = 170;
        this.attackDistance = 40;
        this.contactDistance = 26;
        this.lives = 1;
        this.maxLives = 1;
        this.hits = 0;
        this.hitsPerLife = HITS_PER_LIFE;
        this.deathTimer = 0;
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

        // Dirección dominante: elige entre las 4 imágenes disponibles
        // (arriba/abajo/izquierda/derecha) según el eje con mayor movimiento.
        this.direction = Math.abs(dx) > Math.abs(dy)
            ? (dx < 0 ? "left" : "right")
            : (dy < 0 ? "up" : "down");

        // Avanza el ciclo de caminata mientras persigue (spritesheet futuro).
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
        const sprite = this.getSprite();
        const screenX = mapX + this.x - 16;
        const screenY = mapY + this.y - 16;
        c.save();
        if (this.state === "dying") {
            c.globalAlpha = Math.max(0, 1 - this.deathTimer / 30);
        }
        c.drawImage(sprite, screenX, screenY, 32, 32);
        c.restore();
        if (this.state !== "dying") drawHealthBar(screenX, screenY - 8, 32, this);
    }
}

class Boss {
    constructor(x, y, letterId) {
        this.x = x;
        this.y = y;
        this.size = 96;
        this.letterId = letterId || "1";
        this.alive = true;
        this.state = "dormant";
        this.speed = 1.6;
        this.attackRange = 70;
        this.aggroRange = 260;
        this.attackCooldown = 0;
        this.damage = 1;
        this.deathTimer = 0;
        this.lives = 1;
        this.maxLives = 1;
        this.hits = 0;
        this.hitsPerLife = 5;
        this.retreatTimer = 0;

        // --- Preparado para animación por spritesheet (walk/attack) ---
        this.frame = 0;
        this.frameTimer = 0;
        this.frameInterval = 10;
        this.walkFrameCount = 4;   // TODO: ajustar según el spritesheet real

        this.attackFrame = 0;
        this.attackFrameTimer = 0;
        this.attackFrameInterval = 6;
        this.attackFrameCount = 3; // TODO: ajustar según el spritesheet real
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
    }

    moveToward(target) {
        const dx = target.x - this.x, dy = target.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
    }

    moveAway(target) {
        const dx = this.x - target.x, dy = this.y - target.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
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
        c.drawImage(bossImage, screenX, screenY, this.size, this.size);
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

const POPUP_WIDTH = 360;   // antes 320: caja más ancha
const POPUP_HEIGHT = 520;  // antes 480: caja más alta
const POPUP_X = (canvas.width - POPUP_WIDTH) / 2;
const POPUP_Y = (canvas.height - POPUP_HEIGHT) / 2;

const letterImage = new Image();
letterImage.src = "/assets/images/letter.png";

const NOTES = {
    "PN": { title: "Nota Principal", text: "Encuentra a Gojo y derrota las maldiciones para conseguir más notas y puntos, puedes conseguir puntos bonus si encuentras los corazones y también te regenarán 1/3 de vida a ti o a Gojo, el botón de estrella es para atacar, debes saltar sobre las maldiciones para derrotarlas, mucha suerte. Espero te guste y te diviertas precioso 😺🌷" },
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
    // "middle" ancla el glifo al centro vertical del Y indicado,
    // en vez de usar la línea base por defecto ("alphabetic").
    ctx.textBaseline = "middle";
    const centerX = x + maxWidth / 2;
    lines.forEach((line, i) => {
        // Centro matemático de la franja que ocupa esta línea concreta.
        const lineCenterY = y + i * lineHeight + lineHeight / 2;
        ctx.fillText(line, centerX, lineCenterY);
    });
    ctx.restore();
    return lines.length;
}

const DOC_MARGIN = 24;
const DOC_BODY_LINE_HEIGHT = 19; // antes 17: un poco más de aire entre líneas para la fuente 18px
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
// Reservamos una franja superior fija para la cabecera decorativa
    // de la imagen de la carta (letterImage), y centramos el texto
    // SOLO dentro del espacio restante — así una nota cortita no queda
    // pegada arriba, sino centrada de verdad en su espacio disponible.
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

    // Centro matemático real del rectángulo de texto disponible:
    // si el contenido CABE completo (bodyHeight <= textAreaHeight),
    // se centra verticalmente con "textAreaY + (espacio libre)/2".
    // Si NO cabe, se ancla arriba y se deja el scroll de siempre.
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

    // Texto del pie SIEMPRE centrado horizontal y verticalmente respecto al popup.
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

// El clic/toque en pantalla siempre puede cerrar una nota/carta abierta.
canvas.addEventListener('click', () => { if (activeDocument) closeDocument(); });
// (El cierre por teclado ahora se maneja de forma centralizada, solo
// con Enter/Space, en el listener grande definido más abajo — ver Cambio 2.C)

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

    // El título ocupa la franja superior del popup (de y=60 a y=130,
    // donde empieza el primer ítem). Su centro matemático es 60 + 70/2 = 95.
    const INVENTORY_HEADER_TOP = 60;
    const INVENTORY_HEADER_HEIGHT = 70;
    const headerCenterY = INVENTORY_HEADER_TOP + INVENTORY_HEADER_HEIGHT / 2;

    c.font = "10px 'Press Start 2P', sans-serif";
    c.fillText("Inventario (toca un ítem para volver a leerlo)", canvas.width / 2, headerCenterY);

    inventoryItemRects = [];
    let offsetY = 130;
    const itemWidth = canvas.width - 160;

    c.font = "14px 'Press Start 2P', sans-serif";

    // Nota: el rectángulo de clic (inventoryItemRects) sigue usando
    // "offsetY" tal cual, así el área táctil NO cambia. Solo el texto
    // se desplaza 5px hacia arriba (offsetY - 5) para quedar centrado
    // dentro de esa misma área de clic (que va de offsetY-16 a offsetY+6,
    // cuyo centro real es offsetY - 5).
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

    /**
 * Cura a Geto de forma consistente con el sistema de hits/lives:
 * - Si la vida actual tiene daño acumulado (hits > 0), primero se
 *   rellena esa vida parcial.
 * - Si la vida actual ya está completa (hits === 0) pero falta un
 *   corazón entero (lives < maxLives), se restaura esa vida completa,
 *   topando siempre en maxLives (nunca se sobrepasa).
 */
function healGeto(amount = 1) {
    if (geto.hits > 0) {
        geto.hits = Math.max(0, geto.hits - amount);
    } else if (geto.lives < geto.maxLives) {
        geto.lives = Math.min(geto.lives + 1, geto.maxLives);
    }
}

  for (const heart of hearts) {
    if (heart.collected) continue;
    if (Math.hypot(geto.x - heart.x, geto.y - heart.y) < PICKUP_DISTANCE) {
        heart.collected = true;
        score += 5;
        const getoFullLife = geto.hits === 0 && geto.lives === geto.maxLives;
        if (getoFullLife && gojo.active) {
            gojo.heal(1);
        } else {
            healGeto(1); // reemplaza la línea "geto.hits = Math.max(0, geto.hits - 1)"
        }
    }
}
}

let dialogueVisible = false;

/** true mientras haya un documento abierto, el diálogo de Gojo visible,
 *  o el juego esté en pausa: en ese estado ningún input de movimiento
 *  (ni de teclado ni táctil) debe surtir efecto. */
function isInputLocked() {
    return activeDocument !== null || dialogueVisible || paused;
}

// Radio de activación del primer encuentro con Gojo: hasta que Geto no
// entre en este radio, Gojo permanece 100% estático y el diálogo no se
// dispara solo. Es un radio cómodo (ni muy ajustado ni muy amplio).
const GOJO_ENCOUNTER_RADIUS = 90;

function checkGojoEncounter() {
    if (metGojo || currentMap !== 1) return;
    const dist = Math.hypot(geto.x - gojo.x, geto.y - gojo.y);
    if (dist < GOJO_ENCOUNTER_RADIUS) {
        metGojo = true;
        dialogueVisible = true;
    }
}

/** Cierra el diálogo de encuentro y, solo entonces, habilita la IA de
 *  Gojo (seguir a Geto y atacar conejos). Antes de esto Gojo nunca se mueve. */
function closeGojoDialogue() {
    if (!dialogueVisible) return;
    dialogueVisible = false;
    gojo.followingEnabled = true;
}

function drawDialogue() {
    if (!dialogueVisible) return;
    const boxX = 40, boxY = canvas.height - 140, boxW = canvas.width - 80, boxH = 100;
    const boxCenterX = boxX + boxW / 2;

    // Dos renglones dentro de la caja (boxH = 100): el primero centrado
    // al 35% de la altura, el segundo al 72%. Son los "centros
    // matemáticos" de cada franja de texto dentro del cuadro de diálogo.
    const line1Y = boxY + boxH * 0.35;
    const line2Y = boxY + boxH * 0.72;

    c.fillStyle = "rgba(0,0,0,0.8)";
    c.fillRect(boxX, boxY, boxW, boxH);
    c.strokeStyle = "white";
    c.strokeRect(boxX, boxY, boxW, boxH);

    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "white";
    c.font = "14px 'Press Start 2P', sans-serif";
    c.fillText("Gojo: \"Debemos derrotar a las maldiciones y escapar de aquí.\"", boxCenterX, line1Y);
    c.font = "10px 'Press Start 2P', sans-serif";
    c.fillText("(Enter o toca la pantalla para continuar)", boxCenterX, line2Y);
    c.restore();
}

// El clic/toque en pantalla siempre puede cerrar el diálogo de encuentro.
canvas.addEventListener('click', () => { if (dialogueVisible && !activeDocument) closeGojoDialogue(); });
// (El cierre por teclado ahora se maneja solo con Enter/Space en el
// listener centralizado — ver Cambio 2.C)


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

function drawEndingScene() {
    c.drawImage(currentMapImage, 0, 0, canvas.width, canvas.height);
    c.drawImage(cakeImage, canvas.width / 2 - 40, canvas.height / 2 - 20, 80, 80);
    c.drawImage(danceGetoImage, canvas.width / 2 - 160, canvas.height / 2 - 60, 80, 120);
    c.drawImage(danceGojoImage, canvas.width / 2 + 80, canvas.height / 2 - 60, 80, 120);
    c.drawImage(danceAuthorImage, canvas.width / 2 - 40, canvas.height / 2 - 140, 80, 120);
    drawRestartButton("¡Felicidades! Toca para volver a empezar");
}

function restartGame() {
    geto.lives = geto.maxLives;
    geto.hits = 0;
    geto.alive = true;
    geto.invulnerable = false;

    gojo.lives = gojo.maxLives;
    gojo.hits = 0;
    gojo.alive = true;
    gojo.active = true;
    gojo.followingEnabled = false;
    gojo.direction = "down";
    gojo.frame = 0;
    gojo.frameTimer = 0;

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
    const btnX = canvas.width / 2 - 120, btnY = canvas.height - 80, btnW = 440, btnH = 50;
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
        // getCanvasCoords() traduce el clic desde píxeles de PANTALLA
        // a píxeles INTERNOS del canvas (ver helper agregado arriba).
        const { x: clickX, y: clickY } = getCanvasCoords(e);
        if (clickX > btnX && clickX < btnX + btnW && clickY > btnY && clickY < btnY + btnH) {
            restartGame();
            canvas.onclick = null;
        }
    };
}

// Zona reservada para el HUD de vidas (usada para centrar el grupo de corazones)
const HUD_HEARTS_ZONE_X = 20;
const HUD_HEARTS_ZONE_Y = 16;
const HUD_HEART_SIZE = 28;
const HUD_HEART_GAP = 6;

function drawHUD() {
    c.save();
    let heartDrawX = HUD_HEARTS_ZONE_X;
    const heartDrawY = HUD_HEARTS_ZONE_Y;
    const hasImage = heartImage.complete && heartImage.naturalWidth > 0;

    for (let i = 0; i < geto.maxLives; i++) {
        // Fracción de relleno de ESTE corazón: 1 = intacto, 0 = perdido,
        // valores intermedios (2/3, 1/3) solo aplican a la vida ACTUAL
        // (índice geto.lives - 1), que es la que absorbe geto.hits.
        let fraction;
        if (i < geto.lives - 1) {
            fraction = 1;
        } else if (i === geto.lives - 1) {
            fraction = Math.max(0, 1 - geto.hits / geto.hitsPerLife);
        } else {
            fraction = 0;
        }

        // Silueta tenue de fondo (corazón "vacío"), siempre visible.
        c.globalAlpha = 0.25;
        if (hasImage) {
            c.drawImage(heartImage, heartDrawX, heartDrawY, HUD_HEART_SIZE, HUD_HEART_SIZE);
        } else {
            c.fillStyle = "#555";
            c.fillRect(heartDrawX, heartDrawY, HUD_HEART_SIZE, HUD_HEART_SIZE);
        }

        // Relleno recortado según la fracción (tercios) de vida restante.
        if (fraction > 0) {
            c.save();
            c.globalAlpha = 1;
            c.beginPath();
            c.rect(heartDrawX, heartDrawY, HUD_HEART_SIZE * fraction, HUD_HEART_SIZE);
            c.clip();
            if (hasImage) {
                c.drawImage(heartImage, heartDrawX, heartDrawY, HUD_HEART_SIZE, HUD_HEART_SIZE);
            } else {
                c.fillStyle = "#e53935";
                c.fillRect(heartDrawX, heartDrawY, HUD_HEART_SIZE, HUD_HEART_SIZE);
            }
            c.restore();
        }

        heartDrawX += HUD_HEART_SIZE + HUD_HEART_GAP;
    }
    c.restore();

    c.fillStyle = "white";
    c.font = "12px 'Press Start 2P', sans-serif";
    c.fillText(`Puntos: ${score}`, canvas.width - 150, 35);
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
                // Esta marca de spawn (definida en el mapa 1) solo debe
                // usarse mientras Gojo TODAVÍA no se ha unido a Geto.
                // Una vez que es "Seguidor" (followingEnabled = true),
                // su posición pasa a gestionarse en la transición de
                // mapas (ver Cambio 3.B), para que no "teletransporte"
                // de vuelta a su punto de aparición original.
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

    for (const curse of curses) {
        if (!curse.alive) continue;
        const dist = Math.hypot(curse.x - geto.x, curse.y - geto.y);
        if (dist < geto.attackRange) applyDamage(curse, 1);
    }

    if (boss && boss.alive) {
        const dist = Math.hypot(boss.x - geto.x, boss.y - geto.y);
        if (dist < geto.attackRange) applyDamage(boss, 1);
    }
}


// =====================================================================
// TECLADO (PC): flujo centralizado de Enter/Space. Se procesa en ESTE
// ORDEN de prioridad para que un mismo "Space" nunca cierre una nota
// Y ataque al mismo tiempo:
//   1) Nota/carta abierta        -> Enter/Space la cierran, y se corta
//                                    la ejecución (return) antes de llegar
//                                    a la lógica de ataque.
//   2) Diálogo de Gojo visible   -> Enter/Space lo cierran.
//   3) Game Over                 -> Space reinicia la partida.
//   4) Juego normal               -> Space ataca, "I" abre inventario,
//                                    Enter pausa/despausa.
// =====================================================================
window.addEventListener('keydown', (event) => {
    // Space fue eliminado por completo como tecla de cierre:
    // SOLO Enter cierra notas/cartas/diálogos (el clic/toque sigue
    // funcionando aparte, vía los listeners de 'click' en canvas).
    const isCloseKey = event.key === 'Enter';

    if (activeDocument) {
        if (isCloseKey) closeDocument();
        return;
    }

if (dialogueVisible) {
        if (isCloseKey) closeGojoDialogue();
        return;
    }

    // Geto perdió todas sus vidas: Enter reinicia la partida
    // (equivalente a tocar el botón de reinicio en pantalla).
    if (gameOver) {
        if (event.key === 'Enter') restartGame();
        return;
    }

    // 4) Flujo normal del juego.
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

function start() {
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

  // isInputLocked() ya cubre: nota/carta abierta (activeDocument),
    // diálogo de Gojo (dialogueVisible) y pausa (paused). gameOver no
    // hace falta acá porque start() ya corta con un "return" antes de
    // llegar a este punto cuando gameOver es true.
    const uiBlocked = isInputLocked();

    // Mientras se lee una nota/documento, se está en el diálogo de
    // encuentro con Gojo, o el juego está en pausa, Geto queda
    // completamente congelado: no se procesa ningún movimiento aunque
    // las teclas/botones sigan "presionados".

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

    // --- Preparación de estado/animación de Geto (spritesheet futuro) ---
    // No cambia el dibujado actual (sigue usando currentImage estático),
    // pero deja listo el estado y el avance de frame para cuando existan
    // las hojas de caminar de Geto.
    const getoIsMoving = !uiBlocked && (movingUp || movingDown || movingLeft || movingRight);
    geto.state = geto.attacking ? "attack" : (getoIsMoving ? "walk" : "idle");
    if (getoIsMoving) {
        updateAnimationFrame(geto, geto.walkFrameCount);
    } else {
        geto.frame = 0;
        geto.frameTimer = 0;
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
        // Si Gojo ya es "Seguidor", viaja CON Geto: se reposiciona justo
        // al lado del punto de entrada recién calculado en Map2, para
        // que ambos aparezcan juntos de forma coherente.
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
        // Mismo criterio al volver al Mapa 1.
        if (gojo.active && gojo.followingEnabled) {
            const arrivalCenterX = -mapX + x + playerSize / 2;
            const arrivalCenterY = -mapY + y + playerSize / 2;
            gojo.x = arrivalCenterX + 40;
            gojo.y = arrivalCenterY + 20;
        }
    }

    // Detecta la transición "invulnerable -> ya no invulnerable" (fin del
    // parpadeo tras recibir daño y revivir esa vida) para forzar el sprite
    // de Geto de vuelta a "mirando hacia abajo", tal como pide el diseño.
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

    c.clearRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    c.drawImage(currentMapImage, mapX, mapY, currentMapImage.width * mapScale, currentMapImage.height * mapScale);

    if (isBlinkVisible(geto)) {
        c.drawImage(currentImage, x, y, playerSize, playerSize);
    }
    drawHealthBar(x, y - 10, playerSize, geto);

    for (const heart of hearts) {
        if (heart.collected) continue;
        c.drawImage(heartImage, mapX + heart.x - 12, mapY + heart.y - 12, 24, 24);
    }

    for (const note of groundNotes) {
        if (note.collected) continue;
        c.drawImage(noteImage, mapX + note.x - 12, mapY + note.y - 12, 24, 24);
    }

    if (groundLetter && !groundLetter.collected) {
        // La Letter que suelta el Boss usa su PROPIA imagen (bossLetter.png,
        // cargada en la variable `letter`), distinta del sprite genérico
        // de notas, para que se distinga claramente en el suelo.
        c.drawImage(letter, mapX + groundLetter.x - 14, mapY + groundLetter.y - 14, 28, 28);
    }

    if (PN && !PN.collected) {
        c.drawImage(noteImage, mapX + PN.x - 12, mapY + PN.y - 12, 24, 24);
    }

    for (const curse of curses) curse.draw(mapX, mapY);

    gojo.draw(mapX, mapY);
    if (boss) boss.draw(mapX, mapY);

    // El topImage (capa superior del mapa, ej. copas de árboles) se dibuja
    // AL FINAL, por encima de Geto, Gojo, conejos, boss, notas y corazones,
    // para que de verdad cubra todo lo que hay debajo cuando corresponda.
    if (currentMap === 1) {
        c.drawImage(topImage, mapX, mapY, topImage.width * mapScale, topImage.height * mapScale);
    } else {
        c.drawImage(topImage2, mapX, mapY, topImage2.width * mapScale, topImage2.height * mapScale);
    }

    drawHUD();
    drawDialogue();
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
    button.addEventListener('pointercancel', () => setMoving(false)); // cubre el caso de que el dedo salga del botón sin soltar
}

bindDirectionButton(rightButton, getoRightImage, v => movingRight = v);
bindDirectionButton(leftButton, getoLeftImage, v => movingLeft = v);
bindDirectionButton(upButton, getoUpImage, v => movingUp = v);
bindDirectionButton(downButton, getoDownImage, v => movingDown = v);
const directionKeyStack = [];

// Se agregan las flechas de teclado (ArrowUp/Down/Left/Right) como
// equivalentes de WASD para el movimiento en PC.
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

image.src = '/assets/images/Map1.png';
image2.src = '/assets/images/Map2.png';
image3.src = '/assets/images/Map3.png';
topImage.src = '/assets/images/Map1CapaSup.png';
topImage2.src = '/assets/images/Map2CapaSup.png';
getoUpImage.src = '/assets/images/backGeto.png';
getoDownImage.src = '/assets/images/frontGeto.png';
getoRightImage.src = '/assets/images/rightGeto.png';
getoLeftImage.src = '/assets/images/leftGeto.png';
gojoUpImage.src = '/assets/images/backGojo.png';
gojoDownImage.src = '/assets/images/frontGojo.png';
gojoLeftImage.src = '/assets/images/leftGojo.png';
gojoRightImage.src = '/assets/images/rightGojo.png';
blackRabbitUpImage.src = '/assets/images/rabbitBack.png';
blackRabbitDownImage.src = '/assets/images/rabbitFront.png';
blackRabbitLeftImage.src = '/assets/images/rabbitLeft.png';
blackRabbitRightImage.src = '/assets/images/rabbiRight.png';
whiteRabbitUpImage.src = '/assets/images/WRabbitBack.png';
whiteRabbitDownImage.src = '/assets/images/WRabbitFront.png';
whiteRabbitLeftImage.src = '/assets/images/WRabbitLeft.png';
whiteRabbitRightImage.src = '/assets/images/WRabbitRight.png';
heartImage.src = "/assets/images/heart.png";
noteImage.src = "/assets/images/note.png";
letter.src = "/assets/images/bossLetter.png";
bossImage.src = "/assets/images/bossFront.png";
danceGetoImage.src = "/assets/images/danceGeto.png";
danceGojoImage.src = "/assets/images/danceGojo.png";
danceAuthorImage.src = "/assets/images/meDance.png";
cakeImage.src = "/assets/images/cake.png";