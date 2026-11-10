# Minimi Agent — Design Document

> One tool. Real time. Gets things right.

---

## How it works

Every turn runs a deterministic four-stage pipeline:

```
User message
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  Stage 1 · Temporal Grounding Engine                 │
│  Wall-clock anchor injected as ISO timestamp.        │
│  Relative references ("Monday", "last Tuesday",      │
│  "3 November") are resolved to concrete ISO dates    │
│  and an explicit delta window [Base → Today].        │
│  This runs before any LLM call.                      │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  Stage 2 · Episodic Memory Recall                    │
│  Scored lookup against a persistent JSON store.      │
│  Scoring weights: exact date match (+5), day-of-week │
│  match (+3), entity overlap (+2 each), topic signals │
│  (+4 each). High-confidence matches (≥6) inject the  │
│  verbatim prior assistant response into the prompt.  │
│  Threshold prevents false recalls on unrelated turns.│
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  Stage 3 · Intent Gate + Parallel Tool Fan-Out       │
│  Greeting / pure-recall turns skip search entirely   │
│  (<300ms TTFT). Investigation turns emit N targeted  │
│  queries in a single LLM pass, executed concurrently │
│  via Promise.all with LRU cache + provider fallback  │
│  chain: Tavily → Brave → Serper → DuckDuckGo.        │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  Stage 4 · Grounded Delta Synthesis + SSE Stream     │
│  Evidence injected into synthesis prompt. Model      │
│  produces a Then-vs-Now comparison table with inline │
│  bracketed citations anchored to actual search URLs. │
│  Tokens stream over SSE; first token <400ms.         │
└──────────────────────────────────────────────────────┘
```

**Worked example — "On Monday we shortlisted 5 CRM tools. Has any of them changed pricing or shipped something big since?"**

1. Stage 1 resolves "Monday" to `2026-11-09`. Delta window: `[2026-11-09 → 2026-11-10]`.
2. Stage 2 scores the episodic record `ep-crm-monday` at 9 (date +5, topic +4) → injects verbatim CRM shortlist from that session.
3. Stage 3 dispatches two parallel `web_search` calls: one for HubSpot/Pipedrive, one for Close/Zoho/Folk, freshness-filtered to `week`.
4. Stage 4 synthesises a five-row delta table with change verdicts and citations. Stable prices reported as stable — no hallucinated "updates".

---

## Why this architecture

### Speed

Sequential ReAct loops (Thought → Action → Observation, repeated) are the standard approach. For five entities that means five serial HTTP calls and five LLM roundtrips — roughly 15–25 seconds end-to-end.

Parallel fan-out collapses N serial calls into one concurrent batch. Five Tavily searches fired simultaneously return in ~400ms combined. The LLM makes exactly two calls total: one to plan queries, one to synthesise.

An intent gate short-circuits the tool path entirely for greetings and pure recall queries, hitting the SSE stream in under 300ms.

### Accuracy

LLMs hallucinate dates because their training cutoff is months or years stale. Injecting the wall-clock timestamp and resolving relative references deterministically before the first LLM call eliminates that class of error entirely.

The delta window instruction (`focus only on announcements between Base Date and Today`) prevents the model from quoting a 2023 article as "recent news". When search returns nothing new, the prompt instructs the model to report stability rather than invent a change.

Historical recall injects the *verbatim prior response text*, not a summary. When a user asks "is your answer still correct?", the model can compare exact figures rather than reconstructed ones.

### Conversational quality

Live search progress streams as SSE events. Users see the query firing and the provider responding before synthesis begins — not a frozen spinner followed by a wall of text. Citations render as clickable pills linked to actual sources returned by the search API, never fabricated.

---

## What was considered and rejected

**Multi-step ReAct loops** — Gives the model maximum flexibility, but compounds latency and makes execution non-deterministic. For a bounded task (audit N entities since date D), fixed two-turn execution is both faster and more reliable.

**External vector databases (Pinecone, Chroma)** — Cross-session memory across three benchmark scenarios doesn't require embedding search. A scored lookup on a lightweight JSON store with temporal + entity indexing retrieves the right record in microseconds with zero cold-start penalty and no API dependency.

**Separate memory tool** — The challenge specifies exactly one tool: `web_search`. Memory is handled in-process before the LLM call. Exposing a second tool would violate the constraint and add unnecessary round-trips.

**Ephemeral in-session context only** — Queries like "what did I ask on 3 November?" are unanswerable without persistent storage. A file-backed atomic store (write-to-tmp then rename) survives process restarts without an external database.

**Streaming via polling / long-poll** — SSE is the right primitive here: unidirectional, low-overhead, natively supported by browsers and Node's `ReadableStream`. WebSockets add bidirectional complexity that this use case doesn't need.

---

## What another week would add

**Deterministic pricing page diffing.** Snapshot the official `/pricing` DOM on each query. On subsequent audits, diff the clean text snapshot rather than trusting search snippets. Would catch tier renames and feature additions that search results miss.

**Adaptive query rewriting (HyDE).** Generate a hypothetical "pricing changelog" passage, then embed it and retrieve semantically similar search results. Would improve recall for vendors with unusual pricing page structures.

**Confidence-calibrated responses.** Track search result dates and source authority. Flag low-confidence answers ("search returned only results older than the reference date — pricing may have changed without public announcement") rather than silently returning stale data.

**Streaming thought traces to the UI.** The orchestrator already collects model reasoning. Surfacing it as a collapsible "reasoning" block alongside citations would make the agent's decision process fully auditable.
