# 0001. ASTRO-COMPANION is the core product; Human Digital Twin is the platform around it

- **Status:** Accepted
- **Date:** 2026-10-25
- **Deciders:** @LongNguyen1984

## Context

The project brief v1.0 describes ASTRO-COMPANION: an AI companion that uses the Tử vi chart as a prior, learns from feedback, and acts proactively. It puts health and physiological data out of scope until Phase 3 (2033+).

The repository, built as "Human Digital Twin", has a broader scope. Body health and family are already implemented as plugins, and devices, vector matching and community are on the near-term roadmap. Meanwhile, the brief's P0 features (Tử vi ontology, LLM companion, explanations, privacy controls) were scheduled late or not at all.

Options considered:

1. Follow the brief and drop the Twin modules.
2. Follow the repo and rewrite the brief around the Digital Twin.
3. Keep both: the brief becomes the core product, and the Digital Twin becomes the platform it grows into.

## Decision

Option 3. ASTRO-COMPANION is the **Core** ring and ships first. The Digital Twin is organised as two outer rings: **Extensions** (family, body, importer) and **Platform** (devices, vector, community). The outer rings depend on the core and never the reverse. Extensions open only after Gate G1 (all six Phase 1 KPIs met); Platform opens only after Gate G2 (Hybrid tier stable, health-data impact assessment, independent ethics review).

## Consequences

- The roadmap is re-sequenced around core plugins first: `storage-postgres`, `auth`, `privacy`, `tuvi` v0.2, `tuvi-ontology`, golden tests, `prior`, `llm`, `web`. See [project-brief.md §6](../project-brief.md#6-realigned-roadmap).
- `body` and `family` stay in the repo and keep their tests, but are not loaded in the *companion* build and get bug fixes only during Phase 1.
- `plugins.config.ts` needs two build profiles, *companion* and *twin*, and CI should check that no core plugin declares `dependsOn` on an outer-ring plugin.
- The Tử vi/health separation rule (F9) becomes a product requirement, not just an architecture rule.
- The legal basis is updated from Decree 13/2023 to Law 91/2025/QH15 and Decree 356/2025/NĐ-CP. Using a foreign LLM API counts as a cross-border data transfer (F11).
- Open: whether `family` is the first Extension (the brief's Phase 2 "relationships" scenario). Proposed but not yet confirmed.
