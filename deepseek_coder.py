import os
from openai import OpenAI
from rich.console import Console
from rich.markdown import Markdown
from rich.live import Live
import sys

# Configuration
NVIDIA_API_KEY = "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"
MODEL = "deepseek-ai/deepseek-v4-pro"

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=NVIDIA_API_KEY
)

console = Console()

def chat():
    messages = [
        {
            "role": "system", 
            "content": "You are DeepSeek V4, a world-class coding assistant. Provide expert-level code, architectural advice, and debugging help. Always use markdown for code blocks. Be concise but thorough."
        }
    ]
    
    console.clear()
    console.print("[bold blue]🚀 DeepSeek V4 Coding Assistant[/bold blue]")
    console.print("[dim]Powered by NVIDIA NIM | Type 'exit' or 'clear' to manage session[/dim]\n")

    while True:
        try:
            user_input = console.input("[bold cyan]user[/bold cyan] [dim]❯[/dim] ")
            
            if not user_input.strip():
                continue
                
            if user_input.lower() in ['exit', 'quit']:
                console.print("[yellow]Goodbye![/yellow]")
                break
            
            if user_input.lower() == 'clear':
                console.clear()
                messages = [messages[0]]
                console.print("[bold blue]🚀 DeepSeek V4 Coding Assistant (Session Cleared)[/bold blue]\n")
                continue
            
            messages.append({"role": "user", "content": user_input})
            
            full_response = ""
            console.print("\n[bold magenta]deepseek[/bold magenta] [dim]❯[/dim]")
            
            with Live(console=console, refresh_per_second=12, vertical_overflow="visible") as live:
                completion = client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    temperature=0.1,  # Lower for high precision coding
                    top_p=0.95,
                    max_tokens=16384,
                    extra_body={"chat_template_kwargs": {"thinking": False}},
                    stream=True
                )

                for chunk in completion:
                    if chunk.choices and chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        full_response += content
                        live.update(Markdown(full_response))

            messages.append({"role": "assistant", "content": full_response})
            console.print("\n" + "─" * 40 + "\n")

        except KeyboardInterrupt:
            console.print("\n[yellow]Interrupted. Type 'exit' to quit.[/yellow]")
            continue
        except Exception as e:
            console.print(f"\n[bold red]Error:[/bold red] {e}")

if __name__ == "__main__":
    chat()
