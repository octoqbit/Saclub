// Public concept briefs. Explicit admin values (including empty strings) win.
// These describe proposed builds, not completed hardware or measured results.
export const projectDefaults = {
  rover: {
    image: '/showcase-assets/project-atlas.jpg', image_alt: 'Concept render of an assembled white autonomous rover with four wheels and a lidar sensor.',
    overview: 'Atlas explores how a small wheeled robot could sense an unfamiliar indoor space and choose its next move. The concept starts with reliable movement and obstacle detection before attempting more ambitious navigation.',
    challenge: 'A useful rover needs to react to obstacles, handle imperfect sensor readings, and stop predictably when a command or connection is lost. The first goal is controlled exploration in a small, supervised test area.',
    approach: 'Build and test the drive base first. Add distance sensing and a stop-on-obstacle loop, then log what the robot sees. Use those observations to compare simple navigation strategies before considering mapping.',
    features: 'Obstacle-aware movement\nManual control with a stop command\nSensor readings and movement logs\nA modular base for later navigation experiments',
    techStack: 'Microcontroller and motor driver\nDistance sensors or compact lidar\nWheel encoders\nEmbedded C/C++ or MicroPython\nPython for log analysis',
    milestones: 'Define the test area and movement limits\nValidate motor control and stopping\nIntegrate sensing and obstacle detection\nCompare navigation runs and document failures',
    nextSteps: 'Choose a drive platform, document the wiring and power requirements, and run a short supervised movement test. Record limitations before adding autonomous behaviour.',
  },
  vision: {
    image: '/showcase-assets/project-iris.jpg', image_alt: 'Concept render of a compact vision camera observing geometric sample objects.',
    overview: 'Iris is a computer-vision concept for turning a camera feed into useful observations. A first version could recognise a small set of objects on a workbench and explain how confidently it identifies them.',
    challenge: 'Lighting, backgrounds, camera position, and similar-looking objects can all change a model’s predictions. A meaningful demonstration should show both successful detections and cases where the system is uncertain.',
    approach: 'Start with a fixed camera and a small, documented set of sample objects. Build a repeatable capture pipeline, compare a simple baseline with a trained model, and inspect errors using images excluded from training.',
    features: 'Live camera preview\nObject labels and confidence display\nA small, documented evaluation set\nClear handling of uncertain predictions',
    techStack: 'USB or board camera\nPython and OpenCV\nA lightweight vision model\nImage annotation tools\nLocal inference interface',
    milestones: 'Choose the objects and capture conditions\nCollect and label representative images\nBuild a baseline and inspect mistakes\nEvaluate on held-out examples and document limits',
    nextSteps: 'Agree on one recognition task and collect an initial set of example images. Define what counts as a useful prediction before choosing a model.',
  },
  signal: {
    image: '/showcase-assets/project-pulse.jpg', image_alt: 'Concept render of three compact wireless environmental sensor nodes.',
    overview: 'Pulse imagines a small network of environmental sensors that makes changes in a room easier to understand. Individual readings become a shared view of temperature, humidity, or light over time.',
    challenge: 'A dashboard should distinguish fresh readings from stale or missing data. Sensors also need calibration checks, consistent timestamps, and a clear explanation of what each measurement represents.',
    approach: 'Connect one sensor node and display its readings locally. Add a simple message format, then connect multiple nodes to a dashboard. Test disconnections and missing readings before expanding the network.',
    features: 'Multiple named sensor nodes\nLive readings and historical trends\nLast-seen indicators for each device\nConfigurable thresholds for environmental changes',
    techStack: 'Wi-Fi microcontroller\nEnvironmental sensor modules\nMQTT or HTTP messaging\nTime-series storage\nWeb dashboard',
    milestones: 'Read and sanity-check one sensor\nSend timestamped readings to a receiver\nDisplay multiple nodes on a dashboard\nTest reconnects, missing data, and threshold rules',
    nextSteps: 'Pick the measurements that matter for one room, assemble a single node, and agree on a common data format before building the dashboard.',
  },
  arm: {
    image: '/showcase-assets/project-dexter.jpg', image_alt: 'Concept render of an assembled desktop robotic arm reaching toward a green cube.',
    overview: 'Dexter is a motion-control concept centred on a small tabletop robotic arm. Its first experiment is a repeatable pick-and-place movement using a lightweight object and a clearly defined workspace.',
    challenge: 'Joint limits, mechanical play, object position, and movement speed affect repeatability. The build should start with one controlled joint and a simple stop mechanism before coordinating an entire arm.',
    approach: 'Model the arm geometry, explore joint motion in simulation, and verify each actuator individually. Add a gripper and slowly combine joints into a repeatable movement sequence within tested limits.',
    features: 'Individual joint control\nDefined movement limits\nA lightweight pick-and-place routine\nRecorded positions for repeatable sequences',
    techStack: 'Servo motors and controller\nLightweight links and gripper\nCAD and motion simulation\nEmbedded control firmware\nBasic kinematics',
    milestones: 'Define reach, joint limits, and a small test object\nSimulate the intended movement\nTest one joint and a stop command\nCombine movements and measure repeatability',
    nextSteps: 'Sketch a simple arm, select a lightweight test object, and validate a single joint. Keep the first movement slow and supervised while documenting the mechanism.',
  },
};

export function prepareProject(item) {
  if (item.kind !== 'project') return item;
  const defaults = projectDefaults[item.slug] || {};
  const { image, image_alt, ...brief } = defaults;
  const legacyImage = /^(\/)?showcase-assets\/(rover|vision)\.jpg$/.test(item.image || '');
  return {
    ...item,
    image: legacyImage && image ? image : item.image,
    image_alt: legacyImage && image_alt ? image_alt : item.image_alt,
    data: { ...brief, imageCaption: image ? 'Illustrative concept render' : '', githubUrl: '', ...item.data },
  };
}

export function githubRepositoryURL(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password) return '';
    if (!/^\/[\w-]+\/[\w.-]+(?:\/.*)?$/.test(url.pathname)) return '';
    return url.href;
  } catch { return ''; }
}

export const projectHref = slug => `/project.html?project=${encodeURIComponent(slug)}`;
