# Split Map

Use this map when a file has become crowded and the correct destination is unclear.

## Frontend

- page/app/screen orchestration -> keep local only when wiring state, navigation, and top-level callbacks
- reusable sections with meaningful UI boundaries -> `apps/web/src/components`
- message parsing, selectors, derived state, formatting, view-model helpers -> `apps/web/src/domain`
- seed data and fixtures -> `apps/web/src/data`

## Backend

- FastAPI endpoint -> request/response orchestration only
- input validation and schema shaping -> schema or contract modules
- business/domain rules -> service/domain modules
- persistence access -> repository/storage modules

## Agent

- graph/runtime entry -> node ordering and dependency wiring only
- prompt text and prompt assembly -> prompt builder modules
- tool adapters -> tool-specific modules
- state patch shaping and writeback helpers -> dedicated writeback/state modules
- repository access -> repository modules

## Decision Rule

If a piece of logic could be reused, tested, or renamed without mentioning the entry file it came from, it probably deserves its own module.
