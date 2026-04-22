import { games, type GoGame } from './new_game.js';

export default async function move(params: { game_id: string; coordinate: string; color: string }): Promise<any> {
  const { game_id, coordinate, color } = params;
  const game = games.get(game_id);
  if (!game) throw new Error('Game not found');
  if (game.status !== 'active') throw new Error('Game is finished');

  const isPass = coordinate.toLowerCase() === 'pass';

  if (isPass) {
    game.passes++;
    game.moves.push({ color, coordinate: 'pass', captures: 0 });

    if (game.passes >= 2) {
      game.status = 'scoring';
    }

    game.turn = game.turn === 'black' ? 'white' : 'black';

    return {
      success: true,
      move: { color, coordinate: 'pass' },
      passes: game.passes,
      status: game.status,
      turn: game.turn
    };
  }

  const [col, row] = parseCoordinate(coordinate, game.size);
  if (col === -1 || row === -1) throw new Error('Invalid coordinate');

  if (game.board[row][col] !== null) {
    throw new Error('Position occupied');
  }

  game.board[row][col] = color as 'black' | 'white';

  // Check captures (simplified - adjacent opponent stones with no liberties)
  const captures = checkCaptures(game.board, row, col, color as 'black' | 'white', game.size);
  if (color === 'black') {
    game.prisoners.black += captures;
  } else {
    game.prisoners.white += captures;
  }

  game.passes = 0;
  game.turn = game.turn === 'black' ? 'white' : 'black';
  game.moves.push({ color, coordinate, captures });

  return {
    success: true,
    move: { color, coordinate, captures },
    prisoners: game.prisoners,
    turn: game.turn,
    move_number: game.moves.length
  };
}

function parseCoordinate(coord: string, size: number): [number, number] {
  const col = coord.charCodeAt(0) - 'A'.charCodeAt(0);
  if (col >= 8) return [-1, -1]; // 'I' is skipped in Go notation

  const row = size - parseInt(coord.slice(1));
  if (isNaN(row) || row < 0 || row >= size) return [-1, -1];

  return [col >= 8 ? col - 1 : col, row];
}

function checkCaptures(board: (string | null)[][], row: number, col: number, color: 'black' | 'white', size: number): number {
  // Simplified capture logic - captures adjacent opponent groups with no liberties
  const opponent = color === 'black' ? 'white' : 'black';
  let totalCaptures = 0;

  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (const [dr, dc] of directions) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === opponent) {
      if (countLiberties(board, nr, nc, opponent, size, new Set()) === 0) {
        totalCaptures += removeGroup(board, nr, nc, opponent, size);
      }
    }
  }

  return totalCaptures;
}

function countLiberties(board: (string | null)[][], row: number, col: number, color: string, size: number, visited: Set<string>): number {
  const key = `${row},${col}`;
  if (visited.has(key)) return 0;
  visited.add(key);

  let liberties = 0;
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (const [dr, dc] of directions) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      if (board[nr][nc] === null) liberties++;
      else if (board[nr][nc] === color) liberties += countLiberties(board, nr, nc, color, size, visited);
    }
  }

  return liberties;
}

function removeGroup(board: (string | null)[][], row: number, col: number, color: string, size: number): number {
  let count = 0;
  const toRemove: Array<[number, number]> = [[row, col]];
  const visited = new Set<string>();
  visited.add(`${row},${col}`);

  while (toRemove.length > 0) {
    const [r, c] = toRemove.pop()!;
    if (board[r][c] === color) {
      board[r][c] = null;
      count++;

      const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visited.has(key) && board[nr][nc] === color) {
          visited.add(key);
          toRemove.push([nr, nc]);
        }
      }
    }
  }

  return count;
}
