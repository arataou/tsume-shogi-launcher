(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TsumeRules = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';

  const TYPES = Object.freeze(['R', 'B', 'G', 'S', 'N', 'L', 'P']);
  const PROMOTABLE = Object.freeze(['R', 'B', 'S', 'N', 'L', 'P']);

  function isInside(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 1 && x <= 9 && y >= 1 && y <= 9;
  }

  function promotionZone(owner, y) {
    return owner === 'attacker' ? y <= 3 : y >= 7;
  }

  function pathClear(board, from, to) {
    const sx = Math.sign(to[0] - from[0]);
    const sy = Math.sign(to[1] - from[1]);
    let x = from[0] + sx;
    let y = from[1] + sy;
    while (x !== to[0] || y !== to[1]) {
      if (board[y]?.[x]) return false;
      x += sx;
      y += sy;
    }
    return true;
  }

  function goldLike(dx, dy, forward) {
    return (dy === forward && Math.abs(dx) <= 1) || (dy === 0 && Math.abs(dx) === 1) || (dy === -forward && dx === 0);
  }

  function pieceAttacksSquare(piece, from, to, board) {
    if (!piece || !isInside(from[0], from[1]) || !isInside(to[0], to[1]) || (from[0] === to[0] && from[1] === to[1])) return false;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const forward = piece.owner === 'attacker' ? -1 : 1;
    if (piece.promoted && ['P', 'L', 'N', 'S'].includes(piece.type)) return goldLike(dx, dy, forward);
    if (piece.type === 'K') return adx <= 1 && ady <= 1;
    if (piece.type === 'G') return goldLike(dx, dy, forward);
    if (piece.type === 'S') return (dy === forward && adx <= 1) || (dy === -forward && adx === 1);
    if (piece.type === 'N') return dy === 2 * forward && adx === 1;
    if (piece.type === 'P') return dx === 0 && dy === forward;
    if (piece.type === 'L') return dx === 0 && dy * forward > 0 && pathClear(board, from, to);
    if (piece.type === 'R') return ((dx === 0 || dy === 0) && pathClear(board, from, to)) || (piece.promoted && adx === 1 && ady === 1);
    if (piece.type === 'B') return (adx === ady && pathClear(board, from, to)) || (piece.promoted && adx + ady === 1);
    return false;
  }

  function findKing(board, owner) {
    for (let y = 1; y <= 9; y++) for (let x = 1; x <= 9; x++) {
      if (board[y]?.[x]?.owner === owner && board[y][x].type === 'K') return [x, y];
    }
    return null;
  }

  function isKingAttacked(position, owner) {
    const board = position?.board;
    const king = findKing(board, owner);
    if (!king) return false;
    const enemy = owner === 'attacker' ? 'defender' : 'attacker';
    for (let y = 1; y <= 9; y++) for (let x = 1; x <= 9; x++) {
      const piece = board[y]?.[x];
      if (piece?.owner === enemy && pieceAttacksSquare(piece, [x, y], king, board)) return true;
    }
    return false;
  }

  function clonePosition(position) {
    return {
      board: (position?.board || []).map(row => (row || []).map(piece => piece ? { ...piece } : null)),
      hands: {
        attacker: { ...(position?.hands?.attacker || {}) },
        defender: { ...(position?.hands?.defender || {}) }
      }
    };
  }

  function applyMove(position, move, owner) {
    const board = position.board;
    const hands = position.hands;
    hands[owner] ||= {};
    if (move.drop) {
      hands[owner][move.drop] = Math.max(0, (hands[owner][move.drop] || 0) - 1);
      board[move.to[1]][move.to[0]] = { owner, type: move.drop, promoted: false };
      return position;
    }
    const piece = board[move.from[1]][move.from[0]];
    const captured = board[move.to[1]][move.to[0]];
    if (captured && captured.owner !== owner && captured.type !== 'K') hands[owner][captured.type] = (hands[owner][captured.type] || 0) + 1;
    board[move.from[1]][move.from[0]] = null;
    if (piece) {
      piece.promoted = piece.promoted || Boolean(move.promote);
      board[move.to[1]][move.to[0]] = piece;
    }
    return position;
  }

  function validateAttack(position, move) {
    const bad = message => ({ ok: false, message });
    if (!move || !Array.isArray(move.to) || !isInside(move.to[0], move.to[1])) return bad('目标格无效。');
    const board = position.board;
    const hands = position.hands;
    const target = board[move.to[1]]?.[move.to[0]];
    if (move.drop) {
      if (!TYPES.includes(move.drop) || Number(hands.attacker?.[move.drop] || 0) <= 0) return bad('持駒不足。');
      if (target) return bad('打駒必须落在空格。');
      if ((move.drop === 'P' || move.drop === 'L') && move.to[1] === 1 || move.drop === 'N' && move.to[1] <= 2) return bad('歩・香・桂はこの段に打てません。');
      if (move.drop === 'P') for (let y = 1; y <= 9; y++) if (board[y]?.[move.to[0]]?.owner === 'attacker' && board[y][move.to[0]].type === 'P' && !board[y][move.to[0]].promoted) return bad('二歩。');
    } else {
      if (!Array.isArray(move.from) || !isInside(move.from[0], move.from[1])) return bad('起点无效。');
      const piece = board[move.from[1]]?.[move.from[0]];
      if (!piece || piece.owner !== 'attacker') return bad('请选攻方棋子。');
      if (target?.owner === 'attacker') return bad('不能走到己方棋子上。');
      if (target?.owner === 'defender' && target.type === 'K') return bad('玉不能直接取。');
      if (!pieceAttacksSquare(piece, move.from, move.to, board)) return bad('この駒は指せません。');
      const inZone = promotionZone('attacker', move.from[1]) || promotionZone('attacker', move.to[1]);
      if (move.promote && (piece.promoted || !PROMOTABLE.includes(piece.type) || !inZone)) return bad('成れません。');
      if (!piece.promoted && !move.promote && ((piece.type === 'P' || piece.type === 'L') && move.to[1] === 1 || piece.type === 'N' && move.to[1] <= 2)) return bad('成りが必要です。');
    }
    const next = clonePosition(position);
    applyMove(next, move, 'attacker');
    if (isKingAttacked(next, 'attacker')) return bad('攻方玉が王手です。');
    if (!isKingAttacked(next, 'defender')) return bad('王手ではありません。');
    if (move.drop === 'P' && isCheckmate(next)) return bad('打步诘。');
    return { ok: true };
  }

  function isValidDefenderReply(position, move) {
    if (!move || !Array.isArray(move.to) || !isInside(move.to[0], move.to[1])) return false;
    const board = position.board;
    const hands = position.hands;
    const target = board[move.to[1]]?.[move.to[0]];
    if (move.drop) {
      if (!TYPES.includes(move.drop) || Number(hands.defender?.[move.drop] || 0) <= 0 || target) return false;
      if ((move.drop === 'P' || move.drop === 'L') && move.to[1] === 9 || move.drop === 'N' && move.to[1] >= 8) return false;
      if (move.drop === 'P') for (let y = 1; y <= 9; y++) if (board[y]?.[move.to[0]]?.owner === 'defender' && board[y][move.to[0]].type === 'P' && !board[y][move.to[0]].promoted) return false;
    } else {
      if (!Array.isArray(move.from) || !isInside(move.from[0], move.from[1])) return false;
      const piece = board[move.from[1]]?.[move.from[0]];
      if (!piece || piece.owner !== 'defender') return false;
      if (target?.owner === 'defender' || target?.type === 'K') return false;
      if (!pieceAttacksSquare(piece, move.from, move.to, board)) return false;
      const inZone = promotionZone('defender', move.from[1]) || promotionZone('defender', move.to[1]);
      if (move.promote && (piece.promoted || !PROMOTABLE.includes(piece.type) || !inZone)) return false;
      if (!piece.promoted && !move.promote && ((piece.type === 'P' || piece.type === 'L') && move.to[1] === 9 || piece.type === 'N' && move.to[1] >= 8)) return false;
    }
    const next = clonePosition(position);
    applyMove(next, move, 'defender');
    return !isKingAttacked(next, 'defender');
  }

  function hasLegalDefenderReply(position) {
    const board = position.board;
    const hands = position.hands;
    for (let y = 1; y <= 9; y++) for (let x = 1; x <= 9; x++) {
      const piece = board[y]?.[x];
      if (piece?.owner !== 'defender') continue;
      for (let targetY = 1; targetY <= 9; targetY++) for (let targetX = 1; targetX <= 9; targetX++) {
        const move = { from: [x, y], to: [targetX, targetY], promote: false };
        if (isValidDefenderReply(position, move)) return true;
        if (!piece.promoted && PROMOTABLE.includes(piece.type) && (promotionZone('defender', y) || promotionZone('defender', targetY)) && isValidDefenderReply(position, { ...move, promote: true })) return true;
      }
    }
    for (const type of TYPES) {
      if (Number(hands.defender?.[type] || 0) <= 0) continue;
      for (let y = 1; y <= 9; y++) for (let x = 1; x <= 9; x++) {
        if (isValidDefenderReply(position, { drop: type, to: [x, y], promote: false })) return true;
      }
    }
    return false;
  }

  function isCheckmate(position) {
    return isKingAttacked(position, 'defender') && !hasLegalDefenderReply(position);
  }

  return Object.freeze({
    TYPES,
    PROMOTABLE,
    applyMove,
    clonePosition,
    isCheckmate,
    isInside,
    isKingAttacked,
    isValidDefenderReply,
    pieceAttacksSquare,
    promotionZone,
    validateAttack
  });
});
