<p align="center">
  <img src="./icon.svg" width="112" height="112" alt="Glyph whales icon">
</p>

<h1 align="center">Glyph whales</h1>

<p align="center">Turn your own text into whales that swim across DeepSeek Harness.</p>

<p align="center"><a href="./README.md">简体中文</a> · <strong>English</strong></p>

<p align="center">
  <a href="https://github.com/jryang1997/dsh-ascii-whales/releases/latest"><img src="https://img.shields.io/github/v/release/jryang1997/dsh-ascii-whales?style=flat-square&amp;color=658EFF&amp;label=release" alt="Latest release"></a>
</p>

<p align="center">
  <a href="https://github.com/jryang1997/dsh-ascii-whales/releases/latest">Download</a> ·
  <a href="#install">Install</a> · <a href="#settings">Settings</a> ·
  <a href="#local-preview">Local preview</a> · <a href="./CHANGELOG.md">Changelog</a>
</p>

> Inspired by [ascii-sharks](https://github.com/stackedlol/ascii-sharks). Thanks to the project for the original visual idea.

Five whale species cruise, turn, and glide through the conversation page, seen from directly above. Their bodies consist of your text or ASCII characters chosen by shading. Whales are drawn locally, without image assets or external services.

<p align="center">
  <img src="./docs/images/cruise.gif" width="960" alt="Glyph whales cruising around the input box on an empty DeepSeek Harness page">
</p>

<p align="center"><sub>An empty conversation page in the desktop window. The whales swim around the input box. This is the running app.</sub></p>

<p align="center">
  <img src="./docs/images/modes.png" width="960" alt="Four views of the same blue whale: glyphs or colored cells, each with custom text or ASCII">
</p>

<p align="center"><sub>Combine glyphs or colored cells with custom text or ASCII.</sub></p>

## Install

In DSH Web, install from GitHub with the CLI:

```sh
dsh plugin --profile web add github:jryang1997/dsh-ascii-whales
```

Or install the release tarball through the plugin manager:

1. Download a `local-dsh-ascii-ocean-*.tgz` package from [Releases](https://github.com/jryang1997/dsh-ascii-whales/releases/latest) (or enter `github:jryang1997/dsh-ascii-whales` in the plugin manager).
2. Install the file through the DSH plugin manager.
3. Open **Plugins → Glyph whales**, adjust the settings, and select **Save**.

The current published package is [v0.14.0](https://github.com/jryang1997/dsh-ascii-whales/releases/tag/v0.14.0). Changes since 0.10.0 are in the [changelog](./CHANGELOG.md). The clip at the top is a recording of the desktop window. The dive and fluke clips still come from the real renderer, and the fully hidden part of a dive is shortened.

## Features

- Form whales from Chinese characters, English text, or emoji. Leave the text blank to use the default phrase, `探索未至之境`.
- Choose blue, humpback, sperm, fin, or bowhead whales, or let a mixed group swim together.
- Draw glyphs alone for a lighter outline, or add colored cells to shade the back, flanks, flippers, and flukes.
- Adjust the count, body size, speed, opacity, and palette. Body size does not change swimming speed or tail-beat timing.
- Apply saved settings while preserving the group's movement. Switching models keeps the whales swimming.
- Version 0.14.0 adds sea-surface wind streaks and slow cloud shadows, each with its own switch. Whales leave through any edge and return on the opposite side, steering clear of obstacles there before they cross. See [atmosphere research](./docs/research/ATMOSPHERE-RESEARCH.md).
- Rain has an independent switch and intensity from 0 to 1. Fine streaks follow the slowly changing sea breeze and make small splashes and spreading ripples at their landing points. Rain settles naturally when switched off. Turning wind off returns the rain to vertical; rain ripples and swimming wakes have separate controls.
- Each whale dives and comes back up on its own. The nose goes under first, the tail lifts and slaps, and the whale keeps its course while it is hidden. The nose returns first. The school does not dive together, and there is no separate dive switch. See the [changelog](./CHANGELOG.md).
- Follow light and dark themes and system preferences. Reduced motion shows a static pose. Hidden pages pause the animation, and the decorative layer lets pointer events pass through.

## Motion

<p align="center">
  <img src="./docs/images/dive.gif" width="640" alt="A blue whale puts its nose under first, leaves the tail up, then surfaces nose first">
</p>

<p align="center"><sub>Dive and return. The nose goes under while the tail is still up. The fully hidden seconds are cut. The nose comes back first.</sub></p>

<p align="center">
  <img src="./docs/images/tail.gif" width="460" alt="A humpback fluke beating up and down">
</p>

<p align="center"><sub>A humpback fluke. Both lobes beat up and down together while the whale swims forward.</sub></p>

## Whales around your conversation

Text edge effect offers Glow, Soft blur and Frosted glass, with Frosted glass as the default. Glow clears whales around text; blur and frost retain translucent silhouettes so the whale remains continuous behind a paragraph. This choice is independent of the content-box glass switch. Whales briefly hide during reading scrolls and resume from the same position afterward. Content cards, the input box and the right sidebar use frosted materials, with a quieter, more diffuse whale silhouette in the sidebar. Light and dark themes use separate tones.

| Light theme | Dark theme |
| :---: | :---: |
| <img src="./docs/images/reading-glass.png" width="420" alt="Frosted reading pane in the light theme"> | <img src="./docs/images/dark.png" width="420" alt="Whales and the reading pane in the dark theme"> |

For the input box, you can show blurred whale silhouettes or have the whales swim around it.

| Option | Effect | Default |
| --- | --- | --- |
| Frosted content boxes | Blurred whales in content cards, the input box and right sidebar, with clear text regions | On |
| Whales avoid the input box | Whales swim around the input box as an obstacle | Off |

**Frosted content boxes** and **Whales avoid the input box** are mutually exclusive. Enabling either turns the other off. Text protection stays active with either option disabled.

<details>
<summary>View input-box avoidance</summary>

<p><img src="./docs/images/avoid.png" width="960" alt="Whales swimming outside the input box with avoidance enabled"></p>

</details>

<details>
<summary>Compare three whale sizes</summary>

<p><img src="./docs/images/sizes.png" width="960" alt="Whale sizes 0.55, 1.00, and 1.55 compared"></p>

</details>

Screenshots use the Chinese UI and come from the standalone preview or simulated environments. See [SOURCE-NOTES.md](./docs/research/SOURCE-NOTES.md) for verification details and the limits of testing in the actual DSH desktop window.

## Settings

Dragging a slider updates the static sample in the settings page. Select **Save** to apply the draft to the conversation background. **Restore defaults** changes the draft; **Reload saved values** discards unsaved edits.

| Numeric setting | Range | Default |
| --- | --- | --- |
| Whale count | 1–8 | 3 |
| Swimming speed | 0.3–2 | 0.65 |
| Background opacity | 0.04–0.9 | 0.6 |
| Character size | 4–16 | 11 |
| Whale size | 0.55–1.55 | 1 |
| Glass strength | 0–1 | 0.55 |
| Rain intensity | 0–1 | 0.45, rain off by default |
| Browser left inset | 0–500 px | 280 px |

| Style setting | Choices |
| --- | --- |
| Whale species | Mixed group, blue, humpback, sperm, fin, or bowhead |
| Drawing style | Glyphs only, colored cells |
| Fill content | Custom text, ASCII characters |
| Whale colors | Ocean, Azure, Indigo, random color per whale |
| Other switches | Show whales, Follow task activity, Quieter reading area |

Random color per whale assigns distinct hues from eight palettes and retains body shading. Painting, saving settings, resizing, and changing count, text, species or size preserve each whale's color. Reopening the background generates a new set.

Follow task activity is on by default. The first whale represents the current session. The remaining whales keep stable bindings to subagents, other active sessions, and background jobs visible to the current session.

| Actual state | Whale behavior |
| --- | --- |
| Running session, subagent or job | Stronger swimming, more sustained tail strokes, `···` |
| Idle or stopped turn | Calm gliding; an inactive subagent does not imply success |
| Waiting for an answer, approval or plan review | Smooth surfacing, slow swimming, `!` and the task name; no new dives |
| Observed job completion / failure | `✓` / `×` and the job name for six seconds of playback |

When there are more active tasks than whales, the first whale summarizes the extra count and the most urgent reminder. Disabling the switch restores decorative swimming. Reduced motion keeps the pose still while state changes update static badges. The plugin only reads published DSH state. It does not answer questions, approve operations or follow job output. Historical job results do not produce new badges when the background opens.

Custom text supports Chinese characters, English, emoji, and combined glyphs. Whitespace is ignored. The input limit is 40 UTF-16 code units, so some emoji use more than one unit. Switching to ASCII preserves your saved custom text.

The desktop app follows the sidebar width automatically. In a regular browser, adjust **Browser left inset** to position the visible whale area.

<details>
<summary>View the settings page</summary>

<p><img src="./docs/images/settings.png" width="480" alt="Glyph whales sliders, options, and Save button in the Chinese UI"></p>

</details>

## Local preview

Download or clone the repository, then open [whale-preview.html](./preview/whale-preview.html) in your browser. It uses the plugin's renderer and does not need a server.

The page includes all four rendering combinations and a live group of whales. Change the species, body text, size, speed, glass, and theme. A simulated input box at the bottom lets you compare frosted glass with avoidance.

## Development

```text
src/             Implementation sources
tests/           Tests and helpers/ adapters
scripts/         Build, verification, and review tools
preview/         Standalone entry and generated page
docs/research/   Research and design records
docs/images/     Screenshots and clips
```

The root keeps the public plugin entry `index.js`, the DSH client artifact `client.js`, installation configuration, and project documentation. Historical screenshots remain in `docs/archive/`.

<details>
<summary>Build, check, and package</summary>

Use the Node version in [.node-version](./.node-version) and the pnpm version pinned in [package.json](./package.json). From the project root:

```sh
pnpm install --frozen-lockfile
pnpm verify
```

After changing browser sources, run `pnpm build` and `pnpm preview` to update both artifacts, then run `pnpm verify`. Verification checks committed output without rebuilding it, so stale artifacts fail. Test discovery recursively includes `*.test.js` under `tests/`, excluding hidden directories and `node_modules/`. It does not scan repository backups, reference projects, or worktree copies. GitHub Actions runs the same verification on Windows and Linux.

`pnpm check` checks syntax; `pnpm test` runs tests. `pnpm --silent review:snapshot --base <ref>` outputs a JSON review inventory including untracked files. `pnpm --silent agent:probe` checks whether its process can read the entry files. See the [engineering guide](./docs/agents/engineering.md) for native-tool read preflight, review scope, and browser evidence requirements.

Package with `pnpm --config.ignore-scripts=true pack`.

`pnpm build` runs [build.mjs](./scripts/build.mjs) to generate [client.js](./client.js) from [browser-entry.js](./src/browser-entry.js). `pnpm preview` runs [preview.mjs](./scripts/preview.mjs) to generate the [standalone page](./preview/whale-preview.html) from [preview-client.js](./preview/preview-client.js). Both entries use [browser-build.mjs](./scripts/browser-build.mjs) and the esbuild development dependency to resolve imports and isolate file scopes; the installed plugin does not need esbuild. Both generators support `--check` to verify source consistency. The package name is `@local/dsh-ascii-ocean`, and the Host row id is `ascii-whale-background`.

| File | Purpose |
| --- | --- |
| [species.js](./src/species.js) | Body shapes and movement parameters for the five species |
| [model.js](./src/model.js) | Surfaces, projection, cell coverage, and configuration fingerprints |
| [motion.js](./src/motion.js) | Cruising, turning, gliding, and input-box avoidance |
| [rig.js](./src/rig.js) | Body turns and vertical tail strokes |
| [shading.js](./src/shading.js) | Raised-back and depth shading |
| [surface.js](./src/surface.js) | Character selection, palettes, and cell drawing |
| [glass.js](./src/glass.js) | Reading-pane and input-box geometry and materials |
| [engine.js](./src/engine.js) | Canvas drawing and updates in place |
| [reading-layout.js](./src/reading-layout.js) | Shared glass, masks, and avoidance rules for conversation and demo cards |
| [activity.js](./src/activity.js) | Published DSH state, stable task bindings, job subscriptions, and badges |
| [rain.js](./src/rain.js) | Wind-driven rain, intensity transitions, and impact ripples |
| [simulation.js](./src/simulation.js) | Scene adoption, resizing, and advancement of motion and sea effects |
| [config-editor.js](./src/config-editor.js) | Draft rules, validation, differential saves, and revision conflicts |
| [browser-build.mjs](./scripts/browser-build.mjs) | Shared browser artifact assembly and consistency checks |
| [settings.js](./src/settings.js) | Native DSH settings page |

</details>

## Documentation and references

The following reference documents are in Chinese:

- [Changelog](./CHANGELOG.md): version history and upgrade changes.
- [Implementation and verification notes](./docs/research/SOURCE-NOTES.md): implementation details, root causes, and testing limits.
- [ASCII rendering research](./docs/research/ASCII-RENDER-NOTES.md): cell rendering and character density.
- [Whale references](./docs/research/WHALE-REFERENCES.md): overhead photographs used as species references.
- [Screenshot archive](./docs/archive): visual records of earlier versions.

Reference photographs, local verification evidence, and the third-party reference checkout are kept outside the published project. See [.gitignore](./.gitignore) for the directory rules.
