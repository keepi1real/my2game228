# V20 raster art — «Керамика и световые швы»

Created with the built-in image_gen tool, 2026-09-25. Original game art, no external reference images.

## Assets and integration

- `seam-crab.png`: 1254 × 1254 RGBA, genuine transparent background. Registered by `tools/v20-design.js` as `BestiaryArt.specs.seamcrab`, displayed at height 96 through the existing actor renderer.
- `ceramic-observatory-floor.png`: 1254 × 1254 RGB. Drawn within actual room polygons at opacity .52 in the glass biome and .29 elsewhere, below props and attack warnings.
- Preview expects `../assets/v20/` relative to `/adventure-v20/`. Raster assets are external to keep the compressed HTML below the upload size limit.

## Generation prompts

### Seam Crab

Use case: stylized-concept. Asset type: production game enemy sprite, one single full-body cutout on genuinely transparent background. Create an original enemy called the Seam Crab for a 2.5D dark adventure game, an insect-like four-legged automaton made of heavy midnight teal ceramic armor, asymmetrical pale bronze cutter claw on its left and a small crystal pincer on its right, glowing mint seams between cracked ceramic plates, squat powerful silhouette, small recessed amber optical eye. No humanoid face. Hand-painted sculptural fantasy with matte ceramic, economical broad forms and strong edge highlights, crisp readable at 80px tall. Camera elevated three-quarter overhead view, creature facing bottom-right, all four feet and both claws clearly visible, feet touch a common ground plane. Centered entire creature, 12 percent empty margin, no crop, no other objects, no scenery, no lettering, no watermark, no bounding box, no decorative frame, no floor or cast shadow. Original world of ceramic machines and broken light, avoid recognizable existing game characters. Square image.

### Observatory ground

Use case: stylized-concept. Asset type: playable game ground texture for top-down 2.5D game, square artwork. Original world called Kiln of Daybreak, a broken ceramic observatory floor. Orthographic straight-down camera, NO perspective convergence. Image entirely filled with walkable flat ground: large irregular blue-grey glazed ceramic slabs joined by pale bronze repair seams, subtle worn teal glass inlays, tiny mica grains, chipped glaze, a few restrained geometric arcs engraved in stone, tactile hand-painted broad surfaces. Much of center is quiet low-contrast dark slate so small characters and orange attack warnings remain clearly readable. Top and bottom edges continue same material, no border. No walls, no holes, no cliffs, no furniture, no raised objects, no structures, no circles that resemble danger zones, no characters, no symbols or writing, no water, no frame, no text, no watermark. Gentle diffuse overhead lighting, richly crafted but subdued, architectural archaeological texture. The floor is a continuous sheet with uniform surface detail; keep ceramic slabs reasonably large, avoid noisy granular texture.
