# Review Checklist

Use this checklist before finishing a refactor driven by `$clean-code-guardrails`.

## Responsibility Check

- Can each touched file be described with one short job?
- Did the entry file stop owning domain helpers, adapter logic, or large UI details?
- Did any new helper file become another mixed-responsibility dump?

## Boundary Check

- Are pure selectors/formatters separated from React rendering or endpoint orchestration?
- Are repositories separated from service/runtime logic?
- Are prompt builders and tool adapters separated from graph routing when working in agent code?

## Change Scope Check

- Did the refactor preserve behavior while reducing file sprawl?
- Did the change avoid slipping in unrelated product scope?
- Did the result improve reviewability for the next teammate?

## Validation Check

- Run the smallest meaningful validation for the area you changed.
- If validation could not be run, state that clearly with the remaining risk.
