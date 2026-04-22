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
        
        # Append unique delimiter to ensure synchronous completion
        delim = "__NEXUS_DONE__"
        full_command = f"{command}; echo '{delim}'\n"
        
        self.process.stdin.write(full_command)
        self.process.stdin.flush()
        
        # Wait blockingly until the shell prints the terminator
        while delim not in self.output_buffer:
            time.sleep(0.05)
            
        result = self.output_buffer.replace(f"{delim}\n", "").replace(delim, "").strip()
        return result if result else "✅ Command executed successfully (no output)."

# Global singleton session for the platform
session = NexusSession()
