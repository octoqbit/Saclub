// Public artwork only. Project briefs and repository links are loaded from protected content_details.
export const projectDefaults = {
  rover: {
    image: '/showcase-assets/project-atlas.jpg', image_alt: 'Concept render of an assembled white autonomous rover with four wheels and a lidar sensor.',
  },
  vision: {
    image: '/showcase-assets/project-iris.jpg', image_alt: 'Concept render of a compact vision camera observing geometric sample objects.',
  },
  signal: {
    image: '/showcase-assets/project-pulse.jpg', image_alt: 'Concept render of three compact wireless environmental sensor nodes.',
  },
  arm: {
    image: '/showcase-assets/project-dexter.jpg', image_alt: 'Concept render of an assembled desktop robotic arm reaching toward a green cube.',
  },
};

export function prepareProject(item) {
  if (item.kind !== 'project') return item;
  const defaults = projectDefaults[item.slug] || {};
  const { image, image_alt } = defaults;
  const legacyImage = /^(\/)?showcase-assets\/(rover|vision)\.jpg$/.test(item.image || '');
  return {
    ...item,
    image: legacyImage && image ? image : item.image,
    image_alt: legacyImage && image_alt ? image_alt : item.image_alt,
    data: { imageCaption: image ? 'Illustrative concept render' : '', ...item.data },
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
