FROM python:3.11
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# 1. Install dependencies separately for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. STRICT ISOLATION: Only copy the brain logic
COPY brain.py .

# 3. Launch with modern ASGI settings
CMD ["uvicorn", "brain:app", "--host", "0.0.0.0", "--port", "8080"]
