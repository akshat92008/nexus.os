import http.server, json, urllib.request, os

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = json.loads(self.rfile.read(content_length))
        
        # 🛡️ THE FIREWALL: Forcefully remove the incompatible keys
        body.pop('output_config', None)
        if 'stream' in body: body['stream'] = False # Disable streaming for maximum stability
        
        # Translate to Groq (OpenAI format)
        groq_req = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": m['role'], "content": m['content']} for m in body.get('messages', [])],
            "max_tokens": body.get('max_tokens', 4096)
        }

        # Forward to Groq
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=json.dumps(groq_req).encode(),
            headers={
                "Authorization": f"Bearer {os.environ.get('GROQ_API_KEY')}",
                "Content-Type": "application/json"
            }
        )
        
        try:
            with urllib.request.urlopen(req) as response:
                # Translate back to Anthropic (Claude) format
                raw_res = json.loads(response.read().decode())
                claude_res = {
                    "id": raw_res['id'],
                    "type": "message",
                    "role": "assistant",
                    "content": [{"type": "text", "text": raw_res['choices'][0]['message']['content']}],
                    "model": "claude-3-5-sonnet-20241022",
                    "usage": {"input_tokens": 0, "output_tokens": 0}
                }
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(claude_res).encode())
        except Exception as e:
            self.send_response(500); self.end_headers(); self.wfile.write(str(e).encode())

print("🚀 MASTER BRIDGE RUNNING ON http://localhost:4000"); http.server.HTTPServer(('0.0.0.0', 4000), ProxyHandler).serve_forever()
