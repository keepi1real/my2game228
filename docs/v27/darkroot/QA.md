# Darkroot QA · v27

Run `node tools/test-v27-darkroot.cjs` against the shared assembled-game harness. The test loads the real inline assets into a Canvas VM and drives `Game.update`, combat methods, `Renderer.render`, and the production checkpoint path. It uses the local `tools/v27-harness.cjs` when present; an absolute shared-harness fallback supports this isolated team worktree. No browser or touch input is implied by these tests.

| Check | Result |
| --- | --- |
| Full-radius hero collision (`r=12`), sampled 16 px BFS, swept edges | All 16 centers, starts 0/5/10, boss exit approach **and actual staircase at `origin + (512,213)`**, and three cross sections of every corridor are reachable for seeds 42, 731, 987654321. Reachable samples: 18,367/18,392; 18,450/18,461; 18,333/18,358. The remaining 61 samples are peripheral pockets; no required target is stranded. |
| Generation and checkpoint | The generated room geometry, corridors and obstacles match exactly across a real save/resume. Hero position, HP, cooldowns and relic state, enemy IDs, position, HP, phase, warnings, charge/recovery and ability timers are checked. Warnings are saved after a live quarter-second update, then resume at the exact remaining time and shapes. |
| Actors and boss | Both mobs begin real warnings, release attacks/hazards, recover, and lose warnings when stunned. The Reaper moves along its announced lunge lane. The boss in both phases releases a safe-center ring, fixed target mark and two/three lanes with a safe gap. Paused warnings do not advance; waiting rooms do not simulate enemies. |
| Rendering and heroes | All three 1774×887 creature atlases load with eight in-bounds frames each and each is drawn by the real Canvas renderer. Canvas save/restore balances. All five heroes run basic attacks and three skills each over several update/render frames. |
| Relics and death | The assembled standalone chapter uses the normal `AdventureRun` floor 1, starting 14% chance, 6% per miss, elite 12% boost capped at 50%, pity on five misses, two-room cooldown and two-drop cap. A blocked storage write retains the previous checkpoint; death writes `null`, prevents resume, and allows a new run. |

**Final run: PASS.** During QA, the script exposed three native writes for one v27 checkpoint: the atomic wrapper had captured an older preview key before v27 changed `SeamlessFloor.key`. The shared wrapper now binds the active transaction to the current key. The complete test passed after this fix, including exactly one native checkpoint write, injected native storage failure without clobbering the last checkpoint, death clearing the key, and starting a new run.

This is an integration test in a Node Canvas/DOM mock. Browser layout, pointer/touch event handling, actual sound, and long-form play balance remain separate checks before publishing.
