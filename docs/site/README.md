# Manual authoring

The manual uses **Sphinx + Furo**, with MyST Markdown. It deliberately uses the real upstream theme instead of a parallel navigation/search/layout implementation. Furo provides light/dark/auto modes, responsive navigation, nested section trees, headings and search.

## Local setup

Use Python 3.12 and Node.js 22 or newer. On Windows:

    python -m venv .venv-docs
    .venv-docs/Scripts/python.exe -m pip install -r docs/site/requirements.txt
    npm ci
    npm run dev

On macOS/Linux use .venv-docs/bin/python for the install command. The build finds this virtual environment automatically. DOCS_PYTHON can select another interpreter that has the requirements installed. Python is a build dependency; the published site remains static. CI installs the same documentation requirements before tests/build.

## Structure

- manual.json is the single, nested publication tree: Introduction, User Interface, Editors, Model Project, Workspace Profile, Export, Textures and Reference. Its child nodes are chapters, not competing flat topic groups.
- content/ contains editable Markdown. Use one H1 per article, H2 for sections, H3/H4 for subsections. Long features can be child chapters; short control descriptions belong within the editor reference.
- navigation.json retains authoring verification metadata and feeds the coverage inventory. manual.json controls publication order.
- conf.py selects the upstream Furo theme and MyST features. static/ adds only media styling and optional interactive examples.
- scripts/build-docs.mjs prepares generated MyST sources and runs a warning-as-error Sphinx directory-HTML build. .sphinx-source/, public/, and .venv-docs/ are ignored.
- redirects.json preserves previously shared URLs. Do not point a redirect at another redirect.

Run node scripts/build-docs.mjs --dev after content changes; npm run build publishes dist/docs/. Read it through the local server, not file://, so search can load its local index.

## Figures and animations

Use a MyST figure directive with descriptive alt text and a concise caption. Plain Markdown images are also converted to captioned figures during staging. Sphinx copies and fingerprints image resources. Native GIFs are supported, but long or motion-heavy examples should use the Areas chapter's explicit Play/Stop pattern with a static poster. Never autoplay instructional motion. Make the result and essential steps understandable from the text alone.

Real examples are under assets/ and the downloadable, original Tutorial Courier is under examples/. Run node scripts/capture-doc-examples.mjs for rendered outputs and UI captures; node scripts/capture-manual-animation.mjs records the divider-resize GIF and poster. The latter uses Pillow from the docs environment.

## Interactive components

The Window System chapter contains a keyboard-operable layout illustration. It is explicitly an illustration and does not claim to edit the app. Its range and editor selector are progressively enhanced by static/manual-media.js. Keep widgets local, small, optional, and accompanied by a static explanation. Authored raw HTML is supported by MyST; do not import untrusted HTML or execute scripts from model files.

## Validation

node scripts/docs-inventory.mjs refreshes section-level coverage. npm test includes a complete Sphinx build, asset/link checks, and old-route checks. node tests/documentation.check.mjs uses the repository's cached Playwright/Edge convention to test nested navigation, search, GIF controls, reduced motion, mobile, and no-JavaScript reading.

The legacy Blender-manual Help link remains until content and screenshot verification is complete. A successful build is not evidence that every app control has been documented or every workflow verified.

References: https://docs.blender.org/manual/en/latest/interface/window_system/introduction.html and https://github.com/pradyunsg/furo . Furo's generated attribution remains visible in the footer.

Run `node scripts/capture-manual-ui.mjs` to refresh focused interface and editor captures. Images of narrow bars are intentionally shown at their natural scale; use figure alt text/captions to explain the controls rather than baking all instructions into pixels.

## Detailed image coverage

Run `node scripts/capture-manual-details.mjs` for 3×-density captures of individual visible viewport/paint tools, header controls, Properties category symbols and property panels. `DOCS_EXAMPLE_XML` can select the future user-provided ship instead of the temporary fixture. The capture manifest records labels, page mapping, CSS/pixel dimensions and incomplete captures. Do not mark fixture-dependent controls fully covered when they are absent or clipped. `image-annotations.json` stores normalized highlight rectangles for broad screenshots; these also appear in the image modal.

The embedded window example imports copies of the app’s actual layout, divider and keymap modules during the documentation build. Its lightweight editor content is isolated and never reads or writes application persistence.

Reference images are embedded in collapsible galleries, organized by their editor/section rather than exposed as separate navigation pages. The capture manifest is a record of what was actually visible, not proof that asset-dependent or hidden controls are fully documented. Retake after the intended example XML is supplied.

After refreshing captures, run `node scripts/publish-manual-media.mjs` to update the collapsible reference galleries and `docs/MEDIA_COVERAGE.json`. This step is repeatable and replaces its own generated sections. Broader UI captures also use 3× density; GIF recording stays smaller to avoid excessive animation downloads.

Reference images are embedded in collapsible galleries, organized by their editor/section rather than exposed as separate navigation pages. The capture manifest is a record of what was actually visible, not proof that asset-dependent or hidden controls are fully documented. Retake after the intended example XML is supplied.

## Place images with their controls

Control captures belong beside the corresponding explanation: tool icons in tool-table rows, category symbols in the property-tab table, and panel images within the relevant task or property subsection. Do not collect them in a separate gallery chapter. `scripts/publish-manual-media.mjs` maintains this placement and can be rerun after capture updates.
