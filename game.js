const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalMessage = document.getElementById('final-message');
const finalScoreValue = document.getElementById('final-score-value');
const canvasWrapper = document.querySelector('.canvas-wrapper');

const GRID_SIZE = 20;
const TILE_COUNT = canvas.width / GRID_SIZE;

// Colors matching CSS variables for drawing
const COLOR_SNAKE = '#00ffcc';
const COLOR_FOOD = '#ff3366';
const COLOR_POISON = '#b366ff';
const COLOR_PORTAL = '#33ccff';
const COLOR_WALL = 'rgba(255, 255, 255, 0.4)';

let snake = [];
let dx = 0;
let dy = 0;
let nextDx = 0;
let nextDy = 0;
let food = { x: 0, y: 0, type: 'standard' };
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
highScoreElement.textContent = highScore;

let gameLoop;
let isGameOver = false;
let gameSpeed = 120;
let lastRenderTime = 0;
let controlsReversed = false;
let reverseTimer = null;

// Unexpected hurdles state
let hurdles = {
    walls: [], // {x, y}
    portals: [], // [{x,y}, {x,y}] pair
};
let frameCount = 0;

function resetGame() {
    snake = [
        { x: Math.floor(TILE_COUNT / 2), y: Math.floor(TILE_COUNT / 2) }
    ];
    dx = 0;
    dy = 0;
    nextDx = 0;
    nextDy = 0;
    score = 0;
    gameSpeed = 120;
    scoreElement.textContent = score;
    isGameOver = false;
    controlsReversed = false;
    document.body.style.filter = 'none';
    canvasWrapper.style.boxShadow = '0 0 40px rgba(0,0,0,0.5)';
    hurdles = { walls: [], portals: [] };
    if (reverseTimer) clearTimeout(reverseTimer);
    spawnFood();
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    window.requestAnimationFrame(main);
}

function gameOver(reason) {
    isGameOver = true;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreElement.textContent = highScore;
    }
    finalMessage.textContent = reason;
    finalScoreValue.textContent = score;
    gameOverScreen.classList.add('active');
}

function checkCollision(head) {
    // Walls collision (boundaries)
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        return "You hit the edge!";
    }
    
    // Self collision
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return "You bit yourself!";
        }
    }

    // Dynamic walls collision
    for (const wall of hurdles.walls) {
        if (head.x === wall.x && head.y === wall.y) {
            return "You crashed into a mysterious wall!";
        }
    }

    return null;
}

function getRandomEmptyPosition() {
    let newPos;
    let attempts = 0;
    while (attempts < 100) {
        newPos = {
            x: Math.floor(Math.random() * TILE_COUNT),
            y: Math.floor(Math.random() * TILE_COUNT)
        };
        // Check snake
        let isValid = !snake.some(segment => segment.x === newPos.x && segment.y === newPos.y);
        // Check walls
        if (isValid) {
            isValid = !hurdles.walls.some(wall => wall.x === newPos.x && wall.y === newPos.y);
        }
        // Check portals
        if (isValid) {
            isValid = !hurdles.portals.some(p => p.x === newPos.x && p.y === newPos.y);
        }
        if (isValid) return newPos;
        attempts++;
    }
    return newPos; // fallback
}

function spawnFood() {
    const pos = getRandomEmptyPosition();
    food.x = pos.x;
    food.y = pos.y;
    
    // 25% chance for poison apple if score > 30
    if (Math.random() < 0.25 && score > 30) {
        food.type = 'poison';
    } else {
        food.type = 'standard';
    }
}

function spawnWall() {
    if (hurdles.walls.length < 8) {
        hurdles.walls.push(getRandomEmptyPosition());
    }
}

function spawnPortals() {
    hurdles.portals = [getRandomEmptyPosition(), getRandomEmptyPosition()];
}

function applyPoisonEffect() {
    // Randomly choose an effect: reverse controls or speed up
    if (Math.random() < 0.5) {
        controlsReversed = true;
        document.body.style.filter = 'hue-rotate(180deg) invert(0.8)'; // Visual cue
        if (reverseTimer) clearTimeout(reverseTimer);
        reverseTimer = setTimeout(() => {
            controlsReversed = false;
            document.body.style.filter = 'none';
        }, 5000); // 5 seconds of reversed controls
    } else {
        const oldSpeed = gameSpeed;
        gameSpeed = 50; // Much faster
        canvasWrapper.style.boxShadow = '0 0 50px #ff3366'; // Visual cue
        if (reverseTimer) clearTimeout(reverseTimer);
        reverseTimer = setTimeout(() => {
            gameSpeed = Math.max(60, 120 - Math.floor(score / 50) * 10);
            canvasWrapper.style.boxShadow = '0 0 40px rgba(0,0,0,0.5)';
        }, 5000);
    }
}

function handlePortals(head) {
    if (hurdles.portals.length === 2) {
        if (head.x === hurdles.portals[0].x && head.y === hurdles.portals[0].y) {
            return { x: hurdles.portals[1].x, y: hurdles.portals[1].y };
        } else if (head.x === hurdles.portals[1].x && head.y === hurdles.portals[1].y) {
            return { x: hurdles.portals[0].x, y: hurdles.portals[0].y };
        }
    }
    return null;
}

function update() {
    dx = nextDx;
    dy = nextDy;

    if (dx === 0 && dy === 0) return; // Not moving yet

    frameCount++;

    // Dynamic events
    if (frameCount % 100 === 0 && score > 50) {
        if (Math.random() < 0.4) spawnWall();
    }
    if (frameCount % 300 === 0 && score > 80) {
        if (Math.random() < 0.6) spawnPortals();
        else hurdles.portals = []; // remove portals
    }

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Handle portals BEFORE collision check
    const teleportedHead = handlePortals(head);
    let finalHead = teleportedHead || head;

    const collisionReason = checkCollision(finalHead);
    if (collisionReason) {
        gameOver(collisionReason);
        return;
    }

    snake.unshift(finalHead);

    if (finalHead.x === food.x && finalHead.y === food.y) {
        if (food.type === 'standard') {
            score += 10;
        } else if (food.type === 'poison') {
            score += 20;
            applyPoisonEffect();
        }
        scoreElement.textContent = score;
        
        // Slightly increase speed
        if (gameSpeed > 60) {
            gameSpeed = Math.max(60, 120 - Math.floor(score / 50) * 10);
        }
        
        spawnFood();
    } else {
        snake.pop();
    }
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for(let i=0; i<=TILE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }
}

function drawRect(x, y, color, glow = false) {
    ctx.fillStyle = color;
    if (glow) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
    } else {
        ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    ctx.roundRect(x * GRID_SIZE + 1, y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2, 4);
    ctx.fill();
    ctx.shadowBlur = 0; // reset
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawGrid();

    // Draw Portals
    if (hurdles.portals.length === 2) {
        const time = Date.now() / 200;
        const offset = Math.sin(time) * 2;
        
        ctx.fillStyle = COLOR_PORTAL;
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLOR_PORTAL;
        hurdles.portals.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x * GRID_SIZE + GRID_SIZE/2, p.y * GRID_SIZE + GRID_SIZE/2, GRID_SIZE/2 - 2 + offset/4, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;
    }

    // Draw Walls
    hurdles.walls.forEach(wall => {
        drawRect(wall.x, wall.y, COLOR_WALL);
        // Add a warning pattern
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(wall.x * GRID_SIZE + 5, wall.y * GRID_SIZE + 5, GRID_SIZE - 10, GRID_SIZE - 10);
    });

    // Draw Food
    const foodColor = food.type === 'standard' ? COLOR_FOOD : COLOR_POISON;
    drawRect(food.x, food.y, foodColor, true);

    // Draw Snake
    snake.forEach((segment, index) => {
        // Head is slightly brighter
        const color = index === 0 ? '#ffffff' : COLOR_SNAKE;
        drawRect(segment.x, segment.y, color, index === 0);
    });
}

function main(currentTime) {
    if (isGameOver) return;
    
    window.requestAnimationFrame(main);
    
    const timeSinceLastRender = currentTime - lastRenderTime;
    if (timeSinceLastRender < gameSpeed) return;
    
    lastRenderTime = currentTime;

    update();
    draw();
}

window.addEventListener('keydown', e => {
    // Prevent default scrolling
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].indexOf(e.code) > -1) {
        e.preventDefault();
    }

    let inputDx = 0;
    let inputDy = 0;

    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            inputDx = 0; inputDy = -1; break;
        case 'ArrowDown':
        case 's':
        case 'S':
            inputDx = 0; inputDy = 1; break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            inputDx = -1; inputDy = 0; break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            inputDx = 1; inputDy = 0; break;
    }

    if (inputDx !== 0 || inputDy !== 0) {
        if (controlsReversed) {
            inputDx *= -1;
            inputDy *= -1;
        }

        // Prevent reversing into itself
        if (snake.length > 1) {
            if (inputDx !== 0 && inputDx === -dx) return;
            if (inputDy !== 0 && inputDy === -dy) return;
        }

        nextDx = inputDx;
        nextDy = inputDy;
    }
});

startBtn.addEventListener('click', resetGame);
restartBtn.addEventListener('click', resetGame);

// Initial draw (just background/grid)
drawGrid();
