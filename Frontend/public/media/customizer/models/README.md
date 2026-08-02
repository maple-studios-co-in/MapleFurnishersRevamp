# Chair model

`axtra-chair.glb` is the piece rendered by the customizer's WebGL stage
(`src/components/three/ChairScene.tsx`). The scene HEAD-probes for this
file at runtime and only swaps it in when it responds 200 — if it is
missing, the page falls back to a procedural stand-in built from swept
geometry, so /customize never renders empty.

## What is in here now

Generated from the four product renders already in the repo
(`axtra-chair.png` plus `angles/side|front|back.png`) with Meshy
multi-image-to-3D. Multi-view was used deliberately: single-image
reconstruction blobs thin swooping forms like this chair's walnut ribbons,
and four views constrain the geometry.

- 119,389 triangles, 83,966 vertices
- one mesh, one material (`Material_0`), PBR: baseColor + metallicRoughness
  + normal
- faces **azimuth 0.5°**, i.e. effectively +Z, which is what the four
  "Preview your piece" camera stations assume
- 4.6 MB — the raw export was 15 MB, almost all of it a 2048px PNG normal
  map; textures were resized to 1024 and recompressed

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
