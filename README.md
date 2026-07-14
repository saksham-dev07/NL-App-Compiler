# NL App Compiler

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/saksham-dev07/NL-App-Compiler/actions/workflows/ci.yml/badge.svg)](https://github.com/saksham-dev07/NL-App-Compiler/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

> **Natural Language → Structured Config → Validated → Executable → Working Application**


A multi-stage compilation pipeline that transforms natural language descriptions into fully working web applications. Inspired by [Base44](https://base44.com/).

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key
cp .env.example .env
# Edit .env and add your Gemini API key (get from https://aistudio.google.com/app/apikey)

# 3. Start the server
npm run dev

# 4. Open in browser
# http://localhost:3000
```

## 🏗️ Architecture

### Compiler-Style Pipeline (4 Stages + 3 Validation Gates)

The system processes prompts through 4 distinct stages with **inter-stage validation gates** — like a compiler with lexer → parser → semantic analysis → code generation. Each gate validates and repairs before passing downstream.

**Single prompt = rejection.** The pipeline uses 6-7 separate LLM calls with structured JSON schemas.

```
                        ┌─────────────────────────────────────────────────────────────┐
                        │                    PIPELINE ORCHESTRATOR                     │
                        │                                                             │
  User Prompt ──► [Failure Check] ──► [Stage 1: Intent] ──► [Gate 1] ──►             │
                                      [Stage 2: Design] ──► [Gate 2] ──►             │
                                      [Stage 3: 4 Schemas ║] ──► [Gate 3] ──►        │
                                      [Stage 4: Cross-Layer Refine] ──► [Render] ──► App
                        │                                                             │
                        │  Metrics: tokens, cost, repairs, latency per stage          │
                        └─────────────────────────────────────────────────────────────┘
```

| Stage | LLM Calls | Description | Output |
|-------|-----------|-------------|--------|
| **Pre-check** | 0-1 | Failure handling (vague/conflicting detection) | Assumptions or clarification questions |
| **1. Intent Extraction** | 1 | Parses NL into structured form | Entities, features, roles, business rules |
| ↳ Gate 1 | 0 | Validate & repair intent | Guaranteed entities, appName, appType |
| **2. System Design** | 1 | Converts intent to architecture | Pages, navigation, relationships, flows |
| ↳ Gate 2 | 0 | Validate & repair design | Guaranteed pages, paths, components |
| **3. Schema Generation** | 4 (parallel) | Generates 4 schemas simultaneously | UI, API, DB, Auth configs |
| ↳ Gate 3 | 0 | Validate schema structure | Guaranteed arrays & required keys |
| **4. Refinement** | 0-1 | Cross-layer consistency + repair | Validated & repaired configuration |

### Validation + Repair Engine (Core)

3-layer repair strategy — targeted fixes, not brute-force retry:

| Layer | Scope | What It Handles |
|-------|-------|-----------------|
| **Layer 1: Schema Validation** | Per-stage | Missing fields, invalid types, structural issues |
| **Layer 2: Auto-Repair** | Cross-layer | Missing `id`/timestamps, orphaned FKs, undefined roles, duplicate paths |
| **Layer 3: LLM Refinement** | Complex only | Issues auto-repair can't fix (critical errors only) |

Specific repairs:
- Invalid JSON → `extractJSON()` with bracket-matching fallback parser
- Missing `id` column → inject UUID primary key
- Missing timestamps → inject `created_at` / `updated_at`
- FK references non-existent table → remove bad reference
- Entity referenced but no table → auto-create table
- Role used but not defined → add to `auth.roles`
- Duplicate page paths → deduplicate

### Schema Enforcement

Every output guarantees:
- ✅ Valid JSON structure (enforced by `responseMimeType: 'application/json'`)
- ✅ Required fields present (id, timestamps, appName, appType)
- ✅ Type safety across layers (field type mapping)
- ✅ Cross-layer consistency (API ↔ DB ↔ UI ↔ Auth)

### Execution Awareness

Generated configs are rendered into **fully working standalone HTML applications** with:
- Sidebar navigation with role-based visibility
- Hash-based client-side routing
- Working CRUD operations (localStorage-backed)
- Role switching to test permissions
- Interactive charts (bar charts) and data tables
- Auth flows (login/register/logout)
- Modal forms for creating entities
- Toast notifications
- Responsive design (mobile sidebar collapse)
- 16+ component types (StatCard, DataTable, Form, Chart, LoginForm, KanbanBoard, etc.)

### Mid-Way Modification

After generating an app, users can modify requirements without starting over:
1. Compile an app → `🔄 Modify` button appears
2. Type modification (e.g., "Add a notifications page")
3. Pipeline re-runs with existing config context
4. Only the changed parts are regenerated

### Deterministic Behavior

| Technique | Implementation |
|-----------|---------------|
| Low temperature | `temperature: 0.1` on all LLM calls |
| Structured prompting | 7 prompts with exact JSON schema specs |
| JSON mode | `responseMimeType: 'application/json'` |
| Modular generation | Each stage receives only prior stage outputs |
| Constrained values | Field types restricted to valid set |

## 📁 Project Structure

```
├── frontend/              # Compiler UI
│   ├── index.html         # Premium dark-mode interface
│   ├── index.css          # Design system (glassmorphism, animations)
│   └── app.js             # Frontend logic + modify mode
├── server/
│   ├── index.js           # Express server (/generate, /modify, /evaluate)
│   ├── pipeline/          # 4-stage generation pipeline
│   │   ├── index.js              # Orchestrator (gates + stage tagging)
│   │   ├── stage1-intent.js      # Intent extraction
│   │   ├── stage2-design.js      # System design
│   │   ├── stage3-schema.js      # Schema generation (4 parallel LLM calls)
│   │   ├── stage4-refine.js      # Cross-layer validation & refinement
│   │   └── failure-handler.js    # Vague/conflicting prompt handling
│   ├── validation/        # Validation + Repair engine
│   │   ├── validator.js          # Schema validation + inter-stage gates
│   │   ├── consistency.js        # Cross-layer consistency checker
│   │   └── repair.js             # Auto-repair engine
│   ├── llm/               # LLM integration
│   │   ├── client.js             # Gemini API (retry, backoff, token tracking)
│   │   └── prompts.js            # All 7 pipeline prompts
│   └── runtime/           # App renderer
│       ├── renderer.js           # Config → standalone HTML app
│       ├── components.js         # 16+ component types
│       └── templates.js          # App shell (CSS + JS + Auth + CRUD)
└── evaluation/            # Evaluation framework
    ├── prompts.json       # 20 test prompts (10 real + 10 edge)
    ├── runner.js          # Automated test runner
    └── metrics.js         # Metrics collection & reporting
```

## 🧪 Evaluation Framework

### Test Dataset

| Category | Count | Examples |
|----------|-------|---------|
| **Real Products** | 10 | CRM, E-commerce, LMS, HR, Healthcare, Restaurant, Real Estate |
| **Edge Cases** | 10 | "Make me an app", conflicting requirements, single word, non-app |

### Tracked Metrics

- Success rate (overall, real prompts, edge cases)
- Retries per request
- Failure types (JSON parse, timeout, rate limit, validation)
- Latency per stage and total (avg, min, max, P95)
- Token usage (prompt + completion)
- Estimated cost per generation
- Repair count and types

### Run Evaluation

```bash
# Via CLI
npm run evaluate

# Via web UI
# Click "Evaluate" button → runs all 20 prompts with live progress
```

## 💰 Cost vs Quality Analysis

### Model Selection (Adaptive)

| Model | RPM | RPD | Quality | Use Case |
|-------|-----|-----|---------|----------|
| `gemini-3.1-flash-lite` | 15 | 500 | Good | Default (high throughput) |
| `gemini-3.5-flash` | 5 | 20 | High | Quality-critical |
| `gemini-2.5-flash` | 5 | 20 | High | Fallback |

### Cost Per Generation

| Metric | Value |
|--------|-------|
| LLM calls per generation | 6-7 (intent + design + 4 schemas + 0-1 refinement) |
| Avg tokens per generation | ~60-65K |
| Est. cost per generation | ~$0.01-$0.015 |
| Temperature | 0.1 (determinism) |

### Optimization Decisions

| Decision | Tradeoff | Impact |
|----------|----------|--------|
| Parallel schemas (4 at once) | Requires ≥15 RPM tier | 3-4x faster Stage 3 |
| Skip LLM refinement for warnings | Slightly less refined output | Saves 1 LLM call ($0.002) |
| Compact refinement context | Less context for LLM | Avoids timeout on large configs |
| `temperature: 0.1` | Less creative output | Fewer retries needed |
| JSON mode enforcement | Limits model flexibility | Eliminates ~30% JSON parse failures |
| Inter-stage gates | Small overhead | Catches issues before they cascade |

## 📋 Failure Handling

| Input Type | Behavior |
|-----------|----------|
| **Vague** ("make me an app") | Makes reasonable assumptions, documents them |
| **Conflicting** | Detects contradictions, resolves with documented assumptions |
| **Incomplete** | Fills gaps with sensible defaults |
| **Non-app** | Adapts or rejects gracefully |
| **Too large** | Suggests phased approach |
| **Mid-way changes** | Modify mode preserves existing config |

## 🔧 Configuration

| Env Variable | Description | Default |
|-------------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `PORT` | Server port | 3000 |

## License

MIT
