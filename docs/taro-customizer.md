# Taro customizer

`/customize/taro` reuses Maple’s existing customizer controls and adds a rotatable Taro chair with editable wood and fabric materials. The original Axtra `/customize` page links to Taro through its Next control. Taro links back to Axtra.

The page deliberately remains a visual prototype: Save Look downloads the current material/view selection and its reopen URL; no price, order, measured fit or physical-product accuracy is promised. Search indexing remains disabled.

## Runtime assets

The six files under `Frontend/public/media/models/taro/` total about 8.77 MB. The V4 GLB embeds its textures. Four fixed Walnut/Ivory thumbnails and one clearly labelled reference fallback accompany it. Swatches tint shared underlying materials. The original `media/customizer/bg-interior.webp` is reused as the background.

The chair geometry and Blender export match the local V4 study. The background is an existing repository image; actual-photograph provenance and camera data are unverified. Wood uses generic CC0 Poly Haven walnut; fabric uses AI reference-derived weave with approximate normal and roughness maps. These are not measured Maple material samples.

## Rendering and controls

The camera keeps a fixed viewing direction while the chair turns. Warm left lighting and transparent contact/directional shadows approximate the room image. Expanded zoom scales both image and canvas together. Desktop, mobile framing, material controls, all four views, keyboard rotation/zoom and dialog reopening were checked locally. A physical touchscreen pinch was not exercised.

Taro assets currently use `Cache-Control: no-store` because filenames remain revision-in-place pilot assets. Use versioned content-addressed filenames before granting immutable caching. Older chair models, room GLBs, Blender sources and working render studies are intentionally absent from the web payload.

## Deployment

The existing VPS Next.js process serves the frontend on port 3007 through the existing Cloudflare Tunnel. Build a separate frontend release, verify it on a spare loopback port, retain the previous frontend for rollback, then change the stable `Frontend` path and restart only `maplefurnishers-revamp`. The catalogue process, backend and tunnel are separate services.
