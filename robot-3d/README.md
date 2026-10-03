# Exact reference robot animation

Open `index.html` in Chrome, Firefox, or Safari. No install, build, or network connection is needed. Only the robot appears on a neutral gray background.

This uses the **original transparent hero animation from https://labs.chaingpt.org/**, with a small standalone HTML/CSS/JavaScript player and a tracked SAC front-face replacement. It is not a newly modeled, editable 3D robot. The video assets remain unmodified: the SAC texture covers only the small plate bearing the original AI lettering. The robot motion, chip thickness, bevels, contacts, and surrounding orange circuitry remain in the source video. No unrelated local videos are used.

The original animation is 880 × 1920, 24 fps, approximately 10.8 seconds, looping at its original speed. The recording starts partway through a loop, so its timestamps do not correspond to the same timestamps in the source clip.

## Files

- `index.html`, `robot.css`, `robot.js`: isolated robot player.
- `chip-overlay.js`: frame-synchronized front-face tracking; SVG clips the replacement behind the closing robot panel.
- `assets/sac-chip-face.png`: flat SAC artwork prepared from the supplied chip screenshot using the built-in image-generation tool. See `edit-notes.md` for the prompt and tracking notes.
- `assets/robot-assembly.webm`: original VP9 video with transparency for Chromium and Firefox.
- `assets/robot-assembly-safari.mp4`: original HEVC video with transparency for Safari.
- `edit-notes.md`: artwork prompt and tracking notes. Development frame captures and the original reference recording were removed after integration.

The main page `../index.html` embeds this component in place of its previous hero robot video. Only that robot element was replaced; `../style.css`, the remaining page markup, and both lower-section videos are unchanged.

## Embedding

The main page uses the opt-in transparent embed mode. The iframe keeps the component's styles and scripts isolated from the host page:

```html
<iframe src="robot-3d/index.html?embed=1"
        title="Robot assembly animation"
        style="width:440px;height:960px;border:0"
        allow="autoplay"></iframe>
```

`?embed=1` makes the background transparent and removes preview padding. Without that parameter, the standalone preview retains its neutral gray background and padding. Both modes use the same animation assets and synchronized SAC front-face overlay.

## Source assets

Retrieved from the public hero `<video>` element on ChainGPT Labs:

- https://chaingpt-web.s3.us-east-2.amazonaws.com/assets/video/Labs/LABS_hero_CHROME_VP9.webm
- https://chaingpt-web.s3.us-east-2.amazonaws.com/assets/video/Labs/LABS_hero_SAFARI_HEVC.mp4

These third-party animation assets are not original artwork created for this project; their original ownership and applicable reuse terms remain unchanged.
