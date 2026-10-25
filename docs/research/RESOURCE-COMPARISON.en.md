# Resource comparison report (2026-10-25)

Economy observed lower Chrome process-tree CPU use and less actual continuous scheduling, motion integration, and drawing than standard in this controlled fixture. The finding covers this machine, build, and simulated workload. It does not establish resource benefits, faster execution, or longer battery life in actual DSH. Turning the plugin off still used the least CPU.

[中文报告](./RESOURCE-COMPARISON.zh.md) · [Machine-generated public data](./resource-comparison-20261025.json) · [Delivery and acceptance status](../resource-report-status.md)

## Workload and evidence identity

The full run completed on 2026-10-25 between 14:32 and 15:40 (UTC+08:00). Three conditions shared the build, seed, content, and event plan. Each condition covered idle, simulated text append, and scripted scroll, with five rounds per scenario: 45 valid samples. Each unit warmed up for 30 seconds before a 60-second sample. Condition order rotated by round: off → standard → economy, standard → economy → off, economy → off → standard, then the first two orders again. Five rounds do not balance order frequencies as completely as six rounds would.

| Identity | Checked value |
| --- | --- |
| Candidate commit | `10372bd3077cc0d3ae5f89943e942a760abf170f` |
| Build hash | `7d46cca603779f2b92e06e403af7a1f9795fc8691f65d66bd5bc416ecf6a2f6e` |
| Formal [client.js](../../client.js) SHA-256 | `8932eee48492cb7338c7a15e2043fc922407b2bfa4460ca9f9aece219f8dd518` |
| Current source identity | All 29 recorded source and artifact hashes match current files; the build hash also matches when recomputed with the original serialization |
| Public JSON SHA-256 | `05adc88c9aaa8a6d783a589ae695136477fd3b670b34fdbf6d052d894229d054` |

This report task changes documentation only. Frozen sources and the measured build identity are unaffected by new, uncommitted documents. The independent React manifest names an earlier commit, but all 13 of its source hashes also match current files. Commit labels alone would misrepresent that source relationship.

The recorded environment was Windows 11 Pro x64 (10.0.26300), Intel Core i5-13490F, 16 logical processors, about 32 GiB RAM, Chrome 155.0.8059.85, and Node v24.19.0. Chrome recorded an AMD Radeon RX 9070 XT, AMD driver 32.0.32015.7029, and ANGLE D3D11. A native query recorded the High performance power scheme. This does not measure instantaneous power or the Windows power slider. Desktop applications remained open: the host was not idle, and rotated order cannot remove all background interference.

The isolated headless Chrome file page uses [measurement-fixture.js](../../scripts/measurement-fixture.js), a 1280 × 800 viewport, and DPR 1. It contains fixed simulated conversation cards, three glyph whales, frosted reading protection, wind, and clouds; rain is off. Reduced motion and pause-on-scroll are off during sampling. Append events use a fixed plan, with no real model, network streaming response, or actual DSH page. A headless page reporting visible is not visible-window, pointer, or screen-reader acceptance.

## Absolute CPU values

Each cell is median [minimum, maximum], n = 5 per group. CPU was recomputed from `cpuRaw.before` and `cpuRaw.after` in all 45 raw sample files, then checked against group statistics. The summary was not used as the arithmetic source.

| Scenario | Condition | Single-core-equivalent CPU % | Whole-machine normalized CPU % (16 logical processors) |
| --- | --- | --- | --- |
| Idle | off | 0.108 [0.098, 0.240] | 0.007 [0.006, 0.015] |
| Idle | standard | 42.520 [41.873, 51.436] | 2.658 [2.617, 3.215] |
| Idle | economy | 19.800 [19.727, 20.458] | 1.237 [1.233, 1.279] |
| Append | off | 0.881 [0.866, 0.984] | 0.055 [0.054, 0.061] |
| Append | standard | 45.525 [45.017, 46.817] | 2.845 [2.814, 2.926] |
| Append | economy | 19.824 [19.507, 20.046] | 1.239 [1.219, 1.253] |
| Scroll | off | 7.229 [7.023, 7.368] | 0.452 [0.439, 0.461] |
| Scroll | standard | 48.403 [47.372, 49.196] | 3.025 [2.961, 3.075] |
| Scroll | economy | 27.370 [27.122, 27.703] | 1.711 [1.695, 1.731] |

The formula is `single-core-equivalent CPU % = sum of process CPU-second deltas / (CPU observation elapsedMs / 1000) × 100`. The denominator is the recorded interval around CPU collection, including query boundary overhead, rather than an assumed 60 seconds. Divide that result by 16 for the normalized machine value. A single-core-equivalent 100% represents one logical processor's time capacity. The 42.520% idle standard value does not mean 42.520% of the entire machine.

The scope includes the isolated Chrome browser, renderer, GPU, and utility processes, plus fixture and Chrome DevTools Protocol (CDP) overhead. It is not plugin-exclusive CPU or GPU utilization. Process identities and types remained stable across both snapshots in every sample, with nonnegative CPU deltas. Recomputed values match stored values within floating-point precision. The table excludes CPU from the separate profiling run and does not subtract a historical off result to manufacture a plugin-only benefit.

Economy and standard ranges do not overlap in any scenario. That supports lower observed CPU in this controlled batch. Background variation remains visible: idle standard reached 51.436%, compared with its 42.520% median. These absolute observations do not supply a cross-device ratio, general speedup, energy saving, or battery-life promise.

## Actual work and draw causes

Counts below cover each approximately 60-second sample. Cells are median [minimum, maximum], n = 5 per group. Off recorded zero for every registered plugin work counter, scheduler callback, and nontransparent canvas pixel. Both enabled conditions produced painted output. The [public JSON](./resource-comparison-20261025.json) retains all registered counts and synchronous durations in `groups.work` and individual `rounds`.

| Scenario | Mode | Continuous scheduler callbacks | Internal motionStep ticks | Animation draws | Foreground draws | Total draws |
| --- | --- | --- | --- | --- | --- | --- |
| Idle | standard | 9596 [9338, 9598] | 3600 [3600, 3601] | 1600 [1600, 1600] | 0 [0, 0] | 1600 [1600, 1600] |
| Idle | economy | 768 [759, 769] | 1800 [1799, 1801] | 768 [759, 769] | 0 [0, 0] | 768 [759, 769] |
| Append | standard | 9589 [9515, 9590] | 3600 [3600, 3601] | 1441 [1440, 1441] | 239 [239, 239] | 1680 [1679, 1680] |
| Append | economy | 769 [769, 770] | 1801 [1799, 1801] | 533 [533, 537] | 239 [239, 239] | 772 [772, 776] |
| Scroll | standard | 9592 [9591, 9599] | 3600 [3600, 3601] | 1600 [1600, 1600] | 0 [0, 0] | 1600 [1600, 1600] |
| Scroll | economy | 769 [767, 769] | 1800 [1798, 1801] | 769 [767, 769] | 0 [0, 0] | 769 [767, 769] |

Standard uses RAF for continuous scheduling; economy uses a timer. Active-channel callbacks equal `wakeup`, and the other channel remains zero. Motion integration falls from about 3600 to about 1800 ticks, so actual internal advancement decreases alongside drawing. Idle continuous draws fall from 1600 to 768. The policy also sets economy's swimming multiplier to 0.75; the modes do not promise identical visual sampling or swimming speed.

Text append causes layout refresh. Standard's median total of 1680 draws includes 239 `foreground` refreshes and 1441 animation draws. Economy records 772 total, 239 foreground, and 533 animation draws. Layout measurement is not another draw cause: this batch's draw timeline contains only `animation` and `foreground`. Plugin layout counts in append remain 480 [480, 480] for both modes. Not all work halves, and total draw counts cannot stand in for continuous frame-budget counts.

The [resource policy](../../src/resource-policy.js) caps continuous animation at 30 draws per second for standard and 15 for economy. Every sample passed both the count cap and start-time-spacing checks. Content and task-state refreshes use a separate path, so the continuous 15-per-second cap does not block them. The 250 ms task-prompt threshold is a separate check, not a continuous animation interval.

The initialization RAF probe observed a median callback interval of 6.3 ms; the 45 per-unit medians ranged from 6.2 to 6.3 ms. Headless RAF timing cannot be converted into monitor Hz. The public `physicalRefreshRate` evidence remains unmeasured.

## Limiter evidence and source ownership

A separate diagnostic batch completed nine units and recorded successful browser exit. Its source hashes match the full run. Diagnostic bundles are unminified with source maps, while the reported full-run bundle is minified. All nine profiles were parsed by joining `samples` with `timeDeltas` and nodes, then summing time assigned directly to each function. The following values locate work; they are excluded from reported CPU-benefit arithmetic.

| Function and current source | Ownership | Standard idle diagnostic self time (ms) |
| --- | --- | --- |
| [atmosphereCloudAt](../../src/atmosphere.js#L82) | Cloud-field sampling in drawing and sea masking | 504.448 |
| [deformWhaleParticle](../../src/rig.js#L82) | Whale, fin, fluke, and spine deformation | 489.426 |
| [resolveDepthGrid](../../src/model.js#L337) | Projected triangle depth and glyph-cell coverage | 369.793 |
| [transformParticle](../../src/model.js#L263) | Deformed coordinates and normal transforms | 196.524 |
| [attenuation](../../src/model.js#L530) | Viewport-edge and reading-center opacity | 174.054 |

These functions also appear in the other standard scenarios and economy diagnostics. They belong to the drawing path; the cloud and deformation costs cannot all be assigned to low-frequency `atmosphereUpdate` or `motionStep` counters. Off diagnostics are mostly idle. Append and scroll `dispatch` and `snapshot` do not dominate the named JavaScript hotspots. This does not exclude native browser layout, raster work, or CDP overhead.

The established limits are deliberate pacing and the cost of each draw. The [scheduler](../../src/engine.js#L748) schedules economy's next 66.7 ms timer after the current work, so work and scheduling delay extend the interval. A 15-per-second cap does not imply an achieved 15 draws per second. Idle total synchronous draw time is 11850.1 [11765.9, 14208.8] ms for standard and 6120.0 [6056.0, 6333.0] ms for economy, n = 5. Corresponding `advance` time is only 351.2 [336.9, 416.3] ms and 105.3 [98.9, 108.1] ms. Fewer expensive draws are consistent with the observed CPU direction.

These timings are nested and cannot be added to obtain browser CPU or GPU completion time. The profiled page thread spends much of its time idle, so the evidence does not establish a saturated core or a GPU hardware bottleneck. In the full idle cohort, median renderer CPU seconds are 15.627 and 7.208, while GPU-process CPU seconds are 9.843 and 4.665, each n = 5. The latter describes CPU time consumed by that process, not GPU-engine activity. GPU utilization, GPU timelines, and hardware power were not captured, so remaining cost cannot be assigned precisely to a hardware limit.

## Completeness and task-prompt evidence

The final raw artifacts were audited on 2026-10-25 with these results.

| Check | Result |
| --- | --- |
| Complete units | Expected 45, received 45, valid 45, issues 0, duplicates and missing units 0 |
| Paired inputs | All 15 scenario-and-round triples match content hash, config, seed, event plan, viewport, DPR, requested duration, and profiling flag |
| Executed events | 239 appends or 1199 scroll events per applicable unit; paired kinds, planned times, text lengths, and scroll positions match; maximum event delay 23 ms |
| Snapshots and timelines | 62 complete snapshots per sample, 2790 total, all visible with dropped = 0; counters are monotonic, final counters match totals, every draw and layout event is present |
| Sample windows | Actual duration 60000.6–60015.6 ms; every warmup record exists at approximately 30000 ms; CPU observation windows cover their sample windows |
| Errors and cleanup | Browser errors, failures, query warnings, and recorded Long Tasks are all 0; full run and nine-unit diagnostics both record browserExited = true |
| Statistics and public output | All registered work statistics, browser LayoutDuration, and nine CPU group distributions reconcile; regenerating the whitelist report produces identical bytes |

The full batch's `rendererStatusProbe` writes a synchronous DOM mirror and observes renderer draw completion. It does not mount React, so mirror-write latency cannot prove formal text-commit latency. This report does not relabel it as a React commit.

A separate [status-demo manifest](../images/status-demo-manifest.json), under `reactStatusLatency.probes`, records React 18.3.1, the unmodified formal client, and simulated host subscriptions. Two modes × reduced-motion on and off × normal and burst events × five rounds yield 40 observations. All report visible, an actual waiting badge drawn, and nonzero Canvas commands. The [probe implementation](../../scripts/react-status-probe.js) starts at host-event delivery. A MutationObserver detects formal React summary DOM changes, and a microtask records completion after actual Canvas commands return.

| Independent controlled React observation | n | Median [minimum, maximum] (ms) |
| --- | --- | --- |
| React summary commit | 40 | 2.3 [2.0, 2.9] |
| Canvas commands complete with waiting badge drawn | 40 | 1.95 [1.7, 2.4] |

Both endpoints are within 250 ms in that fixture. The Canvas endpoint excludes GPU presentation, display scanning, and screen-reader speech. These observations are separate from the 45 CPU samples and do not cover actual DSH. The parent task recorded a 401 from the actual GUI; host, pointer, reading-protection, and screen-reader acceptance remain open.

## Conservative machine verdict and unknowns

The [public JSON](./resource-comparison-20261025.json) is an unaltered copy of the machine-generated whitelist report. It retains `verdict = inconclusive; no performance benefit or energy claim`, `formalReactCommitLatency = unmeasured`, and the unmeasured `evidence.limiterProfile` statement. These fields describe evidence joined by that batch's report generator. The generator does not automatically join the separate React manifest or the nine-unit diagnostic run. Its generic requirement for full repeated runs and separate profiling does not mean the completed 45-sample run is still missing.

This human report verifies and describes those independent records and the lower observed CPU within the controlled cohort. It does not rewrite the machine verdict, fill nulls with guesses, or declare all acceptance complete. Raw run and diagnostic packages stay local. Public artifacts contain whitelist aggregates, numeric rounds, and allowed hardware models and versions, without raw environment paths, task text, credentials, process IDs, or process inventory.

| Finding class | Boundary |
| --- | --- |
| Verified, grade A raw measurements | CPU and actual internal work decrease within the current controlled fixture; the full run, independent hotspots, and independent React endpoints can each be recomputed |
| Inference | Fewer scheduler callbacks and draws explain the direction; current diagnostics do not allocate every Chrome-tree CPU difference to a function |
| Unmeasured | Actual DSH resource benefits and visual, real-pointer, and screen-reader acceptance; GPU utilization, energy, power gain, battery life, physical refresh rate, and cross-device effects |

The [historical baseline](./MEASUREMENT-BASELINE.zh.md) and its [JSON](./measurement-baseline-20261025.json) belong to the earlier `b6bf1111656315423f8d921fdd967a02a29d42eb` build. They remain historical tool evidence and supply no new ratio here. This report withdraws the stale status-page and README wording that full sampling and limiter profiling are still unmeasured. Actual-host and screen-reader limits remain, and acceptance items are not closed.

This task only checks existing data, source hashes, whitelist privacy, and document links. No measurement, build, or full test suite was rerun. Protocol and future reproduction commands are in the [English method](../measurement.en.md) and [中文方法](../measurement.zh.md).
