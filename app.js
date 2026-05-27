const suits = [
  { symbol: "♠", color: "black", foundation: "spades" },
  { symbol: "♥", color: "red", foundation: "hearts" },
  { symbol: "♦", color: "red", foundation: "diamonds" },
  { symbol: "♣", color: "black", foundation: "clubs" },
];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const state = {
  stock: [],
  waste: [],
  foundations: { spades: [], hearts: [], diamonds: [], clubs: [] },
  tableau: Array.from({ length: 7 }, () => []),
  selected: null,
  moves: 0,
  seconds: 0,
  timer: null,
  started: false,
};

const el = {
  stock: document.querySelector("#stock"),
  waste: document.querySelector("#waste"),
  foundations: document.querySelector("#foundations"),
  tableau: document.querySelector("#tableau"),
  moves: document.querySelector("#moves"),
  time: document.querySelector("#time"),
  message: document.querySelector("#message"),
  newGame: document.querySelector("#new-game"),
  playAgain: document.querySelector("#play-again"),
  winDialog: document.querySelector("#win-dialog"),
  winSummary: document.querySelector("#win-summary"),
};

function createDeck() {
  return suits.flatMap((suit) =>
    ranks.map((rank, index) => ({
      id: `${rank}${suit.symbol}`,
      rank,
      value: index + 1,
      suit: suit.symbol,
      color: suit.color,
      foundation: suit.foundation,
      faceUp: false,
    })),
  );
}

function shuffle(deck) {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function startGame() {
  const deck = shuffle(createDeck());
  state.stock = [];
  state.waste = [];
  state.foundations = { spades: [], hearts: [], diamonds: [], clubs: [] };
  state.tableau = Array.from({ length: 7 }, () => []);
  state.selected = null;
  state.moves = 0;
  state.seconds = 0;
  state.started = false;
  clearInterval(state.timer);
  state.timer = null;

  for (let column = 0; column < 7; column += 1) {
    for (let row = 0; row <= column; row += 1) {
      const card = deck.pop();
      card.faceUp = row === column;
      state.tableau[column].push(card);
    }
  }
  state.stock = deck;
  setMessage("Перетаскивайте карты или кликайте по ним для автопереноса.");
  render();
}

function startTimer() {
  if (state.started) return;
  state.started = true;
  state.timer = setInterval(() => {
    state.seconds += 1;
    renderStats();
  }, 1000);
}

function render() {
  renderStats();
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
  markSelection();
}

function renderStats() {
  el.moves.textContent = state.moves;
  const minutes = String(Math.floor(state.seconds / 60)).padStart(2, "0");
  const seconds = String(state.seconds % 60).padStart(2, "0");
  el.time.textContent = `${minutes}:${seconds}`;
}

function renderStock() {
  el.stock.className = `pile stock${state.stock.length ? " has-cards" : ""}`;
  el.stock.dataset.label = state.stock.length ? "" : "↺";
  el.stock.title = state.stock.length ? `${state.stock.length} карт в колоде` : "Вернуть сброс в колоду";
}

function renderWaste() {
  el.waste.innerHTML = "";
  el.waste.dataset.label = state.waste.length ? "" : "Сброс";
  const card = topCard(state.waste);
  if (card) el.waste.appendChild(createCardElement(card, { pile: "waste", index: state.waste.length - 1 }));
}

function renderFoundations() {
  el.foundations.innerHTML = "";
  suits.forEach((suit) => {
    const pile = document.createElement("div");
    pile.className = "pile foundation";
    pile.setAttribute("role", "button");
    pile.tabIndex = 0;
    pile.dataset.foundation = suit.foundation;
    pile.dataset.label = suit.symbol;
    pile.ariaLabel = `Фундамент ${suit.symbol}`;
    pile.addEventListener("click", () => handleFoundationClick(suit.foundation));
    pile.addEventListener("dragover", allowDrop);
    pile.addEventListener("dragleave", clearDrop);
    pile.addEventListener("drop", (event) => handleDropOnFoundation(event, suit.foundation));

    const card = topCard(state.foundations[suit.foundation]);
    if (card) pile.appendChild(createCardElement(card, { pile: "foundation", foundation: suit.foundation }));
    el.foundations.appendChild(pile);
  });
}

function renderTableau() {
  el.tableau.innerHTML = "";
  state.tableau.forEach((column, columnIndex) => {
    const pile = document.createElement("div");
    pile.className = `column${column.length ? " has-stack" : ""}`;
    pile.dataset.column = columnIndex;
    pile.dataset.label = "K";
    pile.style.setProperty("--extra", Math.max(0, column.length - 1));
    pile.addEventListener("click", (event) => handleColumnClick(event, columnIndex));
    pile.addEventListener("dragover", allowDrop);
    pile.addEventListener("dragleave", clearDrop);
    pile.addEventListener("drop", (event) => handleDropOnColumn(event, columnIndex));

    column.forEach((card, index) => {
      pile.appendChild(createCardElement(card, { pile: "tableau", column: columnIndex, index }));
    });
    el.tableau.appendChild(pile);
  });
}

function createCardElement(card, location) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `card ${card.color}${card.faceUp ? "" : " face-down"}`;
  button.style.setProperty("--i", location.index ?? 0);
  button.dataset.cardId = card.id;
  button.dataset.location = JSON.stringify(location);
  button.draggable = card.faceUp;
  button.ariaLabel = card.faceUp ? `${card.rank} ${card.suit}` : "Закрытая карта";
  button.innerHTML = `
    <span class="rank">${card.rank}</span>
    <span class="pip">${card.suit}</span>
    <span class="suit">${card.suit}</span>
  `;
  button.addEventListener("click", (event) => handleCardClick(event, location));
  button.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    autoMove(location);
  });
  button.addEventListener("dragstart", (event) => handleDragStart(event, location));
  button.addEventListener("dragend", () => document.querySelectorAll(".dragging").forEach((node) => node.classList.remove("dragging")));
  return button;
}

function handleStockClick() {
  startTimer();
  clearSelection();
  if (state.stock.length) {
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
    countMove();
    setMessage("Карта открыта из колоды.");
  } else if (state.waste.length) {
    state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    state.waste = [];
    countMove();
    setMessage("Сброс вернулся в колоду.");
  }
  render();
}

function handleCardClick(event, location) {
  event.stopPropagation();
  const card = getCard(location);
  if (!card?.faceUp) return;
  startTimer();

  if (state.selected) {
    const moved = location.pile === "foundation"
      ? moveSelectionToFoundation(location.foundation)
      : moveSelectionToColumn(location.column);
    if (moved) return;
  }

  state.selected = location;
  setMessage("Выбрана карта. Кликните по месту назначения.");
  render();
}

function handleColumnClick(event, columnIndex) {
  if (event.target !== event.currentTarget) return;
  if (state.selected) moveSelectionToColumn(columnIndex);
}

function handleFoundationClick(foundation) {
  if (state.selected) moveSelectionToFoundation(foundation);
}

function handleDragStart(event, location) {
  const card = getCard(location);
  if (!card?.faceUp) {
    event.preventDefault();
    return;
  }
  state.selected = location;
  event.dataTransfer.setData("application/json", JSON.stringify(location));
  event.currentTarget.classList.add("dragging");
}

function allowDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.add("drop-ready");
}

function clearDrop(event) {
  event.currentTarget.classList.remove("drop-ready");
}

function handleDropOnColumn(event, columnIndex) {
  event.preventDefault();
  clearDrop(event);
  const location = readDragLocation(event);
  if (location) {
    state.selected = location;
    moveSelectionToColumn(columnIndex);
  }
}

function handleDropOnFoundation(event, foundation) {
  event.preventDefault();
  clearDrop(event);
  const location = readDragLocation(event);
  if (location) {
    state.selected = location;
    moveSelectionToFoundation(foundation);
  }
}

function readDragLocation(event) {
  try {
    return JSON.parse(event.dataTransfer.getData("application/json"));
  } catch {
    return null;
  }
}

function moveSelectionToColumn(columnIndex) {
  const moving = selectedCards();
  if (!moving.length || !canPlaceOnTableau(moving[0], state.tableau[columnIndex])) {
    setMessage("Сюда карту положить нельзя.");
    clearSelection();
    render();
    return false;
  }
  removeSelectedCards();
  state.tableau[columnIndex].push(...moving);
  afterMove("Карта перенесена в столбец.");
  return true;
}

function moveSelectionToFoundation(foundation) {
  const moving = selectedCards();
  if (moving.length !== 1 || !canPlaceOnFoundation(moving[0], foundation)) {
    setMessage("На фундамент можно класть только следующую карту той же масти.");
    clearSelection();
    render();
    return false;
  }
  removeSelectedCards();
  state.foundations[foundation].push(moving[0]);
  afterMove("Карта перенесена на фундамент.");
  return true;
}

function autoMove(location) {
  state.selected = location;
  const card = getCard(location);
  if (!card?.faceUp) return;

  if (canPlaceOnFoundation(card, card.foundation) && selectedCards().length === 1) {
    moveSelectionToFoundation(card.foundation);
    return;
  }

  const columnIndex = state.tableau.findIndex((column) => canPlaceOnTableau(card, column));
  if (columnIndex >= 0) moveSelectionToColumn(columnIndex);
}

function afterMove(message) {
  startTimer();
  countMove();
  revealTableauCards();
  clearSelection();
  setMessage(message);
  render();
  checkWin();
}

function revealTableauCards() {
  state.tableau.forEach((column) => {
    const card = topCard(column);
    if (card && !card.faceUp) card.faceUp = true;
  });
}

function selectedCards() {
  if (!state.selected) return [];
  if (state.selected.pile === "waste") return state.waste.length ? [topCard(state.waste)] : [];
  if (state.selected.pile === "foundation") return state.foundations[state.selected.foundation].length ? [topCard(state.foundations[state.selected.foundation])] : [];
  return state.tableau[state.selected.column].slice(state.selected.index);
}

function removeSelectedCards() {
  const location = state.selected;
  if (location.pile === "waste") {
    return state.waste.pop();
  }
  if (location.pile === "foundation") {
    return state.foundations[location.foundation].pop();
  }
  return state.tableau[location.column].splice(location.index);
}

function canPlaceOnTableau(card, column) {
  const target = topCard(column);
  if (!target) return card.value === 13;
  return target.faceUp && target.color !== card.color && target.value === card.value + 1;
}

function canPlaceOnFoundation(card, foundation) {
  if (card.foundation !== foundation) return false;
  const target = topCard(state.foundations[foundation]);
  if (!target) return card.value === 1;
  return target.value + 1 === card.value;
}

function getCard(location) {
  if (location.pile === "waste") return topCard(state.waste);
  if (location.pile === "foundation") return topCard(state.foundations[location.foundation]);
  return state.tableau[location.column][location.index];
}

function topCard(pile) {
  return pile[pile.length - 1];
}

function countMove() {
  state.moves += 1;
}

function clearSelection() {
  state.selected = null;
}

function markSelection() {
  document.querySelectorAll(".selected").forEach((node) => node.classList.remove("selected"));
  if (!state.selected) return;
  selectedCards().forEach((card) => {
    document.querySelector(`[data-card-id="${CSS.escape(card.id)}"]`)?.classList.add("selected");
  });
}

function setMessage(text) {
  el.message.textContent = text;
}

function checkWin() {
  const complete = Object.values(state.foundations).every((foundation) => foundation.length === 13);
  if (!complete) return;
  clearInterval(state.timer);
  el.winSummary.textContent = `Время: ${el.time.textContent}. Ходов: ${state.moves}.`;
  el.winDialog.showModal();
}

el.stock.addEventListener("click", handleStockClick);
el.newGame.addEventListener("click", startGame);
el.playAgain.addEventListener("click", () => {
  el.winDialog.close();
  startGame();
});
document.addEventListener("click", () => {
  if (state.selected) {
    clearSelection();
    render();
  }
});

startGame();
