# Attachment UX implementation checkpoint

The eight-phase plan is not yet fully implemented or accepted. Do not treat passing unit tests as release approval.

Implemented locally: attachment selection/context routing and pinned inspector plumbing; reorganized Properties and mixed component transform fields; shared placement strip and stable target helper; explicit component/turret replacement hooks; socket states and coordinate-space controls; asset provenance/update controls and workspace draft-close handling; serialized component-history changes; structured embedded restoration results and repair preview/attach/undo.

Verified at this checkpoint: 417 Node tests pass; static build passes; mounted-texture WebGL check passes (late loading, Solid/blueprint switching, real body rotation with stable projection coordinates); embedded restoration browser check passes including missing-block repair and undo.

Outstanding before declaring the plan complete:

- Finish and audit shared gizmos across turret/component instances and both asset attachment workspaces; validate axis constraints, local/socket/ship transforms, simulation pause/resume, and cancellation.
- Verify selection, pinning, multiple inspectors, mixed selection, narrow layouts, and keyboard focus in the real app. UI automation selectors must follow the newly contextual inspector.
- Verify all library lifecycle controls, stale/missing source assets, update/replacement compatibility previews, and cancel behavior.
- Verify failed/delayed saves, undo during saves, model changes while saving, retry recovery, and imported setup replacement. Review shared history/persistence changes for race conditions.
- Run complete viewport placement browser tests: empty/occupied/invalid sockets, hover feedback, drag/click/keyboard placement, target hysteresis, and resource cleanup.
- Measure representative small/medium/dense model performance and GPU resource lifecycle, perform visual review, update user documentation, and reconcile every acceptance criterion in ATTACHMENT_UX_PLAN.md.

Delegated workers hit the session usage limit before completing these checks. Their changes remain in the working tree. No commit, push, or deployment was performed.
