/*
 * Front-face replacement for the original 24 fps, 880 x 1920 hero clip.
 * Positions were measured against the actual decoded video frames using SIFT.
 * During this reveal the chip translates vertically without rotating. Its
 * existing slight perspective is preserved by the affine surface transform.
 * Nothing is drawn on the chip's bevel, pins, side walls or robot shell.
 */
const CHIP_REVEAL_FIRST_FRAME = 90;
const CHIP_REVEAL_LAST_FRAME = 140;
const CHIP_Y_OFFSETS = [
  -523.40, -442.82, -367.55, -230.67, -168.03, -53.03, 0.00,
  97.99, 143.37, 227.25, 266.08, 302.93, 371.02, 402.36,
  459.87, 486.16, 533.76, 555.26, 593.34, 610.01, 638.53,
  650.38, 660.54, 675.56, 680.25, 684.02,
];

function chipPoseAt(mediaTime) {
  // VP9 timestamps use rounded milliseconds (e.g. 4583ms for frame 110).
  // Rounding, rather than flooring, keeps the artwork on the presented frame.
  const frame = Math.round(mediaTime * 24);
  if (frame < CHIP_REVEAL_FIRST_FRAME || frame > CHIP_REVEAL_LAST_FRAME) {
    return null;
  }
  const dy = CHIP_Y_OFFSETS[frame - CHIP_REVEAL_FIRST_FRAME] ?? 684;
  return { frame, y: 538 + dy };
}

(() => {
  const video = document.querySelector('.robot-assembly');
  const front = document.getElementById('chip-front');
  let previousFrame = -1;

  function render(mediaTime) {
    const pose = chipPoseAt(mediaTime);
    const frame = pose?.frame ?? -1;
    if (frame === previousFrame) return;
    previousFrame = frame;
    front.setAttribute('visibility', pose ? 'visible' : 'hidden');
    if (pose) {
      // Maps the 1000px square artwork to the existing ~134 x 145px face.
      front.setAttribute('transform', `matrix(0.134 -0.004 0.0005 0.145 316 ${pose.y})`);
    }
  }

  if ('requestVideoFrameCallback' in video) {
    const onFrame = (_now, metadata) => {
      render(metadata.mediaTime);
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  } else {
    // Fallback for older browsers without frame-presentation callbacks.
    let animationFrame;
    const tick = () => {
      render(video.currentTime);
      if (!video.paused && !video.ended) animationFrame = requestAnimationFrame(tick);
    };
    video.addEventListener('play', () => {
      cancelAnimationFrame(animationFrame);
      tick();
    });
    video.addEventListener('pause', () => cancelAnimationFrame(animationFrame));
    video.addEventListener('seeked', () => render(video.currentTime));
    video.addEventListener('loadeddata', () => render(video.currentTime));
    if (!video.paused) tick();
  }
  video.addEventListener('emptied', () => {
    previousFrame = -1;
    front.setAttribute('visibility', 'hidden');
  });
})();
