# Inventory remediation — implementation status

2026-09-29: core posting, transfer documents, manual outbound reversal and internal issue/full recovery implemented. No production deployment or data migration has been performed. The detailed checklist is in `docs/inventory-remediation-plan.md`.

Implemented:

- Count creation reads warehouse/balances/catalog/variants/units sequentially in one snapshot transaction and saves the count with majority commit. `snapshotStartedAt` records the successful transaction attempt's server start time, not MongoDB's exact snapshot timestamp; old counts are not backfilled. Creation does not mutate balances. Approval compares the entire warehouse balance set, detecting added/removed SKU rows as well as changed versions; empty snapshots no longer generate an invalid empty `$or` query.

- Count quantity/note edits require the client's numeric `expectedVersion`; stale screens fail with 409 before any save. Offline quantity edits retain their original version; unversioned legacy entries and conflicts are retained for reconciliation, never silently rebased. Same-tab queue replay is coalesced and preserves newer queued changes. The UI sends the displayed version and offers a confirmed reload that waits for active replay and fetches successfully before discarding that count's pending edits.

- Count saves now use optimistic concurrency on the existing `version` field. Scan retries re-read status and identifiers, at most five times, only for version conflicts; edits and transitions return 409 on stale writes. Concurrent scans preserve both machines and deduplicate aliases for the same unit. Stock-conflict marking is restricted to the original pending count/version and no longer runs for unrelated 409 errors.

- Mandatory inventory transactions, including direct stock movements and receiving confirmation. Existing caller transactions are reused; standalone/disabled transactions are rejected rather than partially applying writes.
- Manual stock-log writes now use a dedicated transactional service. Product/variant/warehouse relationships and tracked-unit quantities, identity, location and availability are validated on the server.
- Posted documents cannot be modified or deleted through generic CRUD. Repeating the same completion request is safe. Secondary-warehouse documents retain their persisted warehouse on status-only updates.
- Manual create request keys are fingerprinted and checked, including concurrent draft creation. The outbound form retains its key across retries while the payload is unchanged.
- Outbound ledger and manual-document cost snapshots use the current average inventory cost. Generated legacy logs retain warehouse and variant identity.
- Serial registration rejects scope overrides and validates catalog and warehouse scope, with registration and event writes in one transaction.
- Serial/unit-barcode registration fills unassigned existing on-hand quantity only. It writes the scoped balance version before counting in-stock units, serializing concurrent registrations and conflicting stock writes. Quantity, reserved quantity and valuation remain unchanged. Missing/nonpositive/fractional stock and excess identifiers are rejected; failed batches roll back every unit, event and balance-version change. Receiving first posts stock and then registers units in the same transaction.
- Historical after-sale receipt backfill explicitly validates the old ledger rather than relying on permissive stock-writer replay.
- Separate Node/Vitest inventory runner, integrated into CI, with replica-set regression tests for partial failures and concurrency.
- Transfer documents atomically post source → transit → destination, or transit → source on cancellation, for quantity and serial/unit-barcode stock. Each shipment has an isolated transit warehouse and frozen cost; transit cannot be sold, manually posted or selected for counting.
- Dispatch fingerprinting, terminal-state replay and transaction conflicts prevent duplicate or competing acceptance/cancellation. Serial events reference a distinct shipment ID; historical participants can read the machine history within the company.
- New branch-scoped transfer tab supports multiple SKUs, exact machine identifiers, full-document receipt, cancellation reasons and permission-aware controls. Serial-list transfer controls open this workflow.
- Legacy per-unit request/accept/cancel endpoints delegate to the same documents and require request/document keys. Direct transfer and generic transit state changes are blocked. Per-unit adapters cannot accept/cancel a bulk document.
- Full manual outbound reversal creates a linked, immutable inbound StockLog and ledger at original cost. Source linkage, stock, legacy Product stock, serial state and events commit together. Same-reason retries replay; competing reversals serialize on the source document. The authenticated actor and reason are recorded.
- Outbound detail offers explicit reversal confirmation for inventory managers. Reversed vouchers are marked in the list, detail and printout, and excluded from effective issued-quantity metrics alongside drafts.
- Internal serial/unit-barcode issue uses `internal_use`, with recipient, issue date, source document and frozen cost on the unit. Recipient and reason are mandatory at posting. Authenticated CRUD actors are passed separately from client payload and recorded on the posting and serial events.
- Full internal recovery reuses the linked reversal workflow, validates the active allocation and clears it atomically with restoring stock at original cost. Generic lifecycle bypass, sale and transfer of allocated machines are blocked; stock-count expectations and sale selection exclude allocated machines.
- Serial registry exposes internal status, recipient, cost and source document; outbound detail offers full internal recovery. Recipient is a text snapshot, not a validated employee foreign key.
- Read-only reconciliation CLI uses an explicit database/company scope and one snapshot session. It streams JSONL/CSV findings for balances, ledger references, tracked units, receiving, transfers, internal allocations and reversal links. External opening baselines are supported; missing historical evidence is reported for review rather than assumed to be zero. Partial reports cannot be mistaken for complete runs. See [usage and limits](reconciliation/README.md).

Operational behavior to review before deployment:

- GoodsReceipt numbering allocates an atomic per-company/branch/business-day counter with a deterministic unique `_id` and majority write concern. Allocation is outside receipt persistence, so failures leave gaps and deleted receipts do not release numbers. Codes use the full branch ObjectId rather than its mutable/sanitized label. Existing receipt codes remain unchanged. Retry is bounded and only recognizes relevant duplicate-key errors.
- Receipt numbers follow `INVENTORY_TIME_ZONE` (default `Asia/Ho_Chi_Minh`) at creation, not client-supplied receivedAt. Invalid timezone configuration fails explicitly. Back up/restore `inventoryreceiptcounters` alongside receipts; never reset counters. New format: `PN-<FULL_BRANCH_OBJECT_ID>-YYYYMMDD-000001`. Count and other document numbering are unchanged.

- Inventory writes now require MongoDB replica set or sharded-cluster transactions. Production topology has not been inspected.
- Manual stock-log transfer posting is rejected: use the new Điều chuyển tab. Internal issue and full recovery are supported; partial recovery, reassignment, damaged/lost equipment and fixed-asset depreciation are not enabled by this workflow.
- Old `in_transit` machines without a new transfer document require separate reconciliation; no historical balances or documents are synthesized automatically. Lot-tracked and partial transfers are not enabled.
- Manual outbound reversal is implemented. Inbound, retail/debt-linked and transfer documents are excluded from this endpoint; partial correction and automatically linked replacement documents remain open. Posted documents stay locked.
- Reversal requires matching source ledger, a valid nonnegative existing balance, and each machine still in its original outbound state/location with no later event. Historical inconsistencies require reconciliation rather than forced restoration.
- This batch does not repair historical discrepancies or assert that all writers in retail/repair are transactionally consistent with their parent documents.

Remaining from the plan:

- Run the reconciliation tool on staging/copied data, review findings and implement evidence-based historical-data repair. The CLI itself is complete; no real-data scan or repair has run.
- Reconcile legacy in-flight transfers before production cutover.
- Unified general serial-state transitions. Registration against existing balances is complete; other lifecycle endpoints still require review. Registration increments balance version so old count snapshots must handle a conflict when their machine list changes.
- Inbound/business-document reversal, partial correction and linked replacement documents; extended internal-use handling and remaining non-manual writer actor audit.
- Remaining retail/repair cost consumers and document-level atomicity; return/reversal cost policy and negative-stock valuation.
- Review numbering for other document types; independent count approval/self-approval policy and conflict recreation UX. Consistent count creation snapshots and client versions for quantity/note edits are implemented; lifecycle commands still use server-side optimistic concurrency without client versions. Cross-tab/account queue redesign remains open. Receipt creation request idempotency remains separate from unique numbering.
- Branch-scoped UI refresh, server pagination/aggregates and sales-only forecasting.
- Staging migration rehearsal and deployment/rollback verification.

Verification commands:

Latest count-snapshot verification: 34 Node + 208 Vitest tests passed (242 total), repository-wide typecheck and frontend/backend production build passed. Six new replica-set tests cover stock changes between snapshot reads, added SKU rows, empty snapshots, warehouse scope/transit, disabled transactions and document persistence failure. Previously recorded customer-module typecheck errors no longer appear in this run; this batch did not modify customer code. The bundle-size warning remains. No production deployment or historical data repair was performed.

Latest stale-screen/offline verification: 34 Node + 202 Vitest tests passed (236 total), frontend/backend build passed with the existing bundle warning. Added two backend, six offline service and two UI tests. Typecheck reports no inventory errors; the same five customer-module errors remain (purchase-history tests 172/179/180; detail modal currently 261/617). The edit API now requires `expectedVersion`, so deploy frontend/backend together. No production deployment or data repair was performed.

Latest count-concurrency verification: 34 Node + 192 Vitest tests passed (226 total), frontend/backend build passed with the existing bundle warning. Eight new integration cases cover concurrent distinct/duplicate/unexpected scans, edit/scan versus submission, bounded retry, competing approvals and rollback on unrelated 409 errors. Typecheck reports no inventory errors but five customer-module errors remain: `customer-purchase-history.service.test.ts` lines 172/179/180 (`deviceInfo`, `statusLabel`, `warrantyInfo`) and the two previously documented `CustomerTransactionDetailModal.tsx` errors. Repository-wide typecheck is not green. No production deployment or data repair was performed.

Receipt-numbering verification: 34 Node + 184 Vitest tests passed (218 total), and frontend/backend production build passed with the existing bundle-size warning. Eight new cases cover 12 concurrent receipt creations, deletion/branch renaming, failed persistence, occupied codes, bounded retry and unrelated unique errors, tenant/branch/day scope, timezone midnight and sequence exhaustion. After correcting the receipt payload's literal status type, typecheck reports only two errors outside inventory in `CustomerTransactionDetailModal.tsx`: line 252, unsupported icon `title`; line 538, missing `discountAmount` on `CustomerPurchaseHistoryItem`. Repository-wide typecheck is therefore not green. No production deployment or historical data change was performed.

Verified locally after the transfer batch: 34 Node tests and 124 Vitest tests passed (158 total), typecheck passed, frontend/backend production build passed. This includes 14 transfer replica-set tests and 5 transfer UI tests; the 3 former mocked serial-transfer tests were replaced by integration coverage of the same workflows. The build reports a bundle-size warning for a chunk larger than 500 kB; no build errors. Integration tests use isolated MongoDB replica sets, not production data.

Latest verification after manual outbound reversal: 34 Node + 140 Vitest tests passed (174 total), typecheck and frontend/backend production build passed. Added 10 replica-set reversal cases and 6 UI/metrics/print cases. Coverage includes historical cost, concurrent replay, serial sale/disposal, later-event rejection, rollback, scope/source validation, legacy Product synchronization and missing/negative balance rejection. The bundle-size warning remains.

Internal issue/recovery verification: 34 Node + 152 Vitest tests passed (186 total), typecheck and frontend/backend build passed with the existing bundle warning. Added 9 replica-set cases, one CRUD actor forwarding case and two UI cases. A type-only correction moved `as const` onto each string literal in the existing customer purchase-history ternary to resolve TS1355; its runtime behavior is unchanged.

Latest reconciliation verification: 34 Node + 167 Vitest tests passed (201 total), and typecheck passed. Added 15 native replica-set cases, including actual CLI runs, no-write command monitoring, stable snapshots during concurrent changes, baseline drift, tenant isolation, historical receiving, internal cost, retail/repair references, bounded reads, CSV formula escaping and incomplete-output handling. These checks use isolated local fixtures. This CLI-only batch did not rerun the application build. Retail/repair financial semantics and per-lot identity remain outside this audit's coverage.

Registration-capacity verification: 34 Node + 176 Vitest tests passed (210 total), typecheck and frontend/backend production build passed. A bundle remains larger than 500 kB. Nine new replica-set cases cover capacity, reserved stock, invalid/missing balances, claimed-source bypass, full-batch rollback, competing registrations, warehouse isolation, legacy identifiers, event failure, receipt confirmation/replay and concurrent tracked outbound. No historical data was modified.

Additional checks: updated serial API contract tests pass (3/3). The repository-wide `permission-route-inventory.test.ts` has 3 failures: two webhook alias/mount expectations and a baseline expecting 44 findings while the scanner reports 51. All six new transfer routes have the expected read/manage permission with zero scanner diagnostics; the findings are in other router files. The baseline and webhook code were not changed to hide these failures.

```sh
npm run test:inventory
npm run typecheck
npm run build
```
