# Resource comparison report (2026-10-31)

In this controlled Chrome fixture, the economy resource mode observed lower browser-process-tree CPU than the standard mode, and it performed less continuous scheduling, whale integration and drawing work. The result covers only this machine, this merged build and the simulated scenarios. It is not a resource, speed or battery claim for actual DSH. Turning the plugin off still used the least CPU.

[中文报告](./RESOURCE-COMPARISON.zh.md) · [Machine-generated public data](./resource-comparison-20261031.json) · [Delivery and acceptance status](../resource-report-status.md)

## Measurement target and evidence identity

The full sampling ran from 2026-10-31 14:58 to 2026-10-31 16:06 (UTC+08:00), about 68 minutes. All three conditions shared one build, seed, content set and event plan. Each condition covered idle, simulated appended text (append) and scripted scrolling (scroll), with five rounds per scenario and 45 valid samples in total. Each unit used a 30-second warmup followed by a 60-second sample. The three conditions rotated per round: off → standard → economy, standard → economy → off, economy → off → standard, then the first two orders again. Five rounds are not six, so order counts are not perfectly balanced.

| Identity | Check |
| --- | --- |
| Candidate commit | `551fa13711632785857b5d42df65e7492cdce0ac` (integration branch on top of 1.0.0, short `551fa13`) |
| Build hash | `0574321c25934b550cb095060fcb16a87388a4e72ed0927dd295a57914d6963e` |
| Shipped [client.js](../../client.js) SHA-256 | `d962c6ed4e73f3c080acdaaf18042e9f2503314cfb484ad8db03623352c19965` |
| Source consistency now | All 32 source files and artifacts listed in the measurement manifest recompute to the recorded SHA-256; the build hash recomputes from the original serialization |
| Public JSON SHA-256 | `74c67914d39c0dd24302dffb6601f00fba5818e397b1bbb3e750066c7409a88b` |

The only uncommitted changes when sampling started were `M docs/specs/whale-implementation-evidence.zh.md` (documentation only); they are outside the hashed set, change neither product source nor generated artifacts, and the report documents were written only after the sampling finished. The previous 2026-10-25 data came from the pre-merge candidate `10372bd` and is kept as [historical public data](./resource-comparison-20261025.json); it is not mixed with this batch.

This batch ran on the build after the 1.0.0 merge and therefore includes the 1.0 default-on squared sea and dictation-echo code paths (the fixture has no dictation provider, so the voice swell stays inactive). The independent React evidence manifest records build `173c793`; all 13 of its source hashes match the current files and differ from the measured build only by documentation commits.

The environment was Windows 11 Pro x64 (10.0.26300), 13th Gen Intel(R) Core(TM) i5-13490F, 16 logical processors, about 32 GiB RAM, Chrome/156.0.8078.79, Node v24.19.0. The graphics device was recorded as AMD Radeon RX 9070 XT (AMD driver 32.0.32015.7029), with additional virtual display adapters; Chrome hardware acceleration recorded 2d_canvas=enabled, gpu_compositing=enabled. The native query recorded the "High performance" power plan; this does not measure instantaneous power or the Windows power slider. Desktop applications stayed open, so the host was not idle; rotation only reduces order bias and cannot remove background interference.

The run used the isolated headless Chrome static page from [measurement-fixture.js](../../scripts/measurement-fixture.js) at a 1280 × 800 viewport and DPR 1. The page contains fixed simulated conversation, three whales, text glyphs, reading glass, wind and clouds, with rain off. Reduced motion was not enabled and the scroll pause stayed off. Text was appended by a fixed plan; there was no real model, streaming reply or actual DSH page. The headless page reported visible, which does not prove a visible window, real pointer input or screen-reader acceptance.

## Absolute CPU

Each cell is median [min, max], n = 5. Every CPU number was recomputed from the `cpuRaw.before` and `cpuRaw.after` records of the 45 raw samples and then reconciled with the grouped statistics; the summary was not copied.

| Scenario | Condition | Single-core equivalent CPU % | Whole-machine normalized CPU % (16 logical processors) |
| --- | --- | --- | --- |
| Idle | Off | 0.093 [0.092, 0.281] | 0.006 [0.006, 0.018] |
| Idle | Standard | 46.106 [44.625, 56.309] | 2.882 [2.789, 3.519] |
| Idle | Economy | 23.581 [20.647, 24.769] | 1.474 [1.290, 1.548] |
| Append | Off | 0.886 [0.860, 0.926] | 0.055 [0.054, 0.058] |
| Append | Standard | 48.898 [48.305, 56.554] | 3.056 [3.019, 3.535] |
| Append | Economy | 25.158 [20.551, 28.651] | 1.572 [1.284, 1.791] |
| Scroll | Off | 7.129 [4.876, 7.567] | 0.446 [0.305, 0.473] |
| Scroll | Standard | 51.163 [49.082, 51.325] | 3.198 [3.068, 3.208] |
| Scroll | Economy | 27.883 [27.646, 28.071] | 1.743 [1.728, 1.754] |

The formula is `single-core equivalent CPU % = Σ(process CPU seconds delta) ÷ (CPU observation window ms / 1000) × 100`. The denominator is the recorded `elapsedMs` around the CPU queries, including query overhead, not a nominal 60 seconds. Whole-machine values divide by 16. A single-core value of 100% means one logical processor's time; 46.106% is not 46.106% of the machine.

The CPU scope covers the isolated Chrome browser, renderer, GPU and utility processes plus fixture and Chrome DevTools Protocol (CDP) overhead. It is not plugin-exclusive CPU and not GPU utilization. All 45 samples kept stable process identities and type sets, every CPU delta was non-negative, and recomputed values matched stored ones within floating precision. No profiler CPU was mixed into this table, and no historical off value was subtracted to claim a "net plugin benefit".

In all three scenarios the economy and standard CPU ranges do not overlap, supporting "this controlled batch observed lower CPU". Background noise remains: for example the standard idle maximum of 56.309% is above its median of 46.106%. These absolute values do not provide cross-device ratios, a general speedup, power savings or battery-life guarantees.

## Actual work and draw causes

Below are counts per roughly 60-second sample, median [min, max], n = 5. Every registered work counter, scheduler callback and non-transparent canvas pixel is zero in the off condition; the other conditions produced real drawing. Full counters and synchronous durations are in `groups.work` and per-round `rounds` of the [public JSON](./resource-comparison-20261031.json).

| Scenario | Mode | Continuous scheduler callbacks | motionStep internal integration | Continuous animation draws | Foreground-triggered draws | Total draws |
| --- | --- | --- | --- | --- | --- | --- |
| Idle | Standard | 8541 [8035, 9591] | 3600 [3600, 3601] | 1584 [1574, 1600] | 0 [0, 0] | 1584 [1574, 1600] |
| Idle | Economy | 709 [702, 766] | 1800 [1798, 1801] | 709 [702, 766] | 0 [0, 0] | 709 [702, 766] |
| Append | Standard | 9572 [8101, 9579] | 3601 [3600, 3601] | 1441 [1403, 1441] | 239 [239, 239] | 1680 [1642, 1680] |
| Append | Economy | 732 [707, 766] | 1799 [1798, 1801] | 497 [477, 539] | 239 [239, 239] | 736 [716, 778] |
| Scroll | Standard | 9590 [8628, 9593] | 3600 [3600, 3601] | 1600 [1581, 1600] | 0 [0, 0] | 1600 [1581, 1600] |
| Scroll | Economy | 766 [744, 767] | 1800 [1799, 1802] | 766 [744, 767] | 0 [0, 0] | 766 [744, 767] |

The standard mode schedules with RAF and the economy mode with a timer; the callbacks on the active channel equal `wakeup` and the other channel is zero. Idle internal integration drops from about 3600 to about 1800 (about 2.00×), so real integration is reduced, not only the number of frames painted. Idle continuous draws drop from 1584 to 709 (about 2.23×). The configuration also sets the swim-speed multiplier to 0.75, so the two modes do not promise the same visual time sampling or swim speed.

Appended text triggers layout refreshes. The standard total-draw median of 1680 includes 239 `foreground` refreshes, leaving 1441 continuous animation draws; economy is 736, 239 and 497. Layout measurement is not an extra draw cause; this batch's draw timeline only contains `animation` and `foreground`. Plugin layout counts in the append scenario are 480 and 480, so not all work halves, and total draws cannot be used as a continuous frame budget.

The [resource policy](../../src/resource-policy.js) sets continuous animation caps of 30 per second for standard and 15 per second for economy. The audit checked every sample's continuous draw count and start intervals, all within their budgets. Text or task-state refreshes follow a separate path and are not blocked by the 15-per-second continuous cap. The 250 ms task-prompt threshold is a different check and cannot be replaced by continuous frame intervals. The 1.0 squared sea is a static surface layer: it reads no clock, does not advance while paused and adds no continuous wakeups.

The observed median RAF interval during initialization was 6.3 ms, with per-unit medians from 6.3 to 6.3 ms across the 45 units. That is only the headless RAF callback interval and does not translate to a physical refresh rate. The public `physicalRefreshRate` field remains unmeasured.

## Limiters and source attribution

The separate diagnostic batch completed 9 units and recorded a successful browser exit. Its source hashes match the full sampling, but the diagnostic bundle disables minification and carries source maps while the formal bundle is minified. Each of the nine CPU profiles was parsed by summing `samples`, `timeDeltas` and node self time. The table only locates hot functions and must not be used for the formal CPU numbers.

| Function and current source | Scope | standard idle diagnostic self time (ms) |
| --- | --- | --- |
| [atmosphereCloudAt](../../src/atmosphere.js#L82) | Cloud-shadow field sampling in the draw and sea-mask path | 483.326 |
| [deformWhaleParticle](../../src/rig.js#L82) | Body, fluke and spine deformation | 448.216 |
| [resolveDepthGrid](../../src/model.js#L345) | Depth and character-cell coverage of projected triangles | 369.280 |
| [transformParticle](../../src/model.js#L271) | Coordinate and normal transform of deformed particles | 205.364 |
| [attenuation](../../src/model.js#L538) | Viewport-edge and reading-centre opacity attenuation | 169.658 |

These hotspots also appear in the other two standard scenarios and in the economy diagnostic. They belong to the draw path, so not all hotspots can be attributed to the low-frequency `atmosphereUpdate` or `motionStep`. The off diagnostic is mostly idle; append and scroll `dispatch`/`snapshot` never became major named JavaScript hotspots, which still does not exclude native layout, raster or CDP overhead.

The verifiable limiters are the active scheduling cadence and the per-draw cost. The [scheduler](../../src/engine.js#L790) books the next 66.7 ms economy timer only after one piece of work finishes, so work and scheduling latency add to the interval and the 15-per-second cap is not the achieved rate. Idle synchronous draw time was standard 13526.9 [13368.7, 16472.3] ms and economy 7999.5 [6408.2, 8172.9] ms, n = 5; `advance` was only 385.2 [334.2, 426.6] ms and 106.4 [104.1, 108.6] ms. Fewer expensive draws matches the observed CPU drop.

These timings nest and cannot be summed into browser CPU or used as GPU submission completion time. The profiled page thread was mostly idle, so no core is proven saturated and the GPU is not proven to be the machine-level bottleneck. In the formal idle samples the renderer CPU-seconds median was 17.152 and 8.230, and the GPU-process CPU-seconds median was 11.322 and 5.881, n = 5 each. The latter is GPU-process CPU time, not GPU engine utilization. GPU utilization, GPU timelines and hardware power remain unmeasured, so the remaining cost cannot be attributed precisely to one hardware limit.

## Data integrity and task-prompt evidence

The following checks passed against the final artifacts on 2026-10-31.

| Check | Result |
| --- | --- |
| Unit completeness | Expected 45, received 45, valid 45, issues 0, duplicates/missing 0 |
| Paired input | 15 scenario × round triples match on content hash, config, seed, event plan, viewport, DPR, sample duration and profile flag |
| Actual events | 239 events per append unit and 1199 per scroll unit, with identical kinds, scheduled times, text lengths and scroll positions across paired conditions; max event delay 61 ms |
| Snapshots and timelines | Complete raw snapshots 2790 in total, all visible, dropped = 0; counters monotonic, last snapshot equals totals, every draw and layout event present |
| Sampling window | Actual 60006.4 [60001.1, 60015.2] ms; every warmup record exists at about 30006.0 [30000.7, 30021.9] ms; every CPU window covers its sampling window |
| Errors and cleanup | Zero browser errors, failures, query warnings or recorded long tasks; both the full sampling and the separate diagnostic record browserExited = true |
| Statistics and public output | All registered counters, browser LayoutDuration and the nine CPU medians/ranges recompute; regenerating the public JSON byte-for-byte matches the stored report |

The full-batch `rendererStatusProbe` synchronously writes a DOM mirror and observes renderer draw completion. It mounts no React and cannot prove formal text commit latency; the report never treats mirror writes as React commit time.

A separate [status-demo manifest](../images/status-demo-manifest.json) `reactStatusLatency.probes` set uses React 18.3.1, the unmodified shipped client and simulated host subscriptions: two modes × reduced-motion toggle × normal and burst events × five rounds, 40 observations, all visible, badge drawn and canvas commands above zero. [The probe](../../scripts/react-status-probe.js) starts at host event delivery, observes the formal React summary DOM via MutationObserver, and records completion in a microtask after Canvas commands return.

| Independent controlled React observation | n | Median [min, max] (ms) |
| --- | --- | --- |
| React summary commit | 40 | 1.9 [1.5, 6.1] |
| Canvas command completion with badge drawn | 40 | 1.5 [1.3, 4.0] |

Both endpoints stayed below 250 ms inside this fixture. The Canvas endpoint excludes GPU presentation, screen scan-out and screen-reader announcement. This independent record is not the 45-sample CPU measurement and does not cover actual DSH; the current GUI returns 401, so actual host, pointer, reading-protection and screen-reader acceptance remain incomplete.

## Conservative public verdict and unknowns

The [public JSON](./resource-comparison-20261031.json) is a byte-for-byte copy of the machine-generated whitelist report and keeps `verdict = inconclusive; no performance benefit or energy claim`, `formalReactCommitLatency = unmeasured` and the unmeasured note for `evidence.limiterProfile`. Those fields describe only what the batch generator aggregated; it did not merge in the independent React manifest or the nine-unit diagnostic. Its "full repetition and independent profile still required" wording is a generic conservative requirement and does not mean the 45-sample run did not happen.

This human report separately verifies and explains the extra evidence, records the observed lower CPU within the controlled batch, and does not rewrite machine records, invent nulls or declare all acceptance passed. The raw sampling and diagnostic bundles stay local; public artifacts contain only whitelisted aggregates, per-round values, permitted hardware models and versions, with no local paths, task text, credentials, process identifiers or process inventory.

| Judgement | Boundary |
| --- | --- |
| Verified (grade-A raw measurement) | Lower CPU and internal work in the merged build's controlled fixture; the full sampling, independent hotspots and independent React endpoints recompute item by item |
| Inferred | Reduced scheduling and drawing explain the direction of the drop; the diagnostics cannot split the whole Chrome-tree CPU difference per function |
| Unmeasured | Actual DSH resource benefit and visuals, real pointer and screen-reader acceptance; GPU utilization, energy, power gain, battery life, physical refresh rate and cross-device effects |

The older [historical baseline](./MEASUREMENT-BASELINE.zh.md) and [baseline JSON](./measurement-baseline-20261025.json) came from the old `b6bf1111656315423f8d921fdd967a02a29d42eb` build and remain only as historical tool evidence; they are not used for this report's ratios. The status page and README no longer claim "final full sampling and limiter profile unmeasured". Actual host and screen-reader limits remain unverified and no acceptance item is closed on this basis.

This round reran measurement, build and the full test suite on the merged 1.0.0 build; the candidate commit is `551fa13711632785857b5d42df65e7492cdce0ac`. See the [Chinese method](../measurement.zh.md) and [English method](../measurement.en.md) for the protocol and reproduction commands.
