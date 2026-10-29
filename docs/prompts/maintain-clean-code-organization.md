# Topset code organization prompt

Use this prompt when changing Topset code to keep the repository easy to navigate and maintain.

> Work in the existing Topset repository. Keep the codebase clean and organized as you make the requested change. First inspect the project instructions, spec, current folder structure, and the files involved. Place code in the narrowest existing feature or domain folder that fits its responsibility. Keep pages, reusable UI, domain logic, and data access separate; keep related feature files together; and avoid oversized files that mix unrelated screens or responsibilities.
>
> Preserve existing behavior, data contracts, access controls, and the approved milestone scope. Do not add features, dependencies, abstractions, or unrelated refactors. Prefer clear names and small single-purpose modules. Extract shared code only when reuse is real, and update all imports when moving code. Keep styles and tests near their established project conventions.
>
> Before editing, state the files and boundaries you plan to change. After editing, review the resulting folder structure, imports, and diff for accidental behavior changes, duplicate code, stale files, secrets, and formatting problems. Run only the checks requested for the task or required by repository instructions, and report checks that could not be run. Keep documentation and decision records current when the change affects project conventions.

## Topset layout guidance

- Keep calculations in `src/lib/engine` and program document, persistence, and autosave logic in `src/lib/programs`.
- Keep authentication and route guards in `src/auth`.
- Keep coach route screens together under `src/components/coach`; keep the program editor and its grid parts under `src/components/programs`.
- Keep genuinely shared app components in `src/components`, not inside one feature.
- Keep global design tokens and global styles in the existing stylesheet unless a task specifically introduces a component styling convention.
- Keep setup and architectural notes in `README.md` and `docs`; never move secrets or local environment files into source control.
