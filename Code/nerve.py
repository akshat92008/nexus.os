import requests
import subprocess

# MATCHING THE BRAIN PORT: 8095
BRAIN_URL = "http://localhost:8095/think"

def execute_command(command):
    if not command: return "No command received."
    print(f"🛠️  Executing: {command}")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        return result.stdout if result.stdout else result.stderr
    except Exception as e:
        return str(e)

def main():
    print("\n" + "="*40)
    print("🌟 NEXUS OS: SYSTEM ACTIVE 🌟")
    print("="*40)
    
    while True:
        user_input = input("\nCEO > ")
        if user_input.lower() == 'exit': break
        
        try:
            response = requests.post(BRAIN_URL, json={"input": user_input}, timeout=10).json()
            intent = response.get("intent")
            cmd = response.get("command")
            explanation = response.get("explanation")

            if not cmd:
                print("❌ Brain returned no command.")
                continue

            print(f"\n🧠 Brain Analysis: {explanation}")
            if intent == "power":
                confirm = input(f"⚠️  Confirm execution of [{cmd}]? (y/n): ")
                if confirm.lower() != 'y':
                    print("❌ Cancelled.")
                    continue

            output = execute_command(cmd)
            print(f"\n✅ Output:\n{output}")
        except Exception as e:
            print(f"❌ Brain Offline or Error: {e}")

if __name__ == "__main__":
    main()
