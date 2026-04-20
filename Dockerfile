FROM python:3.11
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# 1. Install dependencies separately for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Copy the modular brain architecture
COPY main.py .
COPY brain/ ./brain/
COPY agents/ ./agents/

# 3. Launch with modern ASGI settings
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
