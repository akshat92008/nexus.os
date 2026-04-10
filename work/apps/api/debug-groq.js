import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/ashishsingh/Desktop/nexus-os/apps/api/.env' });

async function test() {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            max_tokens: 900,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: "You are an assistant. Return JSON object. Please output valid JSON." },
              { role: "user", content: "Give me an example JSON object." }
            ]
        })
    });
    fs.writeFileSync('/Users/ashishsingh/Desktop/nexus-os/apps/api/test-result.txt', `STATUS: ${res.status}\n\n`);
    const json = await res.json();
    fs.appendFileSync('/Users/ashishsingh/Desktop/nexus-os/apps/api/test-result.txt', JSON.stringify(json, null, 2));
  } catch(e) {
    fs.writeFileSync('/Users/ashishsingh/Desktop/nexus-os/apps/api/test-result.txt', `ERROR: ${e.message}`);
  }
}
test();
