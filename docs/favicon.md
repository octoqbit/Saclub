# Circular favicon

Source: the user's supplied SAC logo (`public/favicon.png`).
Asset: `public/favicon-round.png`, 64 × 64 PNG with transparent corners.
Method: built-in image editing, then downscaled with macOS `sips` for browser tabs.
The distinct filename avoids reusing the previous rectangular favicon URL.

## Edit prompt

Use case: background-extraction.
Asset type: circular browser favicon for SAC BTKIT.
Input image 1 is the edit target, the user's supplied official SAC logo.
Make a square canvas containing a perfectly circular off-white disk with the existing black SAC logo centered inside. Outside the circle must be actual transparent alpha, including all four corners. The disk should fill 96% of the canvas diameter. Enlarge the full supplied logo and its tagline to fit neatly inside the disk, leaving about 8% safe margin; no part of the black artwork should be clipped. Preserve the exact distinctive stylized SAC lettering, arrow/swoosh shapes and the text "BYTES INTO BOTS". Keep the same black and off-white colors. Change only the framing from a large rectangular backdrop to a circular badge with transparent exterior. No square background, no new border, no drop shadow, no new elements, no mockup. Clean crisp favicon asset.
