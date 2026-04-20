# Nexus OS Deployment Guide

## Setup
```bash
# Install dependencies
pnpm install

# Copy environment file
cp apps/api/.env.example apps/api/.env
```

## Required Environment Variables
```env
# Required:
OPENROUTER_API_KEY=sk_...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-here

# Optional:
LOG_LEVEL=info
NODE_ENV=production
```

## Deploy Steps

### Vercel
1. Connect repository to Vercel
2. Set root directory: `/`
3. Set build command: `pnpm build`
4. Add all environment variables
5. Deploy

### Render
1. Create new Web Service
2. Use Dockerfile: `apps/api/Dockerfile.production`
3. Add environment variables
4. Set health check path: `/api/health`
5. Deploy

## Test API Request
```bash
curl -X POST http://localhost:3000/api/llm/call \
  -H "Content-Type: application/json" \
  -d '{
    "system": "You are a helpful assistant",
    "user": "Hello world",
    "model": "MODEL_FAST"
  }'
```

---

## Logger Injection