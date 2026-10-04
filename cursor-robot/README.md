# Cursor robot

A locally generated, articulated Three.js robot inspired by the supplied white
and orange reference. It runs toward the mouse, hops toward a higher cursor,
falls under gravity, bumps into banners, tumbles, and recovers.

- Enabled after mouse movement on screens wider than 900px with a fine pointer.
- Disabled on touch devices and for `prefers-reduced-motion: reduce`.
- The renderer is loaded only when eligible. WebGL failure leaves the page usable.
- The overlay never intercepts clicks. Use **Pause robot** or Escape to pause;
  **Resume robot** restarts it. The preference lasts for the current tab session.
- Navigation, the hero text marquee, partner strip, section banners, footer,
  orange buttons, and the Join form are solid boundaries. Add
  `data-robot-obstacle` to another element to protect it too.
- Scrolling and resizing recalculate boundaries before rendering. If there is
  no safe space, the robot temporarily hides instead of covering a banner.
- The complete 144px square canvas is used for collisions, including tumbling.

`main.js` controls the overlay; `model.js` builds and animates the 3D model;
`physics.mjs` handles motion/collisions; `robot.css` styles only the overlay.

Run `npm test` for collision tests and `npm run build` for the Vercel bundle.
Deploy the whole `cursor-robot` folder, updated `index.html`, `join.html`,
`package.json`, and `package-lock.json`. Vite bundles the scripts automatically.
