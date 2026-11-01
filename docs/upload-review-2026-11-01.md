# Upload review — 2026-11-01

Reviewed the public main-branch snapshot at 12a97f9eb06bd57c980549b44fb0849661abfef7. All uploaded implementation/test files matched the local workspace after line-ending normalization. The GitHub README and repository-only license/attributes were preserved.

## Changes

- Remove 51 tracked files: three obsolete drop-in/backup directories (`_backup-before-directional-slice`, `directional-slice`, `weapon-coverage-improvements`), two generated HTML verification reports in `output`, and two runtime logs. None are imported by the current app, build, workflow or retained tests. Git history retains the old copies; local backup directories are not deleted.
- Expand ignore rules for those artifacts, logs, environment files and private-key files. Ignore rules alone do not remove previously committed secrets from history.
- Restrict the loopback development server to application entry points, `src`, and retained `prototypes`. Reject dotfiles, Windows backslash/alternate-stream paths, non-read methods and foreign Origin headers; resolve symlinks before checking root containment. Add MIME sniffing protection. Normal localhost redirects still lead to the canonical storage origin.
- Add PR validation with read-only repository permissions, clean dependency installation without lifecycle scripts, tests, build and high-severity production dependency audit.
- Correct an existing stale sky-settings test: World settings moved into their own Properties section, but the assertion still searched Viewport preferences. This pre-existing test failure would block Pages deployment.

## Findings and verification

The old server served any file under the working directory, including `.git/config`, `.env` and logs when present. Loopback binding reduces exposure but does not justify exposing repository/private files to local clients. Regression tests cover allowed assets, blocked paths, Origin checks, methods, redirects and HEAD responses. Symlink targets outside the application root are denied.

`npm audit --json` completed against the current npm advisory database with zero reported vulnerabilities. This covers lockfile dependencies, not a formal audit of vendored JavaScript/WASM or application logic. Automated token/private-key pattern checks found no matching credentials in the locally matched uploaded files. This is not proof that no secrets exist, and the entire historical commit graph was not scanned.

Reviewed HTML insertion sites and file-import flows: dynamic model labels use textContent or escaping in the inspected paths; no confirmed imported-name script injection was found. Large locally selected models/textures can still exhaust browser resources. Existing structured project validation and export memory limits were retained.

Retain `prototypes/turret-lab`: current tests import it and browser checks use its page. Retain `src/vendor`, vendor licenses, WASM, source textures/data, lockfile, tests and docs: they are runtime, reproducibility or maintenance inputs. Do not replace bundled third-party license notices with the repository MIT license.

The upload contains developer-specific paths in some browser checks. They are not credentials, but those checks are not portable without the original fixtures/runtime. Standard Node tests and the static build are the portable automated gate. Browser fixtures, dependency updates and commit-pinned GitHub Actions are follow-up maintenance opportunities. Branch protection and GitHub secret-scanning settings were not changed.

This is a focused repository hygiene and security review, not a penetration test or certification. Cleanup is delivered on a review branch so the main-branch Pages deployment is not changed without merging it.
