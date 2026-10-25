# Human Digital Twin

A personal "digital twin" that brings together a person's **Tử vi chart**, **body health**, **family** and **community**, collected through forms, file imports and conversation.

Everything except a small core is a **plugin**. A feature can be built, tested, switched on or off, and replaced without touching the others.

**Documentation:** the project brief, roadmap and decision records live in [`docs/`](docs/README.md). Start with [docs/project-brief.md](docs/project-brief.md).

```bash
pnpm install
pnpm test        # 37 tests: kernel, lunar calendar, chart engine, parsers, end-to-end chat flow
pnpm typecheck
pnpm dev         # API on http://localhost:3000  (try GET /api/_system/routes)
pnpm new-plugin community "Community rooms"   # scaffold the next plugin
```

## Layer stack

```
┌──────────────────────────────────────────────────────────────────────┐
│ 6  Clients        web / mobile app, 3D body viewer, chat button       │  (next phase)
├──────────────────────────────────────────────────────────────────────┤
│ 5  API gateway    apps/api: Fastify, mounts plugin routes at          │
│                   /api/<pluginId>, auth (next), error mapping         │
├──────────────────────────────────────────────────────────────────────┤
│ 4  Experience     chat: topics, onboarding, auto-collect → facts      │
│    plugins        (later: notifications, reminders, insights feed)    │
├──────────────────────────────────────────────────────────────────────┤
│ 3  Domain         profile · tuvi · body · family                      │
│    plugins        (later: importer · vector · community · llm)        │
├──────────────────────────────────────────────────────────────────────┤
│ 2  Kernel         packages/core: plugin contract, load order, event   │
│                   bus, services, extension points, facts pipeline,    │
│                   consent                                             │
├──────────────────────────────────────────────────────────────────────┤
│ 1  Storage port   KeyValueStore per plugin (in-memory today);         │
│                   adapters later: PostgreSQL, TimescaleDB, Neo4j,     │
│                   pgvector/Qdrant                                     │
└──────────────────────────────────────────────────────────────────────┘
```

Each layer may only use the one below it. Plugins never import each other's internals. They talk through four kernel mechanisms:

| Mechanism | Use it for | Example |
|---|---|---|
| **Service** (`ctx.services.provide/use`) | One plugin offers an API to others | `tuvi` uses `profile.require(id)` |
| **Event** (`ctx.events.on/emit`) | React to changes without coupling | `person.updated` → `tuvi` recomputes the chart |
| **Extension point** (`ctx.extensions.contribute/all`) | Many plugins plug into one feature | `body`, `family`, `tuvi` each contribute a `chat.topic` |
| **Fact** (`ctx.facts.handle/propose/confirm`) | The only way collected data gets saved | chat proposes `body.observation`; `body` applies it |

All four are type-safe. Plugins add their own keys to `ServiceMap`, `EventMap` and `ExtensionMap` with `declare module '@hdt/core'`.

## How data gets in: the facts pipeline

Chat, file import, forms and devices all go through the same path:

```
message / file row / form
   → extractors (one per plugin) → FactDraft[]
   → facts.propose      (dropped if confidence < 0.5)
   → person confirms or edits   (UI "saved" card)
   → consent check      (body.* needs 'health', family.* needs 'family')
   → owning plugin applies it   → events → other plugins react
```

A fact has a `personId` (who reported it) and a `subjectId` (who it's about). That's how "Mẹ sinh giờ Thìn", typed in the family chat, is saved to Mẹ's profile.

## Plugins today

| Plugin | Provides | Fact kinds | Chat topic | Routes (`/api/...`) |
|---|---|---|---|---|
| `profile` | people, birth details, consent | `person.fullName`, `.birthDate`, `.birthHour`, `.gender` | – | `profile/persons`, `…/consents/:scope`, `…/facts` |
| `tuvi` | Vietnamese lunar calendar (UTC+7), Can Chi, Nạp âm, 12 palaces, Cục, 14 main stars, Đại vận | – (reads profile) | `tuvi` | `tuvi/charts/:id`, `tuvi/compute`, `tuvi/palaces` |
| `body` | 9 regions mapped to 3D meshes, observations, status scores, red-flag safety (115) | `body.observation` | `body` | `body/regions`, `body/status/:id`, `body/observations` |
| `family` | relatives as "shadow" people, relations, facts about relatives | `family.relative` | `family` (Twin speaks on `@twin`) | `family/relatives/:id`, `family/roles` |
| `chat` | conversations, onboarding, extractor runner, confirm/reject | – | `onboarding` | `chat/start`, `chat/messages`, `chat/facts/:id/confirm` |

### Tử vi engine notes

- The lunar calendar uses Hồ Ngọc Đức's astronomical method at UTC+7. Tests check Tết dates, including 1985, when Vietnam's Tết differed from China's.
- **Configurable conventions** in `plugins.config.ts`:
  - `ratHourNextDay`: births at 23:xx count as the next day; on by default.
  - `leapMonth`: `same` or `split`.
- Every chart stores `ruleVersion`, so charts can be recomputed when rules change.
- Not yet placed: minor stars (Tả Phù, Hữu Bật, Văn Xương, Tứ Hóa, Lộc Tồn, Kình Đà, …), Tràng Sinh, and the Tuần/Triệt voids. These are the next chart milestone.
- **Golden tests needed:** checking full charts against a trusted reference chart is still an open task.
- Readings are a separate extension point, `tuvi.interpreter`. The engine stays deterministic, and a rules or LLM plugin supplies the words.

## Roadmap

The product is organised in three rings ([decision 0001](docs/decisions/0001-core-and-twin-rings.md)). **Core** is ASTRO-COMPANION and ships first. **Extensions** (family, body, importer) open after Gate G1, and **Platform** (devices, vector, community) after Gate G2. Core plugins never depend on outer-ring plugins. The full roadmap, with steps, gates and KPIs, is in [docs/project-brief.md §6](docs/project-brief.md#6-realigned-roadmap); this table is a summary.

| Phase | Plugins | What it adds | Ring |
|---|---|---|---|
| ✅ 0 | core, profile, tuvi v0.1, body, family, chat, api | This repository | – |
| 1 | `storage-postgres`, `auth`, `privacy` | Encrypted persistence, sign-in, delete/export, audit log | Core |
| 1 | `tuvi` v0.2, `tuvi-ontology`, golden tests | Minor stars, Tứ Hóa, Tuần/Triệt, Lưu niên; versioned ontology; expert-checked reference charts | Core |
| 1 | `prior`, `llm` | Chart → weighted hypotheses; `tuvi.interpreter` with mandatory explanations and a language guardrail | Core |
| 1 | `web` | Birth input, chart, chat, privacy page; 100-user pilot | Core |
| **G1** | | All six Phase 1 KPIs met | |
| 2 | `portrait`, `proactive`, `notifications` | Bayesian portrait, rate-limited proactive check-ins, Hybrid data tier | Core |
| 2 | `family`, `importer` | Relationships scenario; CSV/Excel/JSON → facts | Extensions |
| **G2** | | Hybrid tier stable, health-data impact assessment, independent ethics review | |
| 3 | `body`, `devices`, `vector`, `community` | Health data, wearables, opt-in matching, moderated rooms | Extensions / Platform |

## Writing a plugin

```ts
import { definePlugin } from '@hdt/core';

export default definePlugin({
  manifest: { id: 'community', name: 'Community', version: '0.1.0', dependsOn: ['chat'] },
  setup(ctx) {
    ctx.extensions.contribute('chat.topic', { id: 'community', title: 'Community', respond: () => ({ text: '…' }) });
    ctx.routes.add({ method: 'GET', path: '/rooms', handler: () => [] });   // → GET /api/community/rooms
  },
});
```

Rules of the road:

1. **Data:** only save collected data through a fact handler, never directly from a route or a chat reply.
2. **Consent:** set `requiresConsent` on anything about health, family, or visibility to others.
3. **Separation:** keep astrology and health apart. Tử vi may sit beside body data, but never writes it.
4. **Communication:** use services, events and extension points; never import another plugin's internals.
5. **Tests:** put tests next to the code. End-to-end flows live in `apps/api/src/api.test.ts`.
