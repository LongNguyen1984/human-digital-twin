# Documentation

Reference documents for the project. Keep them current: when scope, roadmap or architecture changes, update the relevant file in the same pull request as the code.

| Document | What it covers | Update when |
|---|---|---|
| [project-brief.md](project-brief.md) | **Source of truth.** Vision, the Core / Extensions / Platform rings, requirements with repo status, scope, roadmap with gates, risks, KPIs (Vietnamese, v1.1) | Scope, roadmap, requirements or KPIs change; a requirement's status changes |
| [decisions/](decisions/) | Numbered decision records: what was decided and why | A decision changes scope, architecture, roadmap or compliance |
| [../README.md](../README.md) | Architecture: layer stack, kernel mechanisms, facts pipeline, plugin list, how to write a plugin | A plugin, kernel mechanism or layer changes |
| [archive/](archive/) | Superseded versions, kept for history | A document is replaced by a new version |

## Conventions

- **The brief wins.** If the root README's roadmap and the brief disagree, follow [project-brief.md §6](project-brief.md#6-realigned-roadmap) and fix the README.
- **Record decisions.** A ticked box in the brief's "Quyết định cần chốt" list should have a matching record in `decisions/` with the outcome.
- **Version the brief.** For a substantial rewrite, copy the current file to `archive/project-brief-vX.Y.md` first, then bump the version in the header and list the changes in "Thay đổi so với …".
- **Status columns.** The "Trạng thái repo" columns in the brief use `Đã có` / `Một phần` / `Chưa có`. Update them when a plugin lands.
