
// Drop by Drop - Safari Optimized Edition
// Handles difficulty modes, scoring, sounds, milestones,
// animations, pause/reset, and win/lose screens.

// Difficulty settings
const MODES = {
  easy: {
    name: "Easy", goal: 12, seconds: 35,
    spawnMs: 620, minFall: 4.1, maxFall: 5.2,
    cleanChance: 0.82, dirtyChance: 0.12
  },
  normal: {
    name: "Normal", goal: 20, seconds: 30,
    spawnMs: 470, minFall: 3.2, maxFall: 4.6,
    cleanChance: 0.73, dirtyChance: 0.18
  },
  hard: {
    name: "Hard", goal: 26, seconds: 25,
    spawnMs: 330, minFall: 2.1, maxFall: 3.0,
    cleanChance: 0.62, dirtyChance: 0.23
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

// Game variables keep track of the active round and UI state.
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

// Winning messages
const winningMessages = [
  "You did it! You filled the village's water supply!",
  "Amazing work! Your clean-water collection made a difference!",
  "Every drop counts, and you collected enough to win!"
];

// Losing messages
const losingMessages = [
  "Time's up! Try again and collect even more clean water!",
  "Every drop matters. You can reach the goal next time!",
  "The village needs more clean water. You've got this!"
];

// Milestone messages for each difficulty
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

// Pick a random message
function randomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

// Get current difficulty
function settings() {
  return MODES[selectedMode];
}

/*  SAFARI-OPTIMIZED AUDIO SYSTEM */

// Load each WAV only once instead of cloning audio elements.
const SOUND_FILES = {
  collect: "sounds/collect.wav",
  obstacle: "sounds/obstacle.wav",
  miss: "sounds/miss.wav",
  button: "sounds/button.wav",
  milestone: "sounds/milestone.wav",
  win: "sounds/win.wav"
};

// Audio storage
const audioBytes = new Map();
const audioBuffers = new Map();
const decoding = new Set();
const activeSounds = new Set();

let audioContext = null;

// Download the sound files before gameplay
for (const [name, path] of Object.entries(SOUND_FILES)) {
  fetch(path)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.arrayBuffer();
    })
    .then(bytes => {
      audioBytes.set(name, bytes);
      decodeSound(name);
    })
    .catch(error => {
      console.warn(`Unable to load ${path}:`, error);
    });
}

// Convert a sound file into reusable audio data
function decodeSound(name) {
  if (
    !audioContext ||
    !audioBytes.has(name) ||
    audioBuffers.has(name) ||
    decoding.has(name)
  ) {
    return;
  }

  decoding.add(name);

  const bytes = audioBytes.get(name).slice(0);

  audioContext.decodeAudioData(bytes)
    .then(buffer => {
      audioBuffers.set(name, buffer);
    })
    .catch(error => {
      console.warn(`Cannot decode ${name}:`, error);
    })
    .finally(() => {
      decoding.delete(name);
    });
}

// Safari requires a user interaction before starting audio
function unlockAudio() {
  if (!soundEnabled) return;

  if (!audioContext) {
    const AudioEngine =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioEngine) return;

    try {
      audioContext = new AudioEngine({
        latencyHint: "interactive"
      });
    } catch (error) {
      console.warn("Unable to start audio engine:", error);
      return;
    }
  }

  // Try to resume interrupted or suspended Safari audio
  if (audioContext.state !== "running") {
    audioContext.resume().catch(() => {});
  }

  // Decode any sounds that have finished downloading
  for (const name of audioBytes.keys()) {
    decodeSound(name);
  }
}

// Unlock audio on mouse, touch or keyboard interaction
document.addEventListener(
  "pointerdown",
  unlockAudio,
  { capture: true }
);

document.addEventListener(
  "keydown",
  unlockAudio,
  { capture: true }
);

// Stop currently playing sounds
function stopAllSounds() {
  for (const source of activeSounds) {
    try {
      source.stop();
    } catch {
      // The sound may already have finished
    }
  }

  activeSounds.clear();
}

// Play a sound instantly if ready
function playSound(name) {
  if (
    !soundEnabled ||
    !audioContext ||
    audioContext.state !== "running"
  ) {
    return;
  }

  const buffer = audioBuffers.get(name);

  // Skip unready sounds instead of playing them later
  if (!buffer) return;

  // Avoid too many simultaneous sound effects
  if (activeSounds.size >= 8) return;

  try {
    const source = audioContext.createBufferSource();
    const volume = audioContext.createGain();

    source.buffer = buffer;

    // Make missed water quieter
    volume.gain.value =
      name === "miss" ? 0.12 : 0.32;

    source.connect(volume);
    volume.connect(audioContext.destination);

    activeSounds.add(source);

    // Clean up the sound when it finishes
    source.onended = () => {
      activeSounds.delete(source);
      source.disconnect();
      volume.disconnect();
    };

    source.start();
  } catch (error) {
    console.warn("Unable to play sound:", error);
  }
}

// Update sound toggle button
function updateSoundButton() {
  soundBtn.textContent = soundEnabled
    ? "🔊 Sound On"
    : "🔇 Sound Off";

  soundBtn.setAttribute(
    "aria-pressed",
    String(soundEnabled)
  );
}

/* UPDATE SCORE, TIMER AND WATER SUPPLY */

function updateDisplay() {
  const mode = settings();

  scoreDisplay.textContent = score;
  timeDisplay.textContent = Math.ceil(timeRemaining / 1000);

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

  modeDetails.textContent =
    `${mode.goal} points · ${mode.seconds} seconds`;

  difficultySelect.value = selectedMode;

  document.querySelector(".timer-stat").classList.toggle(
    "is-urgent",
    timeRemaining <= 10000
  );
}

/* GAME TIMER FUNCTIONS */

function stopTimers() {
  clearInterval(dropMaker);
  clearInterval(gameTimer);

  dropMaker = null;
  gameTimer = null;
}

// Remove previous messages and animations
function clearEffects() {
  clearTimeout(bannerTimer);
  clearTimeout(confettiTimer);

  milestoneBanner.hidden = true;
  milestoneBanner.textContent = "";

  feedbackLayer.replaceChildren();
  confettiLayer.replaceChildren();
}

// Start the countdown and create drops
function startTimers() {
  lastTick = performance.now();

  dropMaker = setInterval(
    createDrop,
    settings().spawnMs
  );

  gameTimer = setInterval(() => {
    if (gameState !== "playing") return;

    const now = performance.now();

    timeRemaining = Math.max(
      0,
      timeRemaining - (now - lastTick)
    );

    lastTick = now;

    // Only refresh the countdown when the second changes
    if (
      Number(timeDisplay.textContent) !==
      Math.ceil(timeRemaining / 1000)
    ) {
      updateDisplay();
    }

    if (timeRemaining === 0) {
      endGame();
    }
  }, 100);
}

/* START GAME */

function startGame() {
  stopTimers();
  clearEffects();

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

  // Create the first drop
  createDrop();

  // Start countdown and drop generation
  startTimers();
}

/* PAUSE AND RESUME */

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

function resumeGame() {
  if (gameState !== "paused") return;

  gameState = "playing";

  gameContainer.classList.remove("is-paused");
  overlay.hidden = true;

  pauseBtn.textContent = "Pause";

  playSound("button");
  startTimers();
}

/*  RESET AND DIFFICULTY */

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

function chooseDifficulty(mode) {
  if (!MODES[mode]) return;

  selectedMode = mode;

  playSound("button");

  // Restart when the difficulty changes
  resetGame();
}

/*  MILESTONE MESSAGES */

function showMilestone(message) {
  clearTimeout(bannerTimer);

  milestoneBanner.textContent = message;
  milestoneBanner.hidden = false;

  playSound("milestone");

  bannerTimer = setTimeout(() => {
    milestoneBanner.hidden = true;
  }, 2100);
}

function checkMilestones(previousScore) {
  const mode = settings();
  let newest = null;

  milestones.forEach((milestone, index) => {
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

/* CREATE FALLING ITEMS */

function createDrop() {
  if (gameState !== "playing") return;

  // Spawn a new falling item using the current difficulty settings.
  const mode = settings();
  const chance = Math.random();

  // Randomly choose the type of item
  const type = chance < mode.cleanChance
    ? "clean"
    : chance < mode.cleanChance + mode.dirtyChance
      ? "dirty"
      : chance < 0.98
        ? "trash"
        : "star";

  // Points for each item
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

  // Create a new item in the DOM
  const item = document.createElement("button");

  item.type = "button";
  item.className = `falling-item ${type}`;
  item.setAttribute("aria-label", labels[type]);

  // Large clickable area
  const size = 68 + Math.random() * 12;

  const maxLeft = Math.max(
    0,
    gameContainer.clientWidth - size - 12
  );

  item.style.width = `${size}px`;
  item.style.height = `${size}px`;

  // Random horizontal location
  item.style.left =
    `${6 + Math.random() * maxLeft}px`;

  // Safari fix: move with transform instead of top
  item.style.setProperty(
    "--drop-distance",
    `${gameContainer.clientHeight + 150}px`
  );

  // Falling speed depends on difficulty
  item.style.animationDuration = `${
    mode.minFall +
    Math.random() * (mode.maxFall - mode.minFall)
  }s`;

  // Choose the item's appearance
  item.innerHTML = type === "trash"
    ? "🗑️"
    : type === "star"
      ? "⭐"
      : '<span class="shape" aria-hidden="true"></span>';

  // Register collection instantly on the first press
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

  // Support keyboard input
  item.addEventListener("click", event => {
    if (event.detail === 0) {
      collectItem(item, points);
    }
  });

  // Remove items when they reach the ground
  item.addEventListener("animationend", event => {
    if (event.animationName !== "dropFall") return;

    if (
      gameState === "playing" &&
      item.isConnected &&
      type === "clean"
    ) {
      const now = performance.now();

      // Avoid a large number of missed-drop sounds
      if (now - lastMissSound > 650) {
        playSound("miss");
        lastMissSound = now;
      }
    }

    item.remove();
  });

  itemsLayer.appendChild(item);
}

/* COLLECT ITEMS AND AWARD POINTS */

function collectItem(item, points) {
  // Prevent duplicate collection
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

  // Remove the item immediately
  item.remove();

  const oldScore = score;

  score = Math.max(0, score + points);

  updateDisplay();
  showFeedback(x, y, points);

  // Play appropriate sound
  playSound(points > 0 ? "collect" : "obstacle");

  // Check milestone messages
  if (points > 0) {
    checkMilestones(oldScore);
  }
}

// Display floating point feedback
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

/* END GAME */

function endGame() {
  if (gameState === "finished") return;

  stopTimers();
  clearTimeout(bannerTimer);

  milestoneBanner.hidden = true;

  gameState = "finished";
  timeRemaining = 0;

  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pause";

  itemsLayer.replaceChildren();

  updateDisplay();
  saveHighScore(score);

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

/* CONFETTI CELEBRATION */

function celebrateWin() {
  const colors = [
    "#FFC907",
    "#2E9DF7",
    "#4FCB53",
    "#FF902A",
    "#F16061"
  ];

  confettiLayer.replaceChildren();

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

  confettiTimer = setTimeout(() => {
    confettiLayer.replaceChildren();
  }, 4200);
}

/* SAVE HIGH SCORES */

function scoreKey() {
  return selectedMode === "normal"
    ? "dropByDropScores"
    : `dropByDropScores:${selectedMode}`;
}

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
    // Storage may be blocked in private browsing
  }
}

/* GAME MENU HELPERS */

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

function actionButtons(...buttons) {
  return `
    <div class="dialog-actions">
      ${buttons.join("")}
    </div>
  `;
}

function backAction() {
  if (gameState === "paused") {
    return "pause";
  }

  if (gameState === "finished") {
    return score >= settings().goal
      ? "win"
      : "lose";
  }

  return "welcome";
}

// Difficulty buttons on the welcome screen
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
   GAME MENUS
========================================== */

function showPanel(screen) {
  const mode = settings();
  let html = "";

  // Welcome menu
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

  // Instructions
  else if (screen === "rules") {
    html = `
      <h2>How to Play</h2>

      <p>
        Tap or click the falling items
        before they hit the ground.
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

  // Pause screen
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

  // About screen
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
        Clean water helps communities thrive by
        improving health and supporting access
        to education.
      </p>

      <p>
        <a href="https://www.charitywater.org/"
           target="_blank" rel="noopener noreferrer">
          Visit charity: water ↗
        </a>
      </p>

      <p>
        <a href="https://www.charitywater.org/donate"
           target="_blank" rel="noopener noreferrer">
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

  // Display the selected menu
  overlayContent.innerHTML = html;
  overlay.hidden = false;

  const firstButton = overlayContent.querySelector("button");

  if (firstButton) {
    firstButton.focus({ preventScroll: true });
  }
}

/* ==========================================
   BUTTON EVENT LISTENERS
========================================== */

// Handle menu clicks
overlayContent.addEventListener("click", event => {
  // Difficulty choices
  const modeButton = event.target.closest("[data-mode]");

  if (modeButton) {
    chooseDifficulty(modeButton.dataset.mode);
    return;
  }

  const button = event.target.closest("[data-action]");

  if (!button) return;

  const action = button.dataset.action;

  if (action === "start") {
    startGame();
  } else if (action === "resume") {
    resumeGame();
  } else if (action === "reset") {
    playSound("button");
    resetGame();
  } else if (action === "back") {
    playSound("button");
    showPanel(backAction());
  } else if (
    ["rules", "about", "scores"].includes(action)
  ) {
    playSound("button");
    showPanel(action);
  }
});

// Pause button
pauseBtn.addEventListener("click", () => {
  if (gameState === "playing") {
    playSound("button");
    pauseGame();
  } else if (gameState === "paused") {
    resumeGame();
  }
});

// Reset button
document.getElementById("reset-btn").addEventListener(
  "click",
  () => {
    playSound("button");
    resetGame();
  }
);

// Pause when opening another menu
function openMenu(screen) {
  if (gameState === "playing") {
    pauseGame();
  }

  playSound("button");
  showPanel(screen);
}

// Header buttons
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

// Difficulty dropdown
difficultySelect.addEventListener("change", event => {
  const next = event.target.value;

  if (!MODES[next] || next === selectedMode) {
    return;
  }

  // Confirm before restarting an active game
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

// Turn sound on or off
soundBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;

  if (!soundEnabled) {
    stopAllSounds();
  } else {
    unlockAudio();
  }

  updateSoundButton();

  if (soundEnabled) {
    playSound("button");
  }
});

// Automatically pause if Safari switches tabs
document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameState === "playing") {
    pauseGame();
  }

  if (document.hidden) {
    stopAllSounds();
  }
});

/* ==========================================
   INITIALIZE GAME
========================================== */

updateSoundButton();
resetGame();
