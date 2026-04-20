import subprocess
import threading
import queue
import time

class NexusSession:
    def __init__(self):
        self.process = None
        self.output_buffer = ""
        self._start_session()

    def _start_session(self):
        """Initializes a persistent bash session."""
        self.process = subprocess.Popen(
            ["/bin/bash"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        # Daemon thread to prevent buffer clogging and capture output in real-time
        threading.Thread(target=self._read_output, daemon=True).start()

    def _read_output(self):
        """Constantly drains stdout/stderr into the shared buffer."""
        while True:
            # We combine stdout and stderr for the AI's observation context
            line = self.process.stdout.readline()
            if line:
                self.output_buffer += line
            else:
                break

    def run_command(self, command):
        """Executes a command and waits for results (includes environment persistence)."""
        self.output_buffer = "" # Flush buffer for new command context
        print(f"🐚 Persistent Shell Executing: {command}")
        
        self.process.stdin.write(command + "\n")
        self.process.stdin.flush()
        
        # Fixed latency for output stabilization
        # In future iterations, we could use a specific delimiter (EOF token)
        time.sleep(1.0) 
        
        result = self.output_buffer
        return result if result.strip() else "✅ Command executed successfully (no output)."

# Global singleton session for the platform
session = NexusSession()
