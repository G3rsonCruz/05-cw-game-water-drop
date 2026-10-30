
// Drop by Drop - LevelUp Edition
// Controls scoring, difficulty, timers, sounds,
// milestones, DOM interactions and game menus.

// Each mode has different goals and speeds.
const MODES = {
  easy: {
    name: "Easy",
    goal: 12,
    seconds: 35,
    spawnMs: 620,
    minFall: 4.1,
    maxFall: 5.2,
    cleanChance: 0.82,
    dirtyChance: 0.12
  },

  normal: {
    name: "Normal",
    goal: 20,
    seconds: 30,
    spawnMs: 470,
    minFall: 3.2,
    maxFall: 4.6,
    cleanChance: 0.73,
    dirtyChance: 0.18
  },

  hard: {
    name: "Hard",
    goal: 26,
    seconds: 25,
    spawnMs: 330,
    minFall: 2.1,
    maxFall: 3.0,
    cleanChance: 0.62,
    dirtyChance: 0.23
  }
};

// Get HTML elements
const gameContainer = document.getElementById("game-container");
const itemsLayer = document.getElementById("items-layer");
const feedbackLayer = document.getElementById("feedback-layer");
const confettiLayer = document.getElementById("confetti-layer");
const milestoneBanner = document.getElementById("milestone-banner");
const overlay = document.getElementById("overlay");
const overlayContent = document.getElementById("overlay-content");

const scoreDisplay = document.getElementById("score");
const timeDisplay = document.getElementById("time");
const supplyText = document.getElementById("supply-text");
const waterFill = document.getElementById("water-fill");
const waterMeter = document.getElementById("water-meter");

const pauseBtn = document.getElementById("pause-btn");
const difficultySelect = document.getElementById("difficulty-select");
const modeDetails = document.getElementById("mode-details");
const soundBtn = document.getElementById("sound-btn");

// Game variables
let selectedMode = "normal";
let score = 0;
let timeRemaining = MODES.normal.seconds * 1000;
let gameState = "ready";

let dropMaker = null;
let gameTimer = null;
let bannerTimer = null;
let confettiTimer = null;

let lastTick = 0;
let lastMissSound = 0;
let resultMessage = "";
let shownMilestones = new Set();
let soundEnabled = true;

// Random messages for winning
const winningMessages = [
  "You did it! You filled the village's water supply!",
  "Amazing work! Your clean-water collection made a difference!",
  "Every drop counts, and you collected enough to win!"
];

// Random messages for losing
const losingMessages = [
  "Time's up! Try again and collect even more clean water!",
  "Every drop matters. You can reach the goal next time!",
  "The village needs more clean water. You've got this!"
];

// Milestone messages
const milestones = [
  {
    percent: 0.25,
    text: "💧 Nice start! You're 25% of the way there!"
  },
  {
    percent: 0.50,
    text: "🌊 Halfway there! Keep collecting!"
  },
  {
    percent: 0.75,
    text: "⭐ Amazing! The village is almost there!"
  },
  {
    percent: 1.00,
    text: "🏆 Goal reached! Keep it up until time runs out!"
  }
];

// Choose a random message
function randomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

// Get the current difficulty settings
function settings() {
  return MODES[selectedMode];
}

/* ==========================================
   SOUND EFFECTS
========================================== */

// Sound files are stored in the sounds folder.
const sounds = {
  collect: new Audio("sounds/collect.wav"),
  obstacle: new Audio("sounds/obstacle.wav"),
  miss: new Audio("sounds/miss.wav"),
  button: new Audio("sounds/button.wav"),
  milestone: new Audio("sounds/milestone.wav"),
  win: new Audio("sounds/win.wav")
};

// Set the volume of each sound
Object.values(sounds).forEach(audio => {
  audio.preload = "auto";
  audio.volume = 0.35;
});

// Play a sound effect
function playSound(name) {
  if (!soundEnabled || !sounds[name]) return;

  // Clone the audio so quick clicks can overlap.
  const audio = sounds[name].cloneNode();

  audio.volume = name === "miss" ? 0.15 : 0.35;

  audio.play().catch(() => {
    // Audio may be blocked or unavailable.
  });
}

// Update the sound button
function updateSoundButton() {
  soundBtn.textContent = soundEnabled
    ? "🔊 Sound On"
    : "🔇 Sound Off";

  soundBtn.setAttribute(
    "aria-pressed",
    String(soundEnabled)
  );
}

/* ==========================================
   UPDATE THE GAME DISPLAY
========================================== */

function updateDisplay() {
  const mode = settings();

  // Update score and timer
  scoreDisplay.textContent = score;
  timeDisplay.textContent = Math.ceil(timeRemaining / 1000);

  // Update water supply progress
  supplyText.textContent =
    `${Math.min(score, mode.goal)} / ${mode.goal}`;

  waterFill.style.width =
    `${Math.min(100, score / mode.goal * 100)}%`;

  waterMeter.setAttribute(
    "aria-valuenow",
    String(Math.min(score, mode.goal))
  );

  waterMeter.setAttribute(
    "aria-valuemax",
    String(mode.goal)
  );

  // Display the selected difficulty
  modeDetails.textContent =
    `${mode.goal} points · ${mode.seconds} seconds`;

  difficultySelect.value = selectedMode;

  // Turn the timer red near the end
  document.querySelector(".timer-stat").classList.toggle(
    "is-urgent",
    timeRemaining <= 10000
  );
}

/* ==========================================
   GAME TIMERS
========================================== */

// Stop all game intervals
function stopTimers() {
  clearInterval(dropMaker);
  clearInterval(gameTimer);

  dropMaker = null;
  gameTimer = null;
}

// Remove old animations and milestone messages
function clearEffects() {
  clearTimeout(bannerTimer);
  clearTimeout(confettiTimer);

  milestoneBanner.hidden = true;
  milestoneBanner.textContent = "";

  feedbackLayer.replaceChildren();
  confettiLayer.replaceChildren();
}

// Start the countdown and falling items
function startTimers() {
  lastTick = performance.now();

  // Create drops according to the difficulty
  dropMaker = setInterval(
    createDrop,
    settings().spawnMs
  );

  // Update the countdown
  gameTimer = setInterval(() => {
    if (gameState !== "playing") return;

    const now = performance.now();

    timeRemaining = Math.max(
      0,
      timeRemaining - (now - lastTick)
    );

    lastTick = now;

    updateDisplay();

    // End the game when time runs out
    if (timeRemaining === 0) {
      endGame();
    }
  }, 80);
}

/* ==========================================
   START, PAUSE, RESUME AND RESET
========================================== */

// Start a new game
function startGame() {
  stopTimers();
  clearEffects();

  // Remove any previous drops
  itemsLayer.replaceChildren();
  shownMilestones.clear();

  score = 0;
  timeRemaining = settings().seconds * 1000;
  gameState = "playing";

  gameContainer.classList.remove("is-paused");
  overlay.hidden = true;

  pauseBtn.disabled = false;
  pauseBtn.textContent = "Pause";

  updateDisplay();

  playSound("button");

  // Create the first drop immediately
  createDrop();

  // Start regular drops and the countdown
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

  // Freeze the falling animations
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

  playSound("button");

  startTimers();
}

// Reset everything
function resetGame() {
  stopTimers();
  clearEffects();

  itemsLayer.replaceChildren();
  shownMilestones.clear();

  score = 0;
  timeRemaining = settings().seconds * 1000;
  gameState = "ready";

  gameContainer.classList.remove("is-paused");

  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pause";

  updateDisplay();
  showPanel("welcome");
}

// Change the difficulty
function chooseDifficulty(mode) {
  if (!MODES[mode]) return;

  selectedMode = mode;

  playSound("button");

  // Changing difficulty starts a fresh round
  resetGame();
}

/* ==========================================
   MILESTONE MESSAGES
========================================== */

// Display a milestone message
function showMilestone(message) {
  clearTimeout(bannerTimer);

  milestoneBanner.textContent = message;
  milestoneBanner.hidden = false;

  playSound("milestone");

  // Hide the message after 2.1 seconds
  bannerTimer = setTimeout(() => {
    milestoneBanner.hidden = true;
  }, 2100);
}

// Check whether the player reached a milestone
function checkMilestones(previousScore) {
  const mode = settings();

  let newest = null;

  milestones.forEach((milestone, index) => {
    // Calculate the milestone based on difficulty
    const threshold = Math.ceil(
      mode.goal * milestone.percent
    );

    if (
      !shownMilestones.has(index) &&
      previousScore < threshold &&
      score >= threshold
    ) {
      shownMilestones.add(index);
      newest = milestone;
    }
  });

  if (newest) {
    showMilestone(newest.text);
  }
}

/* ==========================================
   CREATE FALLING WATER DROPS
========================================== */

function createDrop() {
  if (gameState !== "playing") return;

  const mode = settings();

  // Randomly choose a falling item
  const chance = Math.random();

  const type = chance < mode.cleanChance
    ? "clean"
    : chance < mode.cleanChance + mode.dirtyChance
      ? "dirty"
      : chance < 0.98
        ? "trash"
        : "star";

  // Point values for each item
  const points = {
    clean: 1,
    dirty: -1,
    trash: -2,
    star: 3
  }[type];

  // Descriptions for accessibility
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

  // Large clickable area for reliable tapping
  const size = 68 + Math.random() * 12;

  const maxLeft = Math.max(
    0,
    gameContainer.clientWidth - size - 12
  );

  item.style.width = `${size}px`;
  item.style.height = `${size}px`;

  // Random horizontal position
  item.style.left =
    `${6 + Math.random() * maxLeft}px`;

  // Different falling speeds for each mode
  item.style.animationDuration = `${
    mode.minFall +
    Math.random() * (mode.maxFall - mode.minFall)
  }s`;

  // Display the correct object
  item.innerHTML = type === "trash"
    ? "🗑️"
    : type === "star"
      ? "⭐"
      : '<span class="shape" aria-hidden="true"></span>';

  // FIX: Register clicks immediately using pointerdown
  item.addEventListener("pointerdown", event => {
    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    collectItem(item, points);
  });

  // Keyboard support using Enter or Space
  item.addEventListener("click", event => {
    if (event.detail === 0) {
      collectItem(item, points);
    }
  });

  // Remove items that fall off the screen
  item.addEventListener("animationend", event => {
    if (event.animationName !== "dropFall") return;

    // Play a sound when clean water is missed
    if (
      gameState === "playing" &&
      item.isConnected &&
      type === "clean"
    ) {
      const now = performance.now();

      // Prevent too many miss sounds playing together
      if (now - lastMissSound > 650) {
        playSound("miss");
        lastMissSound = now;
      }
    }

    item.remove();
  });

  // Add the item to the game
  itemsLayer.appendChild(item);
}

/* ==========================================
   COLLECT ITEMS AND UPDATE SCORE
========================================== */

function collectItem(item, points) {
  // Prevent collecting the same item twice
  if (
    gameState !== "playing" ||
    !item.isConnected
  ) {
    return;
  }

  const itemRect = item.getBoundingClientRect();
  const gameRect = gameContainer.getBoundingClientRect();

  const x =
    itemRect.left - gameRect.left +
    itemRect.width / 2;

  const y = itemRect.top - gameRect.top;

  // Remove the collected drop from the DOM
  item.remove();

  const oldScore = score;

  // Add or subtract points
  score = Math.max(0, score + points);

  updateDisplay();

  // Display floating +1 / -1 / +3 feedback
  showFeedback(x, y, points);

  // Play the corresponding sound
  playSound(points > 0 ? "collect" : "obstacle");

  // Check for milestones after positive collections
  if (points > 0) {
    checkMilestones(oldScore);
  }
}

// Display score feedback where an item was collected
function showFeedback(x, y, points) {
  const feedback = document.createElement("span");

  feedback.className =
    `feedback ${points < 0 ? "negative" : ""}`;

  feedback.textContent =
    points > 0 ? `+${points}` : `${points}`;

  feedback.style.left = `${x}px`;
  feedback.style.top = `${y}px`;

  feedbackLayer.appendChild(feedback);

  // Remove the feedback when animation finishes
  feedback.addEventListener("animationend", () => {
    feedback.remove();
  });
}

/* ==========================================
   END GAME AND CHECK FOR WIN
========================================== */

function endGame() {
  if (gameState === "finished") return;

  stopTimers();

  clearTimeout(bannerTimer);
  milestoneBanner.hidden = true;

  gameState = "finished";
  timeRemaining = 0;

  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pause";

  // Remove all remaining falling items
  itemsLayer.replaceChildren();

  updateDisplay();

  // Save the score for the selected mode
  saveHighScore(score);

  // Determine whether the player won
  if (score >= settings().goal) {
    resultMessage = randomMessage(winningMessages);

    showPanel("win");

    playSound("win");

    celebrateWin();
  } else {
    resultMessage = randomMessage(losingMessages);

    showPanel("lose");

    playSound("obstacle");
  }
}

/*  WINNING CONFETTI */

function celebrateWin() {
  const colors = [
    "#FFC907",
    "#2E9DF7",
    "#4FCB53",
    "#FF902A",
    "#F16061"
  ];

  confettiLayer.replaceChildren();

  // Create 65 colorful confetti pieces
  for (let i = 0; i < 65; i++) {
    const piece = document.createElement("span");

    piece.className = "confetti";

    piece.style.left =
      `${Math.random() * 100}%`;

    piece.style.backgroundColor =
      colors[i % colors.length];

    piece.style.animationDelay =
      `${Math.random() * 0.8}s`;

    piece.style.animationDuration =
      `${1.9 + Math.random() * 1.2}s`;

    confettiLayer.appendChild(piece);
  }

  // Remove confetti after the animation
  confettiTimer = setTimeout(() => {
    confettiLayer.replaceChildren();
  }, 4200);
}

/* ==========================================
   HIGH SCORES
========================================== */

// Give each difficulty its own leaderboard
function scoreKey() {
  return selectedMode === "normal"
    ? "dropByDropScores"
    : `dropByDropScores:${selectedMode}`;
}

// Load the saved scores
function loadHighScores() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(scoreKey()) || "[]"
    );

    return Array.isArray(saved)
      ? saved
          .filter(Number.isFinite)
          .sort((a, b) => b - a)
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

// Save a new high score
function saveHighScore(newScore) {
  const scores = [
    ...loadHighScores(),
    newScore
  ]
    .sort((a, b) => b - a)
    .slice(0, 5);

  try {
    localStorage.setItem(
      scoreKey(),
      JSON.stringify(scores)
    );
  } catch {
    // Some browsers might block storage
  }
}

/* ==========================================
   MENU BUTTON HELPERS
========================================== */

// Create a menu button
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

// Group menu buttons
function actionButtons(...buttons) {
  return `
    <div class="dialog-actions">
      ${buttons.join("")}
    </div>
  `;
}

// Decide which screen the Back button returns to
function backAction() {
  if (gameState === "paused") {
    return "pause";
  }

  if (gameState === "finished") {
    return score >= settings().goal ? "win" : "lose";
  }

  return "welcome";
}

// Create difficulty choices in the welcome menu
function modeButtons() {
  return `
    <div class="difficulty-options" aria-label="Choose difficulty">
      ${Object.entries(MODES).map(([key, mode]) => `
        <button
          type="button"
          data-mode="${key}"
          aria-pressed="${key === selectedMode}"
          class="difficulty-option ${
            key === selectedMode ? "is-selected" : ""
          }"
        >
          <strong>${mode.name}</strong>
          <small>${mode.goal} pts · ${mode.seconds}s</small>
        </button>
      `).join("")}
    </div>
  `;
}

/* ==========================================
   GAME SCREENS AND MENUS
========================================== */

function showPanel(screen) {
  const mode = settings();

  let html = "";

  // Welcome screen
  if (screen === "welcome") {
    html = `
      <div class="dialog-accent">💧</div>
      <p class="dialog-kicker">A GAME FOR CLEAN WATER</p>

      <h2>Drop by Drop</h2>

      <p>
        Choose a difficulty. Collect clean water
        and reach your score goal before time runs out!
      </p>

      ${modeButtons()}

      <p>
        <strong>${mode.name}:</strong>
        Get ${mode.goal} points in ${mode.seconds} seconds.
      </p>

      ${actionButtons(
        menuButton("Play Game", "start", true),
        menuButton("How to Play", "rules")
      )}
    `;
  }

  // How to Play screen
  else if (screen === "rules") {
    html = `
      <h2>How to Play</h2>

      <p>
        Tap or click the falling items before
        they hit the ground.
      </p>

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

      <p>
        <strong>${mode.name}:</strong>
        Reach ${mode.goal} points in ${mode.seconds} seconds.
        Watch for milestone messages!
      </p>

      ${actionButtons(
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

      <p>Your timer and drops are paused.</p>

      ${actionButtons(
        menuButton("Resume", "resume", true),
        menuButton("Restart", "start")
      )}

      ${actionButtons(
        menuButton("Main Menu", "reset")
      )}
    `;
  }

  // Win screen
  else if (screen === "win") {
    html = `
      <div class="dialog-accent">🏆</div>
      <h2>You Did It!</h2>

      <p>${resultMessage}</p>

      <p>
        <strong>${mode.name} final score: ${score}</strong>
      </p>

      ${actionButtons(
        menuButton("Play Again", "start", true),
        menuButton("Learn More", "about")
      )}
    `;
  }

  // Lose screen
  else if (screen === "lose") {
    html = `
      <div class="dialog-accent">💧</div>
      <h2>Time's Up!</h2>

      <p>${resultMessage}</p>

      <p>
        <strong>${mode.name} final score: ${score}</strong>
        · Goal: ${mode.goal}
      </p>

      ${actionButtons(
        menuButton("Try Again", "start", true),
        menuButton("Learn More", "about")
      )}
    `;
  }

  // Information about charity: water
  else if (screen === "about") {
    html = `
      <p class="dialog-kicker">
        CLEAN WATER CHANGES EVERYTHING
      </p>

      <h2>About charity: water</h2>

      <p>
        charity: water is a nonprofit organization
        working to bring clean and safe drinking
        water to people around the world.
      </p>

      <p>
        Clean water helps communities thrive
        by improving health and supporting
        access to education.
      </p>

      <p>
        <a href="https://www.charitywater.org/"
           target="_blank"
           rel="noopener noreferrer">
          Visit charity: water ↗
        </a>
      </p>

      <p>
        <a href="https://www.charitywater.org/donate"
           target="_blank"
           rel="noopener noreferrer">
          Donate to clean water ↗
        </a>
      </p>

      ${actionButtons(
        menuButton("Back", "back")
      )}
    `;
  }

  // High Scores screen
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

      <p>
        Top five scores for
        <strong>${mode.name}</strong>
        on this device.
      </p>

      <ol class="high-score-list">
        ${rows}
      </ol>

      ${actionButtons(
        menuButton("Back", "back")
      )}
    `;
  }

  // Update the displayed menu
  overlayContent.innerHTML = html;
  overlay.hidden = false;

  const firstButton = overlayContent.querySelector("button");

  if (firstButton) {
    firstButton.focus({ preventScroll: true });
  }
}

/* ==========================================
   HANDLE MENU BUTTON CLICKS
========================================== */

overlayContent.addEventListener("click", event => {
  // Difficulty selection from the welcome screen
  const modeButton = event.target.closest("[data-mode]");

  if (modeButton) {
    chooseDifficulty(modeButton.dataset.mode);
    return;
  }

  // Normal menu buttons
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const action = button.dataset.action;

  if (action === "start") {
    startGame();
  }

  else if (action === "resume") {
    resumeGame();
  }

  else if (action === "reset") {
    playSound("button");
    resetGame();
  }

  else if (action === "back") {
    playSound("button");
    showPanel(backAction());
  }

  else if (["rules", "about", "scores"].includes(action)) {
    playSound("button");
    showPanel(action);
  }
});

/* ==========================================
   MAIN GAME CONTROL BUTTONS
========================================== */

// Pause and Resume
pauseBtn.addEventListener("click", () => {
  if (gameState === "playing") {
    playSound("button");
    pauseGame();
  }

  else if (gameState === "paused") {
    resumeGame();
  }
});

// Reset
document.getElementById("reset-btn").addEventListener(
  "click",
  () => {
    playSound("button");
    resetGame();
  }
);

// Pause the game when opening another menu
function openMenu(screen) {
  if (gameState === "playing") {
    pauseGame();
  }

  playSound("button");
  showPanel(screen);
}

// Header navigation buttons
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

/* ==========================================
   DIFFICULTY SELECTOR
========================================== */

difficultySelect.addEventListener("change", event => {
  const next = event.target.value;

  if (!MODES[next] || next === selectedMode) {
    return;
  }

  // Confirm before restarting an active round
  if (
    (gameState === "playing" || gameState === "paused") &&
    !window.confirm(
      "Changing difficulty will restart your current round. Continue?"
    )
  ) {
    difficultySelect.value = selectedMode;
    return;
  }

  chooseDifficulty(next);
});

/* ==========================================
   SOUND TOGGLE BUTTON
========================================== */

soundBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;

  updateSoundButton();

  if (soundEnabled) {
    playSound("button");
  }
});

/* ==========================================
   INITIALIZE THE GAME
========================================== */

// Set up sound button and show welcome screen
updateSoundButton();
resetGame();
