const TRELLO_BASE = 'https://api.trello.com/1';

function getAuth(): { key: string; token: string } {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) throw new Error('TRELLO_API_KEY and TRELLO_TOKEN required');
  return { key, token };
}

export default async function listBoards(): Promise<any> {
  const { key, token } = getAuth();
  const response = await fetch(`${TRELLO_BASE}/members/me/boards?key=${key}&token=${token}`);

  if (!response.ok) throw new Error(`Trello API error: ${response.statusText}`);

  const boards = await response.json();

  return {
    success: true,
    boards: boards.map((b: any) => ({
      id: b.id,
      name: b.name,
      url: b.url,
      lists: b.lists?.map((l: any) => ({ id: l.id, name: l.name })) || []
    }))
  };
}
