const test = require('node:test');
const assert = require('node:assert/strict');

const rules = require('../outputs/ShogiExplorer-Tsume/tsume-rules.js');

function makePosition(pieces, attackerHands = {}, defenderHands = {}) {
  const board = Array.from({ length: 10 }, () => Array(10).fill(null));
  for (const piece of pieces) {
    board[piece.y][piece.x] = {
      owner: piece.owner,
      type: piece.type,
      promoted: Boolean(piece.promoted)
    };
  }
  const hands = {
    attacker: Object.fromEntries(rules.TYPES.map(type => [type, 0])),
    defender: Object.fromEntries(rules.TYPES.map(type => [type, 0]))
  };
  Object.assign(hands.attacker, attackerHands);
  Object.assign(hands.defender, defenderHands);
  return { board, hands };
}

function pawnDropMatePosition(drop = 'P') {
  return makePosition([
    { x: 5, y: 1, owner: 'defender', type: 'K' },
    { x: 4, y: 3, owner: 'attacker', type: 'R' },
    { x: 6, y: 3, owner: 'attacker', type: 'R' },
    { x: 5, y: 3, owner: 'attacker', type: 'G' }
  ], { [drop]: 1 });
}

test('rejects pawn-drop mate without changing the position', () => {
  const position = pawnDropMatePosition();
  const before = JSON.stringify(position);

  const result = rules.validateAttack(position, { drop: 'P', to: [5, 2], promote: false });

  assert.deepEqual(result, { ok: false, message: '打步诘。' });
  assert.equal(JSON.stringify(position), before);
});

test('accepts a pawn drop check when the defender has an escape', () => {
  const position = makePosition([
    { x: 5, y: 1, owner: 'defender', type: 'K' }
  ], { P: 1 });

  const result = rules.validateAttack(position, { drop: 'P', to: [5, 2], promote: false });

  assert.deepEqual(result, { ok: true });
});

test('does not reject a mating drop of another piece as pawn-drop mate', () => {
  const position = pawnDropMatePosition('G');

  const result = rules.validateAttack(position, { drop: 'G', to: [5, 2], promote: false });

  assert.deepEqual(result, { ok: true });
});
