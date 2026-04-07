# 🌌 Nexus OS: High-Reasoning Agentic Platform

Nexus OS is the first **Distributed Agentic Reasoning Engine**. It doesn't just generate text; it orchestrates specialized AI agents through complex, multi-wave missions with absolute strategic accuracy.

---

### 🚀 **Nexus Alpha: The Core Engine**
*   **Council of Three**: Critical tasks are resolved by 3 logical judges (2 specialists + 1 judge).
*   **Deep Semantic Audit**: Detects contradictions and auto-remediates mission gaps.
*   **Observability Canvas**: Real-time graph visualization of agentic reasoning lineage.
*   **Global Governor**: Centralized rate-limit management and recovery waves.

---

### 📖 **Detailed Product Overview**
For a complete breakdown of the product vision, technical architecture, reasoning logic, and user manual, please see:

👉 **[Nexus OS: Product Overview (v1.0.0)](file:///Users/ashishsingh/Desktop/nexus-os/PRODUCT_OVERVIEW.md)**

---

### 🛠️ **Installation & Setup**

#### Prerequisites
- Node.js 20+
- pnpm 9+ (`npm i -g pnpm`)

#### 1. Install dependencies
```bash
pnpm install
```

#### 2. Configure environment
```bash
# API config
cp .env.example apps/api/.env
# → Set GROQ_API_KEY and SUPABASE_URL

# Frontend config
cp .env.example apps/web/.env.local
# → Set NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### 3. Run the full stack
```bash
pnpm dev
# API → http://localhost:3001
# Web → http://localhost:3000
```

---

### 🏗️ **Architecture Snapshot**
```
nexus-os/                          ← pnpm monorepo root
├── apps/
│   ├── api/                       ← Express backend (Master Brain, Council of Three)
│   └── web/                       ← Next.js 14 Frontend (Observability Canvas)
└── packages/
    └── types/                     ← Shared TypeScript contract
```

---

**Built for the future of Agentic Intelligence.**
[GitHub Repository](https://github.com/akshat92008/nexus.os)
