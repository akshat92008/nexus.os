const TRELLO_BASE = 'https://api.trello.com/1';

function getAuth(): { key: string; token: string } {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) throw new Error('TRELLO_API_KEY and TRELLO_TOKEN required');
  return { key, token };
}

export default async function listCards(params: { list_id: string }): Promise<any> {
  const { list_id } = params;
  const { key, token } = getAuth();

  const response = await fetch(`${TRELLO_BASE}/lists/${list_id}/cards?key=${key}&token=${token}`);
  if (!response.ok) throw new Error(`Trello API error: ${response.statusText}`);

  const cards = await response.json();

  return {
    success: true,
    list_id,
    cards: cards.map((c: any) => ({
      id: c.id,
      name: c.name,
      desc: c.desc,
      due: c.due,
      labels: c.labels?.map((l: any) => l.name || l.color) || []
    }))
  };
}
