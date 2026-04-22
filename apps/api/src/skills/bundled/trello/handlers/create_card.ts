const TRELLO_BASE = 'https://api.trello.com/1';

function getAuth(): { key: string; token: string } {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) throw new Error('TRELLO_API_KEY and TRELLO_TOKEN required');
  return { key, token };
}

export default async function createCard(params: { list_id: string; name: string; desc?: string; due?: string; labels?: string[] }): Promise<any> {
  const { list_id, name, desc, due, labels } = params;
  const { key, token } = getAuth();

  const body: any = { idList: list_id, name };
  if (desc) body.desc = desc;
  if (due) body.due = due;
  if (labels && labels.length > 0) body.idLabels = labels.join(',');

  const response = await fetch(`${TRELLO_BASE}/cards?key=${key}&token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`Trello API error: ${response.statusText}`);
  const card = await response.json();

  return { success: true, card: { id: card.id, name: card.name, url: card.url } };
}
