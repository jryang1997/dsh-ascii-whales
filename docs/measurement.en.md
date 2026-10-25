# Reproduce the resource comparison

The tool compares OFF, standard, and economy on one deterministic simulated conversation. It runs the production renderer in an isolated Chrome file fixture. It does not contact a model or installed DSH.

Use Node 24.19.0 and pnpm 11.28.5. Install frozen dependencies, build, generate the preview, and run verification before measuring.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm preview
pnpm verify
node scripts/measurement.mjs --headless --conditions off,standard,economy --rounds 5 --warmup-ms 30000 --sample-ms 60000 --out .scratch/full-three-condition-new
```

The default is three rounds. Five rounds satisfy the benchmark repetition checklist and produce 45 units, each with 30 seconds of warmup and 60 seconds of sampling. Allow at least 67.5 minutes. Stop concurrent builds and record the actual power mode and background load. The first three rounds rotate each condition through all three order positions. Five rounds differ by at most one occurrence per position. Baseline-only runs accept `--conditions off,standard`.

For tool validation, use a short smoke run.

```sh
node scripts/measurement.mjs --smoke --headless --conditions off,standard,economy --rounds 1 --warmup-ms 1000 --sample-ms 2000 --out .scratch/smoke-new
```

A smoke run has no benefit verdict. Headless visibility is recorded explicitly and does not establish visible-window pointer or visual acceptance. GPU configuration stays enabled as Chrome normally selects it.

Inputs use seed 20261025, a 1280 × 800 viewport, DPR 1, and the same normalized visual configuration. OFF retains all host content and fixture events. Idle has no content events. Append adds deterministic simulated text every 250 ms. Scroll moves 6 CSS pixels every 50 ms with deterministic wraparound. Every scenario-round tuple must share content hash, planned events, config, seed, viewport, and requested duration. Never combine an old-build standard baseline with a new-build economy sample.

The tool validates actual RAF or timer callbacks, internal physical integration ticks, draw passes, and layout work. Every registered metric retains real counts and synchronous execution time. Stable animation draw budgets are 30 Hz for standard and 15 Hz for economy. Event and layout refreshes remain separate and count toward total work. Nested durations must not be added together. Budget values are not measured device frame rates.

Status probes run outside CPU sampling. Both DOM text commit and completed Canvas draw must meet 250 ms, separately, for ordinary events, bursts, paused animation, and reduced motion. The DOM endpoint is the fixture's `onActivityChange` textContent commit. It does not measure installed DSH React commits or speech onset. Shipped artifact tests cover the host subscription path separately.

CPU deltas cover the isolated Chrome tree, including browser, renderer, GPU and utility CPU, fixture work, and CDP overhead. Single-core percent divides CPU seconds by elapsed wall time. Machine percent also divides by logical processor count. Process-tree changes or missing queries produce null with a local reason. GPU process CPU is not GPU utilization. GPU utilization, power, battery energy, and endurance remain unmeasured.

Profile a separate diagnostic run before interpreting a difference.

```sh
node scripts/measurement.mjs --limiter-probe --smoke --headless --conditions off,standard,economy --rounds 1 --warmup-ms 1000 --sample-ms 5000 --out .scratch/unreported-profile-new
```

Profiles are saved as `*-unreported.cpuprofile`. Their instrumented numbers are excluded from the public report. Map hot spots to source, then run the full comparison without profiling. The tool always leaves the benefit verdict inconclusive. A complete dataset does not itself prove G2-08. Missing CPU, unknown bottlenecks, noise, or regressions prevent a benefit claim.

Local output preserves raw snapshots, events, initialization, warmup, errors, environment, CPU scope, content and build hashes, screenshots, and status probes. Schema version 2 validates all expected groups and rounds. Missing groups are present with null summaries. Failures keep partial evidence and do not become a successful full comparison.

Only `report-public.json` and `report-public.md` are intended for review before sharing. They use allowed numeric aggregates, each round, medians, ranges, and explicit missing fields. They exclude local paths, task text, profile directories, process IDs, raw inventory, and operator notes. Keep other files local. Actual DSH, screen reader, visible pointer, and visual acceptance remain separate evidence.

See the [Chinese protocol](./measurement-protocol.zh.md), [bilingual report template](./resource-report-template.md), and [current evidence status](./resource-report-status.md).
