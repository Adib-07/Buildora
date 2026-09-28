# API docs

The API contract lives in [`contracts/`](../../contracts/README.md) — zod schemas plus inferred
types, one file per domain area.

**`contracts/` is the source of truth, not this folder.** Endpoint shapes, error codes and
conventions are documented in `contracts/README.md`; do not duplicate them here or they will drift.

What belongs in `docs/api/`:

- Narrative design notes that are not expressible in the schema (auth flow walkthroughs,
  the photo upload sequence, demo-mode behaviour).
- Endpoint additions and breaking changes, written up after they land in `contracts/`.

Changes to `contracts/**` need approval from both developers.
