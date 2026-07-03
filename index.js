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
const getoUpImage = new Image();
const getoDownImage = new Image();
const getoLeftImage = new Image();
const getoRightImage = new Image();

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

const collisionsMap = [];

const mapWidth = 40;

for (
    let i = 0;
    i < collisions.length;
    i += mapWidth
) {
    collisionsMap.push(
        collisions.slice(i, i + mapWidth)
    );
}

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
const rowUp = Math.floor((centerY - playerSize / 2 + hitbox + 10) / tileSize);

// Abajo
const rowDown = Math.floor((centerY + playerSize / 2 - hitbox + 8) / tileSize);

// Izquierda
const columnLeft = Math.floor((centerX - playerSize / 2 + hitbox) / tileSize);

// Derecha
const columnRight = Math.floor((centerX + playerSize / 2 - hitbox) / tileSize);

console.log("Fila:", row, "Columna:", column);

     if (
    movingUp &&
    collisionsMap[rowUp]?.[column] !== 84
    ) {
    mapY += 2;
    }

      if (
    movingDown &&
    collisionsMap[rowDown][column] !== 84
    ) {
    mapY = mapY - 2;
    }

     if (
    movingRight &&
    collisionsMap[row][columnRight] !== 84
    ) {
    mapX = mapX - 2;
    }
    
      if (
    movingLeft &&
    collisionsMap[row][columnLeft] !== 84
    ) {
    mapX = mapX + 2;
    }

    c.clearRect(0, 0, canvas.width, canvas.height);

    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    c.drawImage(
    image,
    mapX,
    mapY,
    image.width * mapScale,
    image.height * mapScale
    );

    c.strokeRect(x, y, playerSize, playerSize);

    c.drawImage(currentImage, x, y, playerSize, playerSize);

    requestAnimationFrame(start);
}


function check() {
    loaded++;
    if (loaded === 5) start();
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
getoDownImage.onload = check;
getoUpImage.onload = check;
getoRightImage.onload = check;
getoLeftImage.onload = check;

image.src = '/assets/images/Map1.png';
getoUpImage.src = '/assets/images/backGeto.png';
getoDownImage.src = '/assets/images/frontGeto.png';
getoRightImage.src = '/assets/images/rightGeto.png';
getoLeftImage.src = '/assets/images/leftGeto.png';