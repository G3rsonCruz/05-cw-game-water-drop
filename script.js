
const GAME_LENGTH = 30_000; // 30 seconds
const WIN_SCORE = 20;
const SPAWN_SPEED = 470; // Create a new item every 470 ms

// Get HTML elements
const gameContainer = document.getElementById("game-container");
const itemsLayer = document.getElementById("items-layer");
const feedbackLayer = document.getElementById("feedback-layer");
const confettiLayer = document.getElementById("confetti-layer");
const overlay = document.getElementById("overlay");
const overlayContent = document.getElementById("overlay-content");
const scoreDisplay = document.getElementById("score");
const timeDisplay = document.getElementById("time");
const supplyText = document.getElementById("supply-text");
const waterFill = document.getElementById("water-fill");
const waterMeter = document.getElementById("water-meter");
const pauseBtn = document.getElementById("pause-btn");

// Game variables
let score = 0;
let timeRemaining = GAME_LENGTH;
let gameState = "ready";
let dropMaker = null;
let gameTimer = null;
let lastTick = 0;
let resultMessage = "";

// Arrays of winning and losing messages
const winningMessages = [
  "You did it! You filled the village's water supply!",
  "Amazing work! Your clean-water collection made a difference!",
  "Every drop counts, and you collected enough to win!"
];

const losingMessages = [
  "Time's up! You can try again and collect even more water!",
  "Every drop matters. Give it another try and reach 20 points!",
  "The village needs more clean water. You've got this—try again!"
];

// Pick a random message from an array
function randomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

// Update the score, timer and progress bar
function updateDisplay() {
  scoreDisplay.textContent = score;
  timeDisplay.textContent = Math.ceil(timeRemaining / 1000);

  supplyText.textContent = `${Math.min(score, WIN_SCORE)} / ${WIN_SCORE}`;
  waterFill.style.width = `${Math.min(100, (score / WIN_SCORE) * 100)}%`;

  waterMeter.setAttribute(
    "aria-valuenow",
    Math.min(score, WIN_SCORE)
  );

  document.querySelector(".timer-stat").classList.toggle(
    "is-urgent",
    timeRemaining <= 10000
  );
}

// Stop game timers
function stopTimers() {
  clearInterval(dropMaker);
  clearInterval(gameTimer);

  dropMaker = null;
  gameTimer = null;
}

// Start the timer and falling items
function startTimers() {
  lastTick = performance.now();

  dropMaker = setInterval(createDrop, SPAWN_SPEED);

  gameTimer = setInterval(() => {
    if (gameState !== "playing") return;

    const now = performance.now();

    // Use elapsed time so delayed timer ticks do not extend the round.
    timeRemaining = Math.max(
      0,
      timeRemaining - (now - lastTick)
    );

    lastTick = now;

    updateDisplay();

    if (timeRemaining === 0) {
      endGame();
    }
  }, 80);
}

// Start a new game
function startGame() {
  stopTimers();

  itemsLayer.replaceChildren();
  feedbackLayer.replaceChildren();
  confettiLayer.replaceChildren();

  score = 0;
  timeRemaining = GAME_LENGTH;
  gameState = "playing";

  gameContainer.classList.remove("is-paused");
  overlay.hidden = true;

  pauseBtn.disabled = false;
  pauseBtn.textContent = "Pause";

  updateDisplay();

  // Create the first water drop immediately
  createDrop();

  startTimers();
}

// Pause the game
function pauseGame() {
  if (gameState !== "playing") return;

  timeRemaining = Math.max(
    0,
    timeRemaining - (performance.now() - lastTick)
  );

  if (timeRemaining === 0) {
    endGame();
    return;
  }

  stopTimers();

  gameState = "paused";
  gameContainer.classList.add("is-paused");

  pauseBtn.textContent = "Resume";

  updateDisplay();
  showPanel("pause");
}

// Resume the game
function resumeGame() {
  if (gameState !== "paused") return;

  gameState = "playing";

  gameContainer.classList.remove("is-paused");
  overlay.hidden = true;

  pauseBtn.textContent = "Pause";

  startTimers();
}

// Reset the game
function resetGame() {
  stopTimers();

  score = 0;
  timeRemaining = GAME_LENGTH;
  gameState = "ready";

  gameContainer.classList.remove("is-paused");

  itemsLayer.replaceChildren();
  feedbackLayer.replaceChildren();
  confettiLayer.replaceChildren();

  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pause";

  updateDisplay();
  showPanel("welcome");
}

// Create falling water drops and obstacles
function createDrop() {
  if (gameState !== "playing") return;

  const chance = Math.random();

  // Choose a random item type
  // Clean water is common; bonus stars are intentionally rare.
  const type = chance < 0.73 ? "clean"
    : chance < 0.91 ? "dirty"
    : chance < 0.98 ? "trash" : "star";

  // Point values
  const points = {
    clean: 1,
    dirty: -1,
    trash: -2,
    star: 3
  }[type];

  const labels = {
    clean: "Collect clean water, plus 1 point",
    dirty: "Dirty water, minus 1 point",
    trash: "Trash obstacle, minus 2 points",
    star: "Water filter bonus, plus 3 points"
  };

  // Create the falling item
  const item = document.createElement("button");

  item.type = "button";
  item.className = `falling-item ${type}`;
  item.setAttribute("aria-label", labels[type]);

  // Larger invisible click area around the drop
const size = 68 + Math.random() * 12;

  const maxLeft = Math.max(
    0,
    gameContainer.clientWidth - size - 12
  );

  item.style.width = `${size}px`;
  item.style.height = `${size}px`;
  item.style.left = `${6 + Math.random() * maxLeft}px`;

  // Random falling speed
  item.style.animationDuration =
    `${3.2 + Math.random() * 1.4}s`;

  // Choose the item's appearance
  item.innerHTML = (type === "trash") ? "🗑️"
    : (type === "star") ? "⭐"
    : '<span class="shape" aria-hidden="true"></span>';

  // Collect immediately when the player presses the drop
item.addEventListener("pointerdown", (event) => {
  
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  event.preventDefault();
  collectItem(item, points);
});

// Also support collecting drops using the keyboard
// Keyboard activation creates a click without a pointer event.
item.addEventListener("click", (event) => {
  if (event.detail === 0) {
    collectItem(item, points);
  }
});

  // Remove an item when it reaches the bottom
  item.addEventListener("animationend", () => {
    item.remove();
  });

  itemsLayer.appendChild(item);
}

// Collect an item and update the score
function collectItem(item, points) {
  if (gameState !== "playing" || !item.isConnected) {
    return;
  }

  const itemRect = item.getBoundingClientRect();
  const gameRect = gameContainer.getBoundingClientRect();

  const x = itemRect.left - gameRect.left + itemRect.width / 2;
  const y = itemRect.top - gameRect.top;

  item.remove();

  // Prevent negative scores
  score = Math.max(0, score + points);

  updateDisplay();
  showFeedback(x, y, points);
}

// Display +1, -1, -2 or +3 when collecting an item
function showFeedback(x, y, points) {
  const feedback = document.createElement("span");

  feedback.className =
    `feedback ${points < 0 ? "negative" : ""}`;

  feedback.textContent =
    points > 0 ? `+${points}` : `${points}`;

  feedback.style.left = `${x}px`;
  feedback.style.top = `${y}px`;

  feedbackLayer.appendChild(feedback);

  feedback.addEventListener("animationend", () => {
    feedback.remove();
  });
}

// End the game after 30 seconds
function endGame() {
  if (gameState === "finished") return;

  stopTimers();

  gameState = "finished";
  timeRemaining = 0;

  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pause";

  itemsLayer.replaceChildren();

  updateDisplay();

  // Save the player's score
  saveHighScore(score);

  // Check if the player won
  if (score >= WIN_SCORE) {
    resultMessage = randomMessage(winningMessages);
    showPanel("win");
    celebrateWin();
  } else {
    resultMessage = randomMessage(losingMessages);
    showPanel("lose");
  }
}

// Extra credit: confetti when the player wins
function celebrateWin() {
  confettiLayer.replaceChildren();

  const colors = [
    "#FFC907",
    "#2E9DF7",
    "#4FCB53",
    "#FF902A",
    "#F16061"
  ];

  // Create 65 colorful confetti pieces
  for (let i = 0; i < 65; i++) {
    const piece = document.createElement("span");

    piece.className = "confetti";

    piece.style.left = `${Math.random() * 100}%`;

    piece.style.backgroundColor =
      colors[i % colors.length];

    piece.style.animationDelay =
      `${Math.random() * 0.8}s`;

    piece.style.animationDuration =
      `${1.9 + Math.random() * 1.2}s`;

    confettiLayer.appendChild(piece);
  }

  // Clean up confetti after the animation
  setTimeout(() => {
    confettiLayer.replaceChildren();
  }, 4200);
}

// Load previously saved high scores
function loadHighScores() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("dropByDropScores") || "[]"
    );

    return Array.isArray(saved)
      ? saved.filter(n => Number.isFinite(n)).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

// Save the five highest scores
function saveHighScore(newScore) {
  const scores = [...loadHighScores(), newScore]
    .sort((a, b) => b - a)
    .slice(0, 5);

  try {
    localStorage.setItem(
      "dropByDropScores",
      JSON.stringify(scores)
    );
  } catch {
    // Some browsers may block local storage
  }
}

// Helper functions for game menus
function actionButtons(primary, secondary = "") {
  return `<div class="dialog-actions">${primary}${secondary}</div>`;
}

function menuButton(label, action, primary = false) {
  return `
    <button
      type="button"
      data-action="${action}"
      class="button ${primary ? "button-yellow" : "button-outline"}"
    >
      ${label}
    </button>
  `;
}

function backAction() {
  if (gameState === "paused") return "pause";

  if (gameState === "finished") {
    return score >= WIN_SCORE ? "win" : "lose";
  }

  return "welcome";
}

// Display game menus and messages
function showPanel(screen) {
  const buttons = (a, b = "") => actionButtons(a, b);

  let html = "";

  // Welcome screen
  if (screen === "welcome") {
    html = `
      <div class="dialog-accent">💧</div>
      <p class="dialog-kicker">A GAME FOR CLEAN WATER</p>
      <h2>Drop by Drop</h2>
      <p>
        Collect clean water for the village.
        Reach <strong>20 points</strong> before
        the 30-second timer runs out!
      </p>
      ${buttons(
        menuButton("Play Game", "start", true),
        menuButton("How to Play", "rules")
      )}
    `;
  }

  // Instructions screen
  else if (screen === "rules") {
    html = `
      <h2>How to Play</h2>
      <p>Tap or click falling items before they reach the ground.</p>

      <div class="rules-list">
        <div class="rule">
          <span class="rule-icon">💧</span>
          <strong>+1</strong> Clean water
        </div>
        <div class="rule">
          <span class="rule-icon">⚫</span>
          <strong>−1</strong> Dirty water
        </div>
        <div class="rule">
          <span class="rule-icon">🗑️</span>
          <strong>−2</strong> Trash obstacle
        </div>
        <div class="rule">
          <span class="rule-icon">⭐</span>
          <strong>+3</strong> Water filter bonus
        </div>
      </div>

      <p>Collect at least 20 points to win!</p>

      ${buttons(
        menuButton("Start Game", "start", true),
        menuButton("Back", "back")
      )}
    `;
  }

  // Pause menu
  else if (screen === "pause") {
    html = `
      <div class="dialog-accent">⏸</div>
      <h2>Game Paused</h2>
      <p>
        Your drops and timer are paused.
        Ready to keep collecting?
      </p>
      ${buttons(
        menuButton("Resume", "resume", true),
        menuButton("Restart", "start")
      )}
      ${buttons(menuButton("Main Menu", "reset"))}
    `;
  }

  // Winning screen
  else if (screen === "win") {
    html = `
      <div class="dialog-accent">🏆</div>
      <h2>You Did It!</h2>
      <p>${resultMessage}</p>
      <p><strong>Final score: ${score}</strong></p>
      ${buttons(
        menuButton("Play Again", "start", true),
        menuButton("Learn More", "about")
      )}
    `;
  }

  // Losing screen
  else if (screen === "lose") {
    html = `
      <div class="dialog-accent">💧</div>
      <h2>Time's Up!</h2>
      <p>${resultMessage}</p>
      <p>
        <strong>Final score: ${score}</strong>
        · Goal: ${WIN_SCORE}
      </p>
      ${buttons(
        menuButton("Try Again", "start", true),
        menuButton("Learn More", "about")
      )}
    `;
  }

  // About charity: water
  else if (screen === "about") {
    html = `
      <p class="dialog-kicker">
        CLEAN WATER CHANGES EVERYTHING
      </p>

      <h2>About charity: water</h2>

      <p>
        charity: water is a nonprofit organization
        working to bring clean and safe drinking water
        to people around the world.
      </p>

      <p>
        Access to clean water helps improve health
        and gives communities more opportunities for
        education and a brighter future.
      </p>

      <p>
        <a href="https://www.charitywater.org/"
           target="_blank" rel="noopener noreferrer">
          Visit charity: water ↗
        </a>
      </p>

      ${buttons(menuButton("Back", "back"))}
    `;
  }

  // High scores screen
  else if (screen === "scores") {
    const scores = loadHighScores();

    const rows = scores.length
      ? scores.map((value, i) => `
          <li>
            <strong>${i + 1}.</strong>
            <span>${value} points</span>
          </li>
        `).join("")
      : "<li>No scores yet. Play a round!</li>";

    html = `
      <div class="dialog-accent">⭐</div>
      <h2>High Scores</h2>
      <p>Your five highest scores on this device.</p>

      <ol class="high-score-list">
        ${rows}
      </ol>

      ${buttons(menuButton("Back", "back"))}
    `;
  }

  // Show the chosen menu
  overlayContent.innerHTML = html;
  overlay.hidden = false;

  const firstButton = overlayContent.querySelector("button");

  // Move keyboard focus into the newly opened menu.
  if (firstButton) {
    firstButton.focus({ preventScroll: true });
  }
}

// Handle button clicks inside the menus
overlayContent.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const action = button.dataset.action;

  if (action === "start") {
    startGame();
  } else if (action === "resume") {
    resumeGame();
  } else if (action === "reset") {
    resetGame();
  } else if (action === "back") {
    showPanel(backAction());
  } else if (["rules", "about", "scores"].includes(action)) {
    showPanel(action);
  }
});

// Pause button
pauseBtn.addEventListener("click", () => {
  if (gameState === "playing") {
    pauseGame();
  } else if (gameState === "paused") {
    resumeGame();
  }
});

// Reset button
document.getElementById("reset-btn").addEventListener(
  "click",
  resetGame
);

// Pause automatically if a menu is opened during gameplay
function openMenu(screen) {
  if (gameState === "playing") {
    pauseGame();
  }

  showPanel(screen);
}

// Navigation buttons
document.getElementById("how-btn").addEventListener(
  "click",
  () => openMenu("rules")
);

document.getElementById("about-btn").addEventListener(
  "click",
  () => openMenu("about")
);

document.getElementById("scores-btn").addEventListener(
  "click",
  () => openMenu("scores")
);

// Show the welcome screen when the page first loads
resetGame();
