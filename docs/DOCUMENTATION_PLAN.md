# Avorion Viewer documentation plan

Status: proposed implementation plan. This document authorizes no deployment and makes no application changes.

## 1. Outcome and visual direction

Create a searchable documentation section at `/docs/` that helps a first-time user complete a task and an experienced user look up a specific control. Cover every shipped editor and user-facing feature, including specialized workspaces, dialogs, and export workflows.

Use the three generated concepts as the design foundation:

- [Documentation home](../output/documentation-concepts/01-documentation-home.png): persistent topic tree, prominent search, task-based entry points, and a short getting-started path.
- [Painting guide](../output/documentation-concepts/02-painting-guide.png): annotated application image, numbered explanations, concise instructions, tool table, and relevant cautions.
- [Export reference](../output/documentation-concepts/03-export-reference.png): visual output examples, settings reference, workflow steps, and related pages.

Retain the charcoal surfaces, restrained teal accents, clear typography, thin dividers, and three-column desktop layout. Treat the concepts as visual proposals rather than verified UI captures. Replace generated screenshots and invented details with verified application captures and copy before publication.

Success means users can find the relevant page, locate the control in the application, complete the action, understand the result, and know how to save or recover their work.

## 2. Findings that shape the work

- `src/layout.js` currently registers seven editor types: **3D Viewport, Outliner, Properties, Info, Preferences, Color Editor, and Asset Library**. Give each an overview page. Inventory their panels and commands separately.
- Painting & Regions, Armament, Turret Studio, and Cameras & Timelines are useful topic groups, but must not all be described as independent editor types. Explain where each lives.
- `docs/GETTING_STARTED.md` is an accessible introduction. `docs/USER_GUIDE.md` contains substantial current behavior alongside architecture and design references. Specialist documents supply depth but frequently include implementation history and test notes.
- `docs/WEB_APP_USER_GUIDE.md` explicitly describes a deployed 0.12.0 snapshot dated November 9, 2026. This checkout reports 0.11.0 in `package.json` and `src/version.js`. Do not use either number as an assumed documentation baseline until the intended release is identified.
- Trackpad availability differs between the deployed-snapshot guide and local documentation. Validate input instructions against the chosen release.
- The generated home concept includes an invented stable version and a forward-axis label. Neither should be copied into production. The paint documentation describes native coordinates as X right, Y up, Z back; distinguish native coordinates from the workspace display wherever relevant.
- The build currently copies only the app and phone-AR prototype into `dist/`. The local server allowlist excludes `/docs/`. Both need deliberate integration work.
- Existing deployment already supports a static site through GitHub Pages. Documentation can use that pipeline without a separate hosting service.

## 3. Content baseline and coverage inventory

Before writing, select the target release/commit and record it in the content inventory. Use that build to verify interface labels, menu paths, input presets, persistence, limitations, and screenshots. Existing prose is source material, not an automatic authority when it conflicts with the application.

Create `docs/FEATURE_COVERAGE.csv` during the inventory phase, with one row per independently explainable user-facing feature or control group:

`feature_id, topic, editor_or_context, visible_label, entry_path, source_reference, page_id, section_id, status, verified_commit, screenshot_id, reviewer_notes`

Use statuses `inventoried`, `draft`, `verified`, and `published`. Record unavailable and experimental features explicitly. Split a control group into individual rows when its controls have different behavior, risks, prerequisites, or persistence. Do not equate one overview page with complete feature coverage.

Reconcile the inventory against editor registries, menus, context menus, viewport modes, property tabs, preferences, dialogs, asset-specific interfaces, and export controls. Each shipped item must map to a page section or have a documented reason for exclusion. Keep development-only tools outside the main user navigation.

## 4. Proposed navigation and page families

The sidebar should expose understandable topic groups, with editor identity explained on the relevant pages. Keep a single canonical reference for each feature and link to it from workflows.

| Topic group | Required coverage |
| --- | --- |
| Getting started | Requirements, first XML import, optional textures, input preset, first inspection, first paint edit, first saved project and exported game copy |
| Workspaces & editors | Screen anatomy; all seven editor overviews; split/join/swap; resize; maximize/focus; multiple views; layouts and workspace profiles; trackpad drawers if shipped |
| Viewport & inspection | Navigation; projection and standard views; Object/Paint/Select Sockets modes; block selection; Outliner; Inspector; visibility/isolation; dimensions and annotations; display modes, overlays and X-Ray |
| Appearance, world & lighting | Texture loading; material appearance and opacity; Solid/MatCap/Material Preview/Rendered distinctions; World and sky; lighting; shader settings; post-processing and performance tradeoffs |
| Painting & Regions | Brush, Eyedropper, Replace Color, Connected Fill, Restore; channels and alpha; scope; radius; symmetry and axes; magnifier; palette pie; model colors; undo/cancel; region creation, membership, highlight and isolation |
| Color Workshop | Relationship to Color Editor; Wheel/List; actual game colors and variants; harmonies; saved palettes; selected-block and region application; local persistence |
| Asset Library | Model/turret/component assets; import; folders and browser permissions; one-time picker; search, favorites and recents; packs; editable assets versus mounted copies |
| Armament & components | Sockets; attachment; selection; pose, scale and clearance; component setup; changes to source assets; Weapon Coverage modes, assumptions, point inspection, baselines, comparisons and data exports |
| Turret Studio | Entering/leaving the asset workspace; structure and properties; articulation; tracking; firing previews and effects; calibration/comparison; fidelity limits; saving assets |
| Cameras & timelines | Showcase views; camera controls and keys; playback; timing; animation/effects capture; available output formats and limits |
| Save, import & export | Model Projects; game XML; Workspace Profiles; Replace Source XML and conflict review; automatic session recovery; image modes; blueprints; turntables; GLB/glTF/OBJ; STL/3MF; print preparation; USDZ if shipped; units and output limitations |
| Preferences & controls | Preferences editor categories; themes; input presets; shortcut customization and default-keymap reference; interface languages; storage; graphics/performance settings |
| Troubleshooting & glossary | Import failures; missing textures; invisible/out-of-frame models; scope locks; folder permission failures; storage loss; export memory and geometry failures; diagnostic information; key terms |
| Experimental features | Tabletop XR and iPhone AR when present in the target build; support requirements, excluded features, hardware validation status and fallback behavior |

This is a working taxonomy. Final page count follows the feature inventory. Use short overview pages plus focused subpages where a topic becomes difficult to scan; do not produce a fixed number of pages merely to match this table.

## 5. Reusable page templates

### Documentation home

- Search at the top and a concise description of the documentation.
- Six task links modeled on the concept: open a ship, paint and organize regions, place turrets/components, inspect coverage, create a showcase, and export work.
- A three-step first-use path and an editor directory.
- A prominent explanation of project files versus game XML and browser storage.
- Release applicability drawn from verified metadata, never a decorative version badge.

### Editor overview

- Purpose and common tasks; how to open or switch to the editor.
- An annotated screenshot showing its main areas.
- Sections for each tab/panel, with links to detailed references.
- How selection and state interact with the rest of the app.
- What is saved, where it is saved, and how to resume work.
- Limits, common problems, and related workflows.

### Task guide

- A concrete goal, prerequisites, and expected result.
- Numbered steps with exact interface labels and relevant input-preset notes.
- An annotated screenshot at the point where it reduces ambiguity.
- A visible completion check, save/export instructions, and recovery/undo where applicable.
- Links to the detailed control reference rather than duplicated settings tables.

### Feature reference

- Purpose, exact entry path, applicability, and a small visual example.
- Table of controls: label, behavior, choices/range/default where verified, dependencies, and persistence where useful.
- Explain hidden controls and conditions that change behavior.
- Provide coordinate, unit, alpha, scope, memory, or approximation notes only where relevant.
- Related tasks and symptom-based troubleshooting.

### Troubleshooting article

- Observable symptom, likely causes, ordered checks, and expected recovery result.
- Explain whether any action can discard work and how to preserve it first.
- Explain what information to collect if the problem remains unresolved.

All templates use short direct sentences and consistent terminology. Distinguish workspaces, editors, modes, panels, and dialogs. State important limitations next to the affected instruction. Label default shortcuts as defaults because users can customize them.

## 6. Documentation design system

- Desktop: approximately 250 px navigation rail, flexible article column, and 220 px in-page contents rail. Cap prose near 70–80 characters per line; let screenshots and tables use more width.
- Mid-width layouts: move in-page contents into a compact article control. Small screens: use an accessible navigation drawer and a single article column. Tables scroll within their own region.
- Shared components: header/search, breadcrumbs, topic tree, page title/summary, annotated figure, task steps, control table, callout, related links, previous/next navigation, and release-verification note.
- Use teal for navigation and selected states, neutral blue for contextual notes, and amber for consequential cautions. Do not rely on color alone.
- Use semantic headings, visible keyboard focus, a skip link, labeled controls, sufficient contrast, and reduced-motion support. Target WCAG 2.2 AA.
- Place screenshots in figures with captions. Numbered annotations must have matching text explanations; image alt text summarizes purpose rather than repeating an entire article.
- Use the app's icon language where appropriate and record any icon asset licensing. Preserve app labels in screenshots and article text.
- Start with the approved dark appearance. Theme switching can follow if it becomes a requirement; it is not needed for the first documentation release.

## 7. Screenshots and examples

Use actual target-build captures in published instruction pages. Keep the generated images as design references only.

Prepare a small documented fixture set: a simple first-use ship, a clearly segmented painting example, a turret/component example, a coverage example with recognizable gaps, and a presentation/export example. Confirm redistribution permission for every model, texture, and output used in public documentation.

For each capture, record fixture, release/commit, workspace, selected mode, camera, settings, dimensions, and caption. Prefer saved projects/profiles and a short capture recipe over fragile one-off screen setups. Show the same ship before and after when explaining a change.

Store raw captures separately from annotated publication assets. Use a consistent annotation style and retain editable annotation sources. Produce appropriately sized web images, reserve their dimensions to avoid layout shifts, and link large reference images when useful. Do not bake instructional prose solely into an image.

## 8. Recommended technical implementation

Build a repository-owned static documentation site at `/docs/`, sharing the app's existing hosting and deployment. Use Markdown content compiled to HTML at build time, small shared templates and CSS, and limited JavaScript for search/navigation. A new application framework, remote search service, and database are unnecessary for this scope.

Proposed organization:

```text
docs/site/content/          User-facing Markdown by topic
docs/site/assets/           Publication screenshots and illustrations
docs/site/templates/        Shared shell and article components
docs/site/styles/           Documentation styles and design tokens
docs/site/client/           Search and navigation enhancement
docs/site/navigation.json   Explicit ordering and topic structure
docs/FEATURE_COVERAGE.csv   Authoring and verification inventory
scripts/build-docs.mjs      Content validation and static generation
dist/docs/                 Generated publication output
```

Each article should have stable metadata: `id`, `title`, `description`, `kind`, `section`, `order`, `verified_version`, `verified_commit`, and `last_verified`. Source references can remain authoring metadata. Keep developer-only paths and notes out of the reading flow.

Implementation requirements:

- Use one maintained Markdown parser with a pinned dependency; do not write a custom Markdown engine. Disallow raw HTML by default and explicitly render approved documentation components.
- Emit a real `index.html` per page, stable heading anchors, page titles/descriptions, a sitemap, and explicit redirects for moved published pages. Direct deep links must work on GitHub Pages without an SPA fallback.
- Generate page navigation and a compact local search index from the same content. Index titles, headings, descriptions and body text; rank exact labels/titles above prose matches. Include user synonyms such as Color Workshop/Color Editor.
- Search results show title, topic, excerpt and the relevant section link. Support keyboard operation, clear empty/error states, and a usable page directory if search is unavailable.
- Render readable article content and ordinary links without JavaScript. Do not load the app's renderer or scene state for documentation.
- Update `scripts/build.mjs` to generate docs after its clean step and include generated pages in `dist/`.
- Adjust the development server narrowly to serve generated documentation and assets in both development and `--dist` modes. Preserve its existing protections against serving repository metadata and private files; do not allow the entire raw `docs/` tree.
- Resolve links and assets correctly for local preview, the custom domain, and a repository-subpath Pages preview. Check trailing-slash and nested-page behavior.
- Add app Help and welcome-screen links to the documentation home and first-use guide. Retain the quick-shortcuts dialog. Add selected contextual help links only after stable page anchors exist.
- Initially publish verified English documentation. Indicate that interface language availability differs from documentation translation coverage. Design metadata and routes so translations can be added later without duplicating the initial work.

Validate the exact output/staging arrangement for local preview during the first implementation slice. Only public generated HTML and assets should be served under `/docs/`.

## 9. Existing-content migration

| Existing source | Intended use |
| --- | --- |
| `GETTING_STARTED.md` | First-use guide and task entry points |
| `WEB_APP_USER_GUIDE.md` | Broad topic checklist and readable procedures; reconcile its deployed-release assumptions |
| `USER_GUIDE.md` | Detailed behavior and keymaps; extract user instructions and separate architecture commentary |
| `COLOR_EDITOR.md`, `PAINT_TOOLS.md` | Color, paint, region and scope references; convert architecture details into user consequences only where needed |
| `TURRET_STUDIO.md`, turret and camera documents | Studio, animation, effects, camera and workflow references; separate historical implementation stages |
| `weapon-coverage.md` | Coverage modes, interpretation, assumptions and limitations |
| `IMAGE_EXPORT.md`, `ADVANCED_EXPORT.md` | Export workflows, settings, units, memory and format limitations |
| Graphics, shader and sky documents | Verified appearance/performance behavior; retain implementation research as engineering documentation |

Keep existing source documents while the replacements are written and verified. Update README and app links when equivalent new pages are ready. Preserve engineering references and clearly mark superseded user instructions rather than maintaining conflicting public guides indefinitely. If an old public URL exists, supply a redirect or a visible replacement link.

## 10. Implementation sequence and review gates

| Phase | Work and concrete deliverables | Exit condition |
| --- | --- | --- |
| 1. Baseline and inventory | Select target release/commit; audit all editors, panels, menus and dialogs; create coverage CSV, terminology list and source-conflict log | Every shipped feature/control group has an owner page or recorded disposition; version/input discrepancies resolved for the target |
| 2. Design and working vertical slice | Implement shared shell plus home, Painting guide and Image Export reference using real captures; wire build, local preview and basic local search | Three working pages visibly follow the approved concepts; nested links work; desktop and narrow layouts reviewed |
| 3. Foundation and data safety | Publish-ready import/textures, navigation, editor overviews, saving/files, folder access, storage/recovery and preferences instructions | A first-time user can import, inspect, save, reopen and export a game copy using the docs alone |
| 4. Detailed editor and feature coverage | Complete paint/color, structure, appearance, library, attachments, coverage, Studio, timelines and remaining export references; document experimental features separately | Every in-scope inventory row maps to verified content; all seven editor overviews exist |
| 5. Integration and migration | Add Help/welcome and selected contextual links; update README; resolve superseded pages; finish aliases, metadata and related links | Entry points lead to canonical pages without competing instructions or broken links |
| 6. Release verification | Run content, accessibility, build and manual workflow checks; review screenshot accuracy and fixture rights; prepare deployment-ready artifact | All acceptance criteria below pass against the chosen release; remaining experimental limits are explicit |

Review the working three-page slice before scaling article production. This gives a concrete opportunity to refine visual density, screenshots, tables and navigation while changes are inexpensive.

## 11. Validation and acceptance criteria

Automated checks should cover behavior and publication failures rather than snapshot every sentence:

- Required article metadata, unique page IDs/routes/anchors, valid navigation entries, and coverage mappings.
- No unresolved internal links, missing images, missing required image descriptions, or references to unpublished pages in the release navigation.
- Static generation includes all expected pages and search data; direct page URLs and assets resolve in the built preview.
- Server routing permits public documentation but continues denying raw repository files and traversal attempts.
- Search smoke cases for Brush, Replace Color, Color Workshop, sockets, Weapon Coverage, Save Project, XML and transparent render.
- Keyboard navigation, drawer/search focus behavior, semantic page structure and automated accessibility checks where available.
- Existing `npm test` and `npm run build` pass after integration changes.

Manual acceptance:

1. Compare the home, guide and reference layouts with the approved visual concepts at desktop and narrow widths; check long tables, screenshots, focus indicators and zoomed text.
2. Perform the documented first-use, paint/undo/save, attachment/coverage and export workflows against the target build. Verify instructions for every supported input preset.
3. Confirm every inventory row is verified or explicitly out of release scope; no empty placeholder articles appear in published navigation.
4. Verify visible labels, file-format distinctions, persistence, coordinate conventions, approximation limits and release metadata.
5. Confirm all instructional screenshots are actual target-build captures, have explanatory text and use distributable example assets.
6. Load published output directly at nested URLs, reload it, follow anchors, use browser Back/Forward, and read an article with JavaScript disabled.

The documentation release is complete when these checks pass and its coverage inventory matches the selected application release. Feature additions after that baseline become separate tracked documentation updates.

## 12. Ongoing maintenance

Feature changes should update their affected inventory rows and canonical pages in the same change. Re-capture screenshots when visible controls or their behavior change; cosmetic differences that do not impair instructions can be scheduled separately.

Track last verification per article instead of showing a fabricated globally current badge. Maintain a short documentation change log and a review list for experimental or rapidly changing areas. Avoid promising full historical version documentation until the project needs it.

The first implementation task should be Phase 1 followed by the three-page vertical slice. Defer remote search, user accounts, embedded live 3D demos, a CMS, broad translations, and historical-version hosting until there is a demonstrated need.

## Checkout correction

The implementation now lives in `C:/Users/joshu/OneDrive/Documents/GitHub/Avorion-Viewer`, version 0.12.0. Earlier findings about the separate 0.11.0 workspace are historical. This checkout uses Ctrl+Shift+Space for Focus Mode and disables Trackpad; its documentation has been adjusted accordingly. XR/AR instructions from the other workspace are excluded from published navigation. The window-system screenshot is labeled as an earlier-build reference pending recapture.

## Manual format decision — November 19, 2026

The user selected the Blender Manual hierarchy and the upstream Furo format. The implementation now uses real Sphinx + Furo with MyST Markdown, replacing the earlier custom Node HTML shell. The canonical tree is `docs/site/manual.json`: Introduction; User Interface and its window-system chapters; Editors with nested tools and features; Model Project; Workspace Profile; Export; Textures; Reference. Images use captioned figures with full-resolution targets, GIFs have static posters and explicit playback, and small local interactive illustrations progressively enhance the prose. Python is a build dependency, not a published-site runtime. The CI workflows install pinned documentation dependencies. Existing release-verification requirements still apply.
