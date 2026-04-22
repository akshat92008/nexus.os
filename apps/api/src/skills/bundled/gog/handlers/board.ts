import { games } from './new_game.js';

export default async function board(params: { game_id: string }): Promise<any> {
  const game = games.get(params.game_id);
  if (!game) throw new Error('Game not found');

  const size = game.size;
  const lines: string[] = [];
  const cols = 'ABCDEFGHJKLMNOPQRST';

  lines.push('  ' + cols.slice(0, size).split('').join(' '));

  for (let i = 0; i < size; i++) {
    const rowNum = String(size - i).padStart(2, ' ');
    const row = game.board[i].map(cell => {
      if (cell === 'black') return '●';
      if (cell === 'white') return '○';
      return '+';
    }).join(' ');
    lines.push(`${rowNum} ${row} ${rowNum}`);
  }

  lines.push('  ' + cols.slice(0, size).split('').join(' '));

  return {
    success: true,
    game_id: game.id,
    size: game.size,
    turn: game.turn,
    status: game.status,
    moves: game.moves.length,
    prisoners: game.prisoners,
    last_move: game.moves.length > 0 ? game.moves[game.moves.length - 1] : null,
    board_text: lines.join('\n')
  };
}
