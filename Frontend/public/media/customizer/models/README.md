# Chair model

`axtra-chair.glb` is the piece rendered by the customizer's WebGL stage
(`src/components/three/ChairScene.tsx`). The scene HEAD-probes for this
file at runtime and only swaps it in when it responds 200 — if it is
missing, the page falls back to a procedural stand-in built from swept
geometry, so /customize never renders empty.

## What is in here now

Generated 2026-08-26 from the four product renders already in the repo
(`axtra-chair.png` plus `angles/side|front|back.png`) with Meshy
multi-image-to-3D, then post-processed by the repo's scripts into the
brief's two-material contract. Multi-view was used deliberately:
single-image reconstruction blobs thin swooping forms like this chair's
walnut ribbons, and four views constrain the geometry.

- 122,955 triangles, 97,506 vertices
- one mesh, **two primitives/materials named `Wood_Walnut` (72,288 faces)
  and `Fabric_Olive` (50,667 faces)** — so the swatches bind by NAME
  (path 1 below) and the hue-split fallback stays dormant
- faces +Z (the prep script measured the raw export at −4.5° and baked
  the correction)
- 4.58 MB — the raw export was 15.4 MB; the normal/metallicRoughness/
  emissive maps were dropped (the site's procedural surface shader
  replaces them) and the base-colour atlas resized to 1024
- the previous model is kept alongside as `axtra-chair.v1-meshy.glb.bak`

Rebuilt from a fresh AI export with (run from anywhere, paths absolute
or cwd-relative):

1. `node scripts/prep-chair-glb.mjs <raw.glb> <prepped.glb>` — bakes +Z
   facing and smooth normals, zeroes metallic
2. `node scripts/split-chair-materials.mjs` — classifies every face from
   the base-colour atlas into the two named materials (reads
   `axtra-chair-prepped.glb`, writes `axtra-chair-split.glb` in cwd;
   re-tune its colour thresholds for a non-walnut/olive piece)
3. `node scripts/measure-atlas-classes.mjs <split.glb>` — prints the
   `BAKE_WOOD/BAKE_FABRIC` and `WOOD_REF_LUM/FABRIC_REF_LUM` values that
   must be updated in `AxtraChair.tsx` whenever the model changes
4. `node scripts/resize-atlas.mjs <in.glb> <out.glb> 1024` — web weight

## How the swatches recolour it

Two paths, picked automatically:

1. **Named materials.** If any mesh or material name matches, the swatch
   binds to that material's colour directly. Case-insensitive:
   - finish/wood: `wood`, `frame`, `shell`, `timber`, `walnut`, `oak`, `leg`
   - fabric/upholstery: `fabric`, `cushion`, `leather`, `seat`, `upholst`,
     `pad`

2. **Hue split.** If nothing matches — which is the case for this file,
   whose single material bakes wood and fabric into one atlas — the scene
   injects a fragment-shader remap instead. It classifies each texel by hue
   in linear space and retints it while keeping its luminance, so the grain
   and the velvet nap survive the recolour.

   The thresholds in `AxtraChair.tsx` are measured from *this* atlas:
   walnut piles up at 0–30°, olive velvet at 60–80°, and the 30–60° valley
   holds under 6% of texels, so the split band sits at 42–56°. **Re-measure
   if you replace the model** — a different bake will move those numbers.
   Near-greys (chroma below ~0.02) are deliberately left alone so metal
   glides, seam AO and shadow do not take the tint.

A swatch that has never been picked passes `null`, which leaves that
material at its original baked colour rather than forcing a default.

## Replacing it with a Blender export

Authoring in Blender gives better topology than any reconstruction, and it
is a drop-in: save over `axtra-chair.glb` and the page picks it up on next
load, no code change.

1. Model the chair, apply modifiers (`Ctrl+A` → Visual Geometry to Mesh for
   anything procedural).
2. **Name the materials** per the list above and you get path 1 — cleaner
   than the hue split, because the separation is exact rather than inferred.
   e.g. `Wood_Walnut` and `Fabric_Olive` both wire up with no further work.
3. Use **Principled BSDF** — it maps 1:1 onto three.js's
   `MeshStandardMaterial`. Anything else arrives untextured.
4. Point the chair's front toward **+Z** so the four preview buttons land on
   the sides their thumbnails promise.
5. `File → Export → glTF 2.0 (.glb/.gltf)`:
   - Format: **glTF Binary (.glb)**
   - Transform: **+Y Up** ✓
   - Data → Mesh: Apply Modifiers ✓, Normals ✓, UVs ✓
   - Compression: **off** (Draco needs a decoder the page does not ship)

## Sizing and origin

None of it has to be exact. On load the scene measures the model's bounding
box, scales it to a 0.92-unit height and re-seats its origin on the floor,
so any scale or off-centre origin still frames correctly.

## Budget

Aim for **under ~150k triangles** and textures at 1024–2048px. The scene
renders at up to 2× DPR with a 2048² shadow map, so an unoptimised
multi-million-triangle sculpt will stutter on laptop GPUs. In Blender:
Decimate modifier, or Remesh → Decimate for sculpted forms.
