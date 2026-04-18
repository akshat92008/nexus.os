const models = [
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-7b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free"
];

async function verifyModel(model) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 5
      })
    });

    if (response.status === 200) return 'WORKS';
    if (response.status === 404) return '404';
    if (response.status === 429) return '429';
    return 'ERROR: ' + response.status;
  } catch (error) {
    return 'ERROR: ' + error.message;
  }
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set");
    process.exit(1);
  }
  for (const model of models) {
    const result = await verifyModel(model);
    console.log(model + ': ' + result);
  }
}

main();
