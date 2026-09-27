# Three frontier teams — v27

User-authorized parallel development, 2026-09-27.

Each chief has one specialist active at a time. Three independent worktrees prevent cross-team edits. The integration engineer owns only shared registry/build/menu/test code. Six simultaneous child slots means three chiefs plus three specialists can work concurrently.

| Team | Chief engineer | Map designer | Mob artist | Combat director | Balance | QA |
|---|---|---|---|---|---|---|
| Drowned wharf | GPT-6 Astra / high | GPT-6 Sol / high | GPT-6 Sol / high + ImageGen | GPT-6 Sol / high | GPT-6 Sol / high | GPT-6 Sol / high |
| Red quarry | GPT-6 Astra / high | GPT-6 Sol / high | GPT-6 Sol / high + ImageGen | GPT-6 Sol / high | GPT-6 Sol / high | GPT-6 Sol / high |
| Dark root | GPT-6 Astra / high | GPT-6 Sol / high | GPT-6 Sol / high + ImageGen | GPT-6 Sol / high | GPT-6 Luna / high | GPT-6 Sol / high |

The platform temporarily retained completed agent slots. Wharf and quarry reused existing Sol threads for later roles; their map designers independently reviewed combat written by the other specialist. Darkroot used a distinct Luna balance agent. These are six assigned roles per team, not eighteen concurrent processes.

The chief engineers integrate work and return a scoped commit. Role execution and findings are recorded in each team's own TEAM.md. This table is the assignment, not proof a role has already completed.

## First playable milestone

- Three separate 16-room expeditions, matching the existing checkpoint format.
- Original environments and two enemy archetypes plus one boss per expedition.
- Reusable existing five heroes and animation systems.
- Telegraph, hit and recovery windows; distinct movement and casts.
- Real raster art with transparent mob sprite atlases.
- Difficulty and depth scaling retained; standalone expeditions start at effective combat floor 1. JSON floor 12–14 is a registry identifier and does not grant a fresh hero late-campaign scaling.
- Random relic economy remains bounded by existing cooldown/cap rules.
- Per-expedition checkpoints; original adventure remains available.

## Build and integration

`node tools/v27-build.cjs` creates `dist/Three-frontiers-play.html` with all referenced raster assets embedded. Existing `v20-manifest.json` output is unchanged by optional additional chapters.

For isolated team review:

```js
const {boot}=require('/absolute/path/game-repo/tools/v27-harness.cjs');
const h=await boot({team:'quarry',root:'/absolute/path/team-quarry',seed:42,hero:'arator',difficulty:'journey'});
h.g.renderer.render();
await h.settleImages();
h.shot('/tmp/quarry-review.png');
```

QA must distinguish headless real-canvas/collision/combat checks from human playtesting. Visual inspection is required before claiming art quality. Generated poses plus interpolation are a first animation pass, not a skeletal animation pipeline.

`node tools/v27-build.cjs --publish` also produces verified gzip chunks in `three-frontiers/` for Pages. The CI builds those from source; generated chunks are not checked into Git.
