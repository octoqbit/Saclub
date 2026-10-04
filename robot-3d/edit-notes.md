# SAC front-face edit

The existing videos are untouched. A local SVG image overlays only the original AI plate. It uses the same `880 × 1920` coordinate system and `contain` scaling as the video, so resizing cannot move the artwork away from the chip.

SIFT feature matching on the decoded source clip measured vertical translation during frames 90–140 (24 fps). The front face does not rotate during this visible interval. Its slight perspective is retained using an affine map with less than one source pixel of corner approximation. The panel's sloping upper edge clips the artwork; frame 141 and later fully obscure this plate. Frame-presentation callbacks synchronize the artwork to the video, including looping. The original front-face rounded outline clips the texture without changing the surrounding chip bevel or thickness.

Artwork: `assets/sac-chip-face.png`

Input: `/Users/ashutoshyadav/Desktop/Screenshot 2026-10-01 at 10.58.17 PM.png`

Method: built-in image-generation tool, referenced-image edit. This is a flattened reconstruction of the supplied front-face design, not an exact pixel extraction. The rest of the animation is the original video.

## Final artwork prompt

Use case: precise-object-edit. Asset type: square front-face texture for the existing animated robot chip. Input image is the user's exact SAC chip design. Extract/reconstruct ONLY its flat dark graphite TOP FACE as an orthographic straight-on square texture, removing all perspective, pins, thickness, sides, surrounding black background, shadows outside the face. Fill the entire square image edge-to-edge with the face surface, with no margin, no transparent border. Preserve the exact thin cyan inset rounded-square outline, dark subtly brushed graphite material, small silver screw heads and the distinctive white outlined futuristic SAC lettering (verbatim S A C) from the reference. Keep the SAC lettering in the same relative lower-middle placement as the reference. Use a top-down flat view with parallel horizontal/vertical sides, no tilt, no 3D extrusion. This is only a replacement surface texture; the real video retains its existing chip edges, pins and thickness. No new branding, no AI letters, no extra decoration. Square 1024 by 1024 texture.
