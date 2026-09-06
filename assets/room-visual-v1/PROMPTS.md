# Промпты оформления Стражной галереи

Инструмент: встроенный imagegen. Финальная основа — второй проход стилизации. Исходный лист колонны применяется с отдельной контурной маской в рендере.

## Основа комнаты

Use case: style-transfer.
Asset type: production 2D action roguelite room background, 1536x1024 landscape, full-frame, game-camera image.
Input image 1 is the EDIT TARGET and the strict GEOMETRY reference. Repaint this exact room completely with exceptionally polished hand-drawn 2D dark fantasy game art. Preserve its camera, outer walkable floor footprint, bottom entrance at (768,866), two rear exit thresholds at (601,240) and (935,240), and foreground parapet positions. Do not rotate, zoom or crop. Keep all three routes open and the large central 70% of the arena empty and flat.
Our own ancient mountain kingdom: monumental charcoal-indigo stone, bronze leaf-and-mountain knotwork, long muted wine-red banners, geometric guardian reliefs at the back perimeter, two distinctive rear door arches, low front parapets with strong columns. Intensify the art direction, replacing the generic soft 3D appearance with bold confident ink contours, angular hand-painted color planes, deliberate graphic shapes, crisp highlights, rich indigo shadows and restrained cross-hatching. Visually expressive, premium game illustration, not photorealistic.
Floor: large worn warm grey slate slabs, quiet medium value, broad sweeping tile patterns following the SAME fixed three-quarter projection, an understated geometric border and small ancient diamond inlays only near the edge. Remove the existing thin rectangular practice-arena outline. No busy tiny floor scratches. Keep central combat floor readable against a small golden-armored hero, but DO NOT depict a hero.
Perimeter: detailed architecture and deep contact shadows, strong pale golden stone edges, muted turquoise atmospheric bounce at room sides, dark abyss outside. Preserve the exact wall/floor boundary and open door locations. Ornament and overhang must remain in the perimeter. No new pillars, rubble or furniture in walkable center.
Lighting: upper-left diffuse fill, cool shadow planes, NO flames and NO large colored light pools painted on the floor; keep empty bronze brazier bowls in existing positions. We will add animated amber flames and light pools as separate runtime layers. Outside turquoise fog restrained and dark, never neon brighter than the floor.
No UI, no characters, no enemies, no labels, no text, no watermarks, no pixel art, no soft focus, no photographic textures, no perspective mismatch, no new passages. The output is the actual environment texture, not a screenshot/mockup or a concept sheet.

## Финальная стилизация

Use case: style-transfer. This is a radical ART STYLE transformation of the attached production game background, with the exact room geometry preserved.
The current image is too realistic, too monochromatic grey, too much like a low-poly 3D render. Completely REPAINT it as an exuberant, graphic, hand-painted 2D dark-fantasy action game illustration with thick charcoal ink contours, elegant expressive linework, broad confidently painted color planes and highly designed silhouettes. The result must look unmistakably drawn by hand, like a beautifully colored fantasy graphic novel environment. No photographic or 3D-rendered surface texture anywhere.
Make a strong, immediately visible color change: architecture has rich deep INK BLUE and INDIGO shadow planes with saturated muted TURQUOISE side faces, golden-ochre bevels, warm pale limestone corner highlights; fabric becomes striking dark garnet red; ornament is warm beaten brass. Quiet floor in broad cool grey-violet flagstones, TWO OR THREE large restrained tonal fields, much larger simpler slabs, low contrast seams. Replace the thousands of tiny surface scratches with sparse deliberate brush accents. Outside abyss near black navy and smoky petrol teal. Strongest saturation at the perimeter; central floor remains broad, empty, medium-value and calm.
Maintain precisely the same 1536x1024 framing, camera, floor outline, foreground walls and all three door positions. Preserve empty braziers; their animated fire and warm pools will be added in the game. Do not add anything to the playable center. No heroes, enemies, text, UI, watermark. Not a concept sheet. Production background.
Do not just color grade the original. Redraw the forms with clear angular graphic brushwork, dramatic hand-inked edges, painted flat shadows and simplified texture. This must be a visibly different, much more stylized finished artwork, while remaining exactly the same navigable room.

## Колонна

Use case: style-transfer. Asset type: ONE production game prop sprite with real transparent alpha background.
Image 1 is a structural reference for a freestanding octagonal stone column. Image 2 is the style and palette reference for the GAME ROOM it belongs in.
Redesign the column in the exact hand-painted graphic 2D art of image 2: bold ink-blue outlines, broad indigo and petrol-teal planes, warm pale ochre edge highlights, stylized bronze mountain-and-diamond inlays. Simplify the excessively realistic stone texture and slender shaft. Make the column a somewhat shorter, sturdier octagonal pillar with a substantial beveled capital and stepped base; full pillar visible. Fixed three-quarter game camera from above, show its top face with the same foreshortening as the pillars in room image 2. Strong readable silhouette at 100-pixel game height.
Centered on a transparent 1024x1536 canvas, generous transparent margin, entire base visible, bottom-center foot anchor. No ground, no contact shadow, no glow, no fire, no surrounding room, no text, no watermark, no checkerboard painted into the image. Exactly one object. Alpha cutout ready to composite into the room.

## Попытка удаления фона

Use case: background-extraction. Remove the entire grey and white checkerboard surrounding the blue-and-gold pillar in the input. Keep the pillar itself exactly unchanged. Output a PNG with an ACTUAL TRANSPARENT ALPHA CHANNEL: zero opacity outside the pillar and clean antialiased edges. A drawn checkerboard is NOT transparency. No backdrop, no ground plane, no shadow. Preserve the 1024x1536 canvas and the pillar position and dimensions. Only remove background pixels.

Удаление не создало альфа-канал. Финальный рендер использует контурную маску из room-visual-art.js; прозрачность исходного листа не заявляется.
