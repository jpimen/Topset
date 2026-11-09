# Prompt: improve mobile responsiveness without changing desktop UI/UX

Work in the existing Topset repository. Make the current application usable on phone and tablet screen sizes while preserving the existing desktop layout, visual design, and behavior. Treat this as a responsive adaptation of the current UI, not a redesign. Do not implement this prompt until the owner approves it.

## Read and inspect first

Read `AGENT.md`, `Spec.md`, and the relevant screens, shared components, and styles before making changes. Identify all current routes and their key states, the existing responsive breakpoints, the viewport configuration, and any desktop and mobile reference screenshots. Preserve all existing working-tree changes.

Topset has different role needs: the coach experience is dense and desktop-first, especially the spreadsheet-style program builder; the athlete experience is focused and mobile-first. Make mobile controls practical to use without weakening either role's workflows or access boundaries.

## Non-negotiable desktop preservation

- Keep the existing desktop layout and UI/UX unchanged. Treat viewports at or above 1024 CSS pixels as desktop unless the existing project conventions establish a different breakpoint.
- Before editing, capture or otherwise record representative desktop screens at 1280 and 1440 pixels wide. Compare the same screens after the changes. Do not accept changes to desktop spacing, sizing, alignment, typography, navigation, component order, density, or interactions.
- Prefer mobile-scoped CSS and the project's existing styling patterns. Avoid changing default/desktop styles, shared tokens, or component structure when a responsive style override is sufficient.
- If a shared component must change, preserve its desktop appearance and behavior and explain why the change is necessary.
- Do not redesign, rebrand, change copy, or add features. Do not hide essential information or actions to make a screen appear to fit.

## Mobile and tablet requirements

Support narrow phone widths starting at 320 CSS pixels, common phone widths (360, 390, and 430), and tablet widths around 768 pixels. Use the existing breakpoints and conventions where possible.

- Prevent unintended page-level horizontal overflow, clipped content, overlapping controls, and unreadable text.
- Keep forms, dialogs, headers, navigation, cards, buttons, and inputs usable with touch. Keep controls comfortably tappable and account for on-screen keyboards and device safe areas where relevant.
- Adapt the coach workspace and builder deliberately. Keep all program data and actions available; if a spreadsheet-like grid cannot fit, use a clearly bounded horizontal-scroll region or another mobile interaction that preserves access to every field. Do not shrink it until it is unusable or make the whole page scroll sideways.
- Keep the athlete workout and program flows focused and readable on small screens. Preserve read-only prescription behavior and all existing logging, loading, empty, and error states.
- Ensure navigation remains discoverable and does not cover content. Provide enough bottom spacing for any fixed mobile navigation.
- Preserve keyboard access, visible focus, semantic labels, contrast, dark and light themes, and reduced-motion preferences.
- Confirm the document has the correct viewport meta configuration; fix it only if needed.

## Implementation boundaries

1. Report the screens/routes inspected, current responsive gaps, desktop baselines, and a concise file-level plan before editing.
2. Make the smallest complete changes needed for responsive layout. Prefer existing components, design tokens, and CSS conventions; add no dependency.
3. Keep responsive rules scoped to the relevant screen/component and mobile/tablet breakpoint. Avoid broad global overrides that can alter unrelated pages or desktop rendering.
4. Preserve app behavior, data contracts, authorization, route access, and persistence. Do not change backend or database behavior for a layout task.
5. Update directly related documentation only if the responsive behavior or supported viewport expectations need to be recorded.

## Acceptance and verification

- Check representative screens for every role and relevant auth/setup flow at 320, 360, 390, 430, 768, 1024, 1280, and 1440 CSS pixels wide. Include long content and key interactive states, not only the initial viewport.
- At phone widths, verify there is no unintended page-level horizontal scrolling, clipping, overlap, inaccessible action, or unusable control. Any necessary grid scrolling must stay inside the grid region.
- At 1280 and 1440, confirm the screens match their pre-change desktop baselines in layout, visual hierarchy, and interaction. Investigate and fix any desktop regression before finishing.
- Exercise the affected interactions at mobile and desktop sizes. Run the smallest relevant tests, lint, typecheck, and build supported by the repository.
- Report the files changed, mobile checks performed, desktop comparison results, exact commands and outcomes, and any remaining limitations. Do not claim a viewport or flow was verified unless it was actually exercised.
