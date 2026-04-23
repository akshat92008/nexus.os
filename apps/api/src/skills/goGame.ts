export type Stone = 'B' | 'W' | null;
export type Point = { x: number; y: number };

export class GoGame {
  board: Stone[][];
  size: number;
  turn: Stone = 'B';
  captures = { B: 0, W: 0 };
  ko: Point | null = null;
  history: string[] = [];

  constructor(s = 19) {
    this.size = s;
    this.board = Array.from({ length: s }, () => Array(s).fill(null) as Stone[]);
  }

  private key(p: Point): string {
    return `${p.x},${p.y}`;
  }

  private neighbors(p: Point): Point[] {
    return [
      { x: p.x - 1, y: p.y },
      { x: p.x + 1, y: p.y },
      { x: p.x, y: p.y - 1 },
      { x: p.x, y: p.y + 1 }
    ].filter(n => n.x >= 0 && n.x < this.size && n.y >= 0 && n.y < this.size);
  }

  private getGroup(start: Point): { stones: Point[]; liberties: Point[] } {
    const color = this.board[start.y][start.x];
    const stones: Point[] = [];
    const liberties: Point[] = [];
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length) {
      const p = queue.pop()!;
      const k = this.key(p);
      if (seen.has(k)) continue;
      seen.add(k);
      stones.push(p);
      for (const n of this.neighbors(p)) {
        const s = this.board[n.y][n.x];
        if (s === null) liberties.push(n);
        else if (s === color && !seen.has(this.key(n))) queue.push(n);
      }
    }
    return { stones, liberties };
  }

  private capture(p: Point): number {
    const g = this.getGroup(p);
    if (g.liberties.length > 0) return 0;
    for (const s of g.stones) this.board[s.y][s.x] = null;
    return g.stones.length;
  }

  private hashBoard(): string {
    return this.board.map(r => r.map(s => s ?? '.').join('')).join('|');
  }

  play(p: Point): { ok: boolean; captures: number; error?: string } {
    if (p.x < 0 || p.x >= this.size || p.y < 0 || p.y >= this.size)
      return { ok: false, captures: 0, error: 'off-board' };
    if (this.board[p.y][p.x] !== null)
      return { ok: false, captures: 0, error: 'occupied' };
    if (this.ko && p.x === this.ko.x && p.y === this.ko.y)
      return { ok: false, captures: 0, error: 'ko' };

    const snapshot = this.hashBoard();
    this.board[p.y][p.x] = this.turn;

    let caps = 0;
    for (const n of this.neighbors(p)) {
      if (this.board[n.y][n.x] !== null && this.board[n.y][n.x] !== this.turn) {
        caps += this.capture(n);
      }
    }

    const self = this.getGroup(p);
    if (self.liberties.length === 0 && caps === 0) {
      this.board[p.y][p.x] = null;
      return { ok: false, captures: 0, error: 'suicide' };
    }

    if (this.history.includes(this.hashBoard())) {
      this.board = snapshot.split('|').map(r => r.split('') as Stone[]);
      return { ok: false, captures: 0, error: 'repetition' };
    }

    this.captures[this.turn!] += caps;
    this.history.push(snapshot);

    this.ko = null;
    if (caps === 1 && self.stones.length === 1 && self.liberties.length === 1) {
      const cn = this.neighbors(p).find(n => this.board[n.y][n.x] === null);
      if (cn) this.ko = cn;
    }

    this.turn = this.turn === 'B' ? 'W' : 'B';
    return { ok: true, captures: caps };
  }

  pass(): void {
    this.turn = this.turn === 'B' ? 'W' : 'B';
  }

  score(): { B: number; W: number } {
    let B = this.captures.B;
    let W = this.captures.W;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const s = this.board[y][x];
        if (s === 'B') B++;
        else if (s === 'W') W++;
      }
    }
    return { B, W };
  }
}
