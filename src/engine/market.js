// One Market type for all four shared markets (03-markets.md).
// Slots are ordered by age: index 0 is the oldest (left), the end is the newest (right).
import { shuffle } from "./rng.js";

export function makeMarket(type, size, deck, monsterDeck = null) {
  const m = { type, size, deck, discard: [], slots: [] };
  if (type === "terrain") { m.monsterDeck = monsterDeck; m.monsterDiscard = []; }
  return m;
}

function drawFrom(state, m, deckKey, discardKey) {
  if (!m[deckKey].length && m[discardKey].length) {
    m[deckKey] = shuffle(state, m[discardKey].splice(0)); // reshuffle discards (Q-24)
  }
  return m[deckKey].pop() ?? null;
}

export function drawCard(state, m) {
  if (m.type === "terrain") {
    const terrain = drawFrom(state, m, "deck", "discard");
    const monster = drawFrom(state, m, "monsterDeck", "monsterDiscard");
    if (!terrain || !monster) {
      if (terrain) m.discard.push(terrain);
      if (monster) m.monsterDiscard.push(monster);
      return null;
    }
    return { terrain, monster };
  }
  return drawFrom(state, m, "deck", "discard");
}

function discardSlot(m, card) {
  if (m.type === "terrain") { m.discard.push(card.terrain); m.monsterDiscard.push(card.monster); }
  else m.discard.push(card);
}

export function refill(state, m) {
  while (m.slots.length < m.size) {
    const c = drawCard(state, m);
    if (!c) break;
    m.slots.push(c);
  }
}

/** Take a card: cards to its right shift left, a new card fills the right-most slot. */
export function take(state, m, i) {
  if (!(i >= 0 && i < m.slots.length)) return null;
  const [card] = m.slots.splice(i, 1);
  refill(state, m);
  return card;
}

/** Start of round: discard the oldest card, shift, refill. */
export function shiftOldest(state, m) {
  if (m.slots.length) discardSlot(m, m.slots.shift());
  refill(state, m);
}
