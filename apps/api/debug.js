import fs from 'fs';

async function test() {
  console.log('Sending request to API...');
  const res = await fetch('http://localhost:3001/api/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: 'research on antigravity', userId: 'test' })
  });
  
  if (!res.ok) {
    console.error('Failed HTTP:', res.status);
    return;
  }

  const reader = res.body?.getReader();
  if(!reader) return;
  const decoder = new TextDecoder();
  
  console.log('Stream open. Listening for events...');
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('Stream DONE.');
      break;
    }
    const chunk = decoder.decode(value);
    console.log('>>> CHUNK:', chunk);
  }
}
test().catch(console.error);
