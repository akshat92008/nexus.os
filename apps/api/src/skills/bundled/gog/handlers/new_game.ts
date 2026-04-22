import { randomUUID } from 'crypto';

interface GoGame {
  id: string;
  size: number;
  komi: number;
  handicap: number;
  board: (string | null)[][];
  turn: 'black' | 'white';
  moves: Array<{ color: string; coordinate: string; captures: number }>;
  prisoners: { black: number; white: number };
  passes: number;
  status: 'active' | 'scoring' | 'finished';
}

const games = new Map<string, GoGame>();

export default async function newGame(params: { size?: number; komi?: number; handicap?: number }): Promise<any> {
  const size = params.size || 19;
  const komi = params.komi ?? 7.5;
  const handicap = params.handicap || 0;

  const board: (string | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));

  // Place handicap stones if any
  if (handicap > 0) {
    const handicapCoords = getHandicapCoords(size, handicap);
    for (const [row, col] of handicapCoords) {
      board[row][col] = 'black';
    }
  }

  const game: GoGame = {
    id: randomUUID(),
    size,
    komi,
    handicap,
    board,
    turn: handicap > 1 ? 'white' : 'black',
    moves: [],
    prisoners: { black: 0, white: 0 },
    passes: 0,
    status: 'active'
  };

  games.set(game.id, game);

  return {
    success: true,
    game_id: game.id,
    size,
    komi,
    handicap,
    turn: game.turn,
    board_text: renderBoard(board)
  };
}

function getHandicapCoords(size: number, handicap: number): Array<[number, number]> {
  const coords9 = [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4], [2, 4], [4, 2], [4, 6], [6, 4]];
  const coords13 = [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6], [3, 6], [6, 3], [6, 9], [9, 6]];
  const coords19 = [[3, 3], [3, 15], [15, 3], [15, 15], [9, 9], [3, 9], [9, 3], [9, 15], [15, 9]];

  const map = size === 9 ? coords9 : size === 13 ? coords13 : coords19;
  return map.slice(0, handicap);
}

function renderBoard(board: (string | null)[][]): string {
  const size = board.length;
  const lines: string[] = [];
  const cols = 'ABCDEFGHJKLMNOPQRST';

  // Header
  lines.push('  ' + cols.slice(0, size).split('').join(' '));

  for (let i = 0; i < size; i++) {
    const rowNum = String(size - i).padStart(2, ' ');
    const row = board[i].map(cell => {
      if (cell === 'black') return '●';
      if (cell === 'white') return '○';
      return '+';
    }).join(' ');
    lines.push(`${rowNum} ${row} ${rowNum}`);
  }

  lines.push('  ' + cols.slice(0, size).split('').join(' '));
  return lines.join('\n');
}

export { games };
