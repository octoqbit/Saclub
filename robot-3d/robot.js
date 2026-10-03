/* Original motion is baked into the source asset: no retiming or filters. */
const robot = document.querySelector('.robot-assembly');
const playButton = document.querySelector('.play-button');
const playbackError = document.querySelector('.playback-error');

// Safari needs HEVC for video transparency; Chromium/Firefox use VP9 alpha.
// Choosing explicitly also avoids opaque HEVC playback in Chromium on macOS.
const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/.test(ua);
robot.muted = true;
robot.defaultMuted = true;
robot.src = isSafari || isIOS
  ? 'assets/robot-assembly-safari.mp4'
  : 'assets/robot-assembly.webm';

async function play() {
  try {
    await robot.play();
    playButton.hidden = true;
  } catch (error) {
    // Mobile low-power mode may require a user gesture even for muted video.
    if (error.name === 'NotAllowedError') playButton.hidden = false;
    else if (error.name !== 'AbortError') playbackError.hidden = false;
  }
}

robot.addEventListener('error', () => {
  playbackError.hidden = false;
  playButton.hidden = true;
});
robot.addEventListener('playing', () => {
  playButton.hidden = true;
  playbackError.hidden = true;
});
playButton.addEventListener('click', play);
play();
