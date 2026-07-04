const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

canvas.width = 1024;
canvas.height = 576;

c.imageSmoothingEnabled = false;

const upButton = document.getElementById('up');
const downButton = document.getElementById('down');
const leftButton = document.getElementById('left');
const rightButton = document.getElementById('right');

const image = new Image();
const image2 = new Image(); // Mapa 2
const getoUpImage = new Image();
const getoDownImage = new Image();
const getoLeftImage = new Image();
const getoRightImage = new Image();

// --- Sistema de cambio de mapa ---
let currentMap = 1;
let currentMapImage = image;
let currentCollisionsMap; 
// Casilla de activación (trigger tile) para pasar del Mapa 1 al Mapa 2
const MAP1_TO_MAP2_TRIGGER_ROW = 0;
const MAP1_TO_MAP2_TRIGGER_COLUMN = 14;

const MAP2_TO_MAP1_TRIGGER_ROW = 29;
const MAP2_TO_MAP1_TRIGGER_COLUMN = 14;

// Punto de entrada al Mapa 2: se define como Fila/Columna y se calcula
// automáticamente en píxeles más abajo (una vez que mapScale y playerSize existen).
const MAP2_ENTRY_ROW = 28;
const MAP2_ENTRY_COLUMN = 14;
const MAP1_ENTRY_ROW = 1;
const MAP1_ENTRY_COLUMN = 14;
let MAP2_ENTRY_X; // se calcula abajo
let MAP2_ENTRY_Y; // se calcula abajo
let MAP1_ENTRY_X; // se calcula abajo
let MAP1_ENTRY_Y; // se calcula abajo

let movingUp = false;
let movingDown = false;
let movingRight = false;
let movingLeft = false;

let currentImage = getoDownImage

let loaded = 0;

const mapScale = 4;
const playerSize = 64;
let mapX = -480;
let mapY = -440;

// --- Cálculo automático de los puntos de entrada al Mapa 2 y al Mapa 1 ---
// tileSize: mismo cálculo que se usa dentro de start() (16 * mapScale)
// x, y: posición fija del jugador en pantalla, igual que dentro de start()
{
    const tileSizeForEntry = 16 * mapScale;
    const playerScreenX = canvas.width / 2 - playerSize / 2;
    const playerScreenY = canvas.height / 2 - playerSize / 2;

    // Centro de la celda (fila, columna) objetivo en el Mapa 2, en coordenadas del mundo/mapa
    const map2TargetCenterX = MAP2_ENTRY_COLUMN * tileSizeForEntry + tileSizeForEntry / 2;
    const map2TargetCenterY = MAP2_ENTRY_ROW * tileSizeForEntry + tileSizeForEntry / 2;

    // Despejamos mapX/mapY de: centerX = -mapX + x + playerSize/2
    MAP2_ENTRY_X = playerScreenX + playerSize / 2 - map2TargetCenterX;
    MAP2_ENTRY_Y = playerScreenY + playerSize / 2 - map2TargetCenterY;

    // Centro de la celda (fila, columna) objetivo en el Mapa 1, en coordenadas del mundo/mapa
    const map1TargetCenterX = MAP1_ENTRY_COLUMN * tileSizeForEntry + tileSizeForEntry / 2;
    const map1TargetCenterY = MAP1_ENTRY_ROW * tileSizeForEntry + tileSizeForEntry / 2;

    // Despejamos mapX/mapY de: centerX = -mapX + x + playerSize/2
    MAP1_ENTRY_X = playerScreenX + playerSize / 2 - map1TargetCenterX;
    MAP1_ENTRY_Y = playerScreenY + playerSize / 2 - map1TargetCenterY;
}


const collisionsMap = [];
const collisionsMap2 = []; // Mapa 2

const mapWidth = 40;
const mapWidth2 = 40; // TODO: ajustar si el Mapa 2 tiene un ancho de cuadrícula distinto

for (
    let i = 0;
    i < collisions.length;
    i += mapWidth
) {
    collisionsMap.push(
        collisions.slice(i, i + mapWidth)
    );
}

for (
    let i = 0;
    i < collisions2.length;
    i += mapWidth2
) {
    collisionsMap2.push(
        collisions2.slice(i, i + mapWidth2)
    );
}

currentCollisionsMap = collisionsMap;

function start() {

    const x = canvas.width / 2 - playerSize / 2;
    const y = canvas.height / 2 - playerSize / 2;

    const centerX = -mapX + x + playerSize / 2;
    const centerY = -mapY + y + playerSize / 2;

const tileSize = 16 * mapScale;

const row = Math.floor(centerY / tileSize);
const column = Math.floor(centerX / tileSize);

const hitbox = 20;

// Arriba
const rowUp = Math.floor((centerY - playerSize / 2 + hitbox) / tileSize);

// Abajo
const rowDown = Math.floor((centerY + playerSize / 2 - hitbox + 8) / tileSize);

// Izquierda
const columnLeft = Math.floor((centerX - playerSize / 2 + hitbox) / tileSize);

// Derecha
const columnRight = Math.floor((centerX + playerSize / 2 - hitbox) / tileSize);

console.log("Fila:", row, "Columna:", column);

     if (
    movingUp &&
    currentCollisionsMap[rowUp]?.[column] !== 84
    ) {
    mapY += 2;
    }

      if (
    movingDown &&
    currentCollisionsMap[rowDown][column] !== 84
    ) {
    mapY = mapY - 2;
    }

     if (
    movingRight &&
    currentCollisionsMap[row][columnRight] !== 84
    ) {
    mapX = mapX - 2;
    }
    
      if (
    movingLeft &&
    currentCollisionsMap[row][columnLeft] !== 84
    ) {
    mapX = mapX + 2;
    }

    // --- Comprobación de casilla de activación (trigger tile) ---
    // Recalculamos fila/columna del jugador dividiendo sus coordenadas
    // actualizadas (tras aplicar el movimiento de este frame) entre el tamaño del tile.
    const playerCenterX = -mapX + x + playerSize / 2;
    const playerCenterY = -mapY + y + playerSize / 2;
    const playerRow = Math.floor(playerCenterY / tileSize);
    const playerColumn = Math.floor(playerCenterX / tileSize);

    if (
        currentMap === 1 &&
        playerRow === MAP1_TO_MAP2_TRIGGER_ROW &&
        playerColumn === MAP1_TO_MAP2_TRIGGER_COLUMN
    ) {
        currentMap = 2;
        currentMapImage = image2;
        currentCollisionsMap = collisionsMap2;
        mapX = MAP2_ENTRY_X;
        mapY = MAP2_ENTRY_Y;
    }

     if (
        currentMap === 2 &&
        playerRow === MAP2_TO_MAP1_TRIGGER_ROW &&
        playerColumn === MAP2_TO_MAP1_TRIGGER_COLUMN
    ) {
        currentMap = 1;
        currentMapImage = image;
        currentCollisionsMap = collisionsMap;
        mapX = MAP1_ENTRY_X;
        mapY = MAP1_ENTRY_Y;
    }
    c.clearRect(0, 0, canvas.width, canvas.height);

    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    c.drawImage(
    currentMapImage,
    mapX,
    mapY,
    currentMapImage.width * mapScale,
    currentMapImage.height * mapScale
    );

    c.strokeRect(x, y, playerSize, playerSize);

    c.drawImage(currentImage, x, y, playerSize, playerSize);

    requestAnimationFrame(start);
}


function check() {
    loaded++;
    if (loaded === 6) start();
}

rightButton.addEventListener(
    'touchstart',
    () => {
        currentImage = getoRightImage;
        movingRight = true;
        console.log (movingRight)
    }
);

rightButton.addEventListener(
    'touchend',
    () => {
        movingRight = false;
        console.log (movingRight)
    }
);

leftButton.addEventListener(
    'touchstart',
    () => {
        currentImage = getoLeftImage;
        movingLeft = true;
        console.log(movingLeft)
    }
);

leftButton.addEventListener(
    'touchend',
    () => {
        movingLeft = false;
        console.log (movingLeft)
    }
);

upButton.addEventListener(
    'touchstart',
    () => {
        currentImage = getoUpImage;
        movingUp = true;
        console.log(movingUp)
    }
);

upButton.addEventListener(
    'touchend',
    () => {
        movingUp = false;
        console.log (movingUp)
    }
);

downButton.addEventListener(
    'touchstart',
    () => {
        currentImage = getoDownImage;
        movingDown = true;
        console.log(movingDown)
    }
);

downButton.addEventListener(
    'touchend',
    () => {
        movingDown = false;
        console.log (movingDown)
    }
);

const directionKeyStack = [];

function keyToDirection(key) {
    switch (key) {
        case 'd':
        case 'D':
            return 'right';
        case 'a':
        case 'A':
            return 'left';
        case 'w':
        case 'W':
            return 'up';
        case 's':
        case 'S':
            return 'down';
        default:
            return null;
    }
}

function updateCurrentImageFromStack() {
    const activeDirection = directionKeyStack[directionKeyStack.length - 1];

    switch (activeDirection) {
        case 'right':
            currentImage = getoRightImage;
            break;
        case 'left':
            currentImage = getoLeftImage;
            break;
        case 'up':
            currentImage = getoUpImage;
            break;
        case 'down':
            currentImage = getoDownImage;
            break;
    }
}

window.addEventListener(
    'keydown',
    (event) => {
        const direction = keyToDirection(event.key);
        if (!direction) return;

        switch (direction) {
            case 'right':
                movingRight = true;
                console.log(movingRight);
                break;
            case 'left':
                movingLeft = true;
                console.log(movingLeft);
                break;
            case 'up':
                movingUp = true;
                console.log(movingUp);
                break;
            case 'down':
                movingDown = true;
                console.log(movingDown);
                break;
        }

        if (!directionKeyStack.includes(direction)) {
            directionKeyStack.push(direction);
        }

        updateCurrentImageFromStack();
    }
);

window.addEventListener(
    'keyup',
    (event) => {
        const direction = keyToDirection(event.key);
        if (!direction) return;

        switch (direction) {
            case 'right':
                movingRight = false;
                console.log(movingRight);
                break;
            case 'left':
                movingLeft = false;
                console.log(movingLeft);
                break;
            case 'up':
                movingUp = false;
                console.log(movingUp);
                break;
            case 'down':
                movingDown = false;
                console.log(movingDown);
                break;
        }

        const index = directionKeyStack.indexOf(direction);
        if (index !== -1) {
            directionKeyStack.splice(index, 1);
        }

        updateCurrentImageFromStack();
    }
);

image.onload = check;
image2.onload = check;
getoDownImage.onload = check;
getoUpImage.onload = check;
getoRightImage.onload = check;
getoLeftImage.onload = check;

image.src = '/assets/images/Map1.png';
image2.src = '/assets/images/Map2.png';
getoUpImage.src = '/assets/images/backGeto.png';
getoDownImage.src = '/assets/images/frontGeto.png';
getoRightImage.src = '/assets/images/rightGeto.png';
getoLeftImage.src = '/assets/images/leftGeto.png';