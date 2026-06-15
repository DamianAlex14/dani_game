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

let currentImage = getoUpImage

let loaded = 0;

const spriteSize = 32;
const scale = 3;
const playerSize = spriteSize * scale;
let mapX = -215
let mapY = -950

const collisionsMap = [];

for (
    let i = 0;
    i < collisions.length;
    i = i + 15
) {
    collisionsMap.push(
        collisions.slice(i, i + 15)
    );
}

function start() {

    const x = canvas.width / 2 - playerSize / 2;
    const y = canvas.height / 2 - playerSize / 2;

    const worldX = -mapX + x;
    const worldY = -mapY + y;

    const column = Math.floor(worldX / 96);
    const row = Math.floor(worldY / 96);

    if (movingUp) {
        mapY = mapY + 2;
    }

    if (movingDown) {
        mapY = mapY - 2;
    }

     if (
    movingRight &&
    collisionsMap[row][column + 0] !== 84
    ) {
    mapX = mapX - 2;
    }
    

    if (movingLeft) {
        mapX = mapX + 2;
    }

    c.clearRect(0, 0, canvas.width, canvas.height);

    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    c.drawImage(image, mapX, mapY);

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
        mapX = mapX - 2;
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
        mapX = mapX + 2;
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
        mapY = mapY + 2;
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
        mapY = mapY - 2; 
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




image.onload = check;
getoDownImage.onload = check;
getoUpImage.onload = check;
getoRightImage.onload = check;
getoLeftImage.onload = check;

image.src = '/assets/images/TestMap.png';
getoUpImage.src = '/assets/images/backGeto.png';
getoDownImage.src = '/assets/images/frontGeto.png';
getoRightImage.src = '/assets/images/rightGeto.png';
getoLeftImage.src = '/assets/images/leftGeto.png';