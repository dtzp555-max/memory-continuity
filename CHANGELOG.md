# Changelog

## v0.3.0-probe — 2026-03-13

### Summary
This release marks the transition from a skill-only continuity package to a
**dual-form package**:
- the existing `SKILL.md` remains the fallback behavior contract
- a new **lifecycle plugin probe** is included to validate the primary runtime path

### Added
- `plugin/lifecycle-prototype.ts`
- `references/phase2-hook-validation.md`
- `references/scope.md`
- `references/plugin-design.md`

### Changed
- repository direction clarified: primary long-term path is now a standard lifecycle plugin
- ContextEngine is now documented as a future option, not the v1 default
- README updated to describe the package as skill + lifecycle plugin probe
- skill docs aligned to the lifecycle-plugin plan

### Validated
- Experiment A passed on multiple resident subagents (`tech_geek`, `travel_assistant` after workspace/startup-rule cleanup)
- startup continuity injection can work without `read`

### Pending
- Experiment C (compaction-path verification) remains pending because no real compaction event was triggered in the earlier pressure test
