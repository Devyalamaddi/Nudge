# Minimi Chat Agent with Web Search

> A high-performance, temporally-grounded chat agent with strictly one tool: `web_search`.  
> Built for the Minimi Hiring Challenge.

![Node Version](https://img.shields.io/badge/Node-v18%2B-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ⚡ Quickstart

### 1. Clone & Install
```bash
git clone <repo-url>
cd <repo-folder>
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your API keys:
- **LLM:** `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`)
- **Search:** `TAVILY_API_KEY` (or `BRAVE_API_KEY`, `SERPER_API_KEY`)

*(Note: If no search key is provided, the agent automatically falls back to an internal DuckDuckGo search parser so it can run immediately without third-party accounts.)*

### 3. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Testing the Evaluation Dataset Scenarios

The test dataset contains challenging temporal queries that require recalling past interactions and verifying changes since specific dates:

| Evaluation Prompt | Core Architectural Challenge | How Minimi Handles It |
| :--- | :--- | :--- |
| **"On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"** | Cross-session memory recall, relative date resolution ("Monday"), targeted entity searches. | Retrieves the 5 shortlisted tools from Monday (`2026-11-09`), formulates date-anchored queries, and outputs a structured *Then vs. Now* delta table with citations. |
| **"What did I ask you on 3 November? Is your answer still correct today?"** | Temporal calendar matching (`November 3`), recalling previous recommendation, auditing freshness today. | Recalls the Nov 3 Postgres query and recommendations (Neon, Supabase, Aurora v2), runs live verification search, and audits if tiers are unchanged. |
| **"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"** | Relative week-back date resolution ("Last Tuesday"), comparative pricing audit. | Computes exact date of Last Tuesday, recalls pricing baseline, executes `web_search`, and confirms status with citations. |

### 1-Click Evaluation in Web UI
In the web interface at `http://localhost:3000`, the sidebar features a **Benchmark Scenarios** panel with pre-seeded threads matching the dataset. Click any benchmark to inspect the historical discussion or click one of the suggestion chips on the homepage to watch the agent execute in real time.

---

## 💻 Interactive Terminal CLI Mode

Prefer evaluating directly from your command line?
```bash
npm run cli
```
Streams live tool calls, search results, and agent responses directly in your terminal.

---

## 🧪 Automated Test Suite

Run the end-to-end verification suite:
```bash
npm test
```
Tests temporal date resolution, cross-session memory recall, single tool compliance, and synthesis pipeline.

---

## 🏗️ Architecture Summary

```
                      ┌────────────────────────────┐
                      │   Web UI / Terminal CLI    │
                      └─────────────┬──────────────┘
                                    │ SSE Streaming
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Chat Agent Orchestrator                         │
│                                                                        │
│  1. Temporal Grounding Engine                                          │
│     - Wall-clock anchor: Date, day of week, timezone.                  │
│     - Resolves "Monday", "Last Tuesday", "3 Nov" into exact dates.     │
│                                                                        │
│  2. Dual-Layer Memory Layer                                            │
│     - Active thread working context.                                   │
│     - Cross-session episodic memory matching past entities & dates.    │
│                                                                        │
│  3. Strictly One Tool: `web_search`                                    │
│     - Pluggable provider adapter (Tavily / Brave / Serper / Fallback)  │
│     - LRU caching with TTL, domain deduplication, date extraction.     │
│                                                                        │
│  4. Grounded Synthesis & Citation Streamer                             │
│     - "Then vs. Now" comparative delta matrix.                         │
│     - Strict citation validation `[1]`, `[2]` against verified links.   │
└────────────────────────────────────────────────────────────────────────┘
```

For a comprehensive explanation of architectural trade-offs, decisions, rejected approaches, and future roadmap, see **[DESIGN.md](./DESIGN.md)**.
