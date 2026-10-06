import { loadContent, imageURL, node } from './lib/content.js';
import { githubRepositoryURL, projectHref } from './lib/project-data.mjs';
import { supabase, checked, requireMember } from './lib/supabase.js';
import { initializeMemberCta } from './lib/member-cta.js';

initializeMemberCta();
const menu = document.querySelector('.world-menu');
const nav = document.querySelector('#world-links');
function toggleMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  menu.textContent = open ? '×' : '☰';
  nav.classList.toggle('menu-open', open);
}
menu.addEventListener('click', () => toggleMenu(menu.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { toggleMenu(false); menu.focus(); }
});

const message = document.querySelector('#project-message');
const article = document.querySelector('#project-detail');
const setText = (selector, value) => { document.querySelector(selector).textContent = value || ''; };
const sections = [
  ['overview', 'The idea', 'text'], ['challenge', 'The problem to solve', 'text'],
  ['approach', 'How we would build it', 'text'], ['features', 'Features', 'list'],
  ['techStack', 'Components & technologies', 'tags'], ['milestones', 'Build milestones', 'steps'],
  ['nextSteps', 'What comes next', 'text'],
];

async function showProject() {
  try {
    const profile = await requireMember();
    if (!profile) return;
    message.hidden = false;
    const slug = new URLSearchParams(location.search).get('project');
    const projects = await loadContent('project');
    const item = projects.find(project => project.slug === slug);
    if (!item) {
      message.replaceChildren(node('h1', '', 'Project not found.'), node('p', '', 'This project may have moved or is not currently published. Explore the collection for available projects.'));
      document.title = 'Project not found | SAC BTKIT';
    } else {
      const details = checked(await supabase.from('content_details').select('body,data').eq('content_id', item.id).maybeSingle());
      if (!details) throw new Error('Project details are unavailable.');
      item.data = { ...item.data, ...details.data };
      document.title = `${item.title} | SAC projects`;
      document.querySelector('meta[name="description"]').content = item.summary;
      setText('#project-title', item.title);
      setText('#project-subtitle', item.data.subtitle || 'SAC / PROJECT LAB');
      setText('#project-status', item.data.status || 'Project');
      setText('#project-summary', item.summary);
      const picture = document.querySelector('#project-image');
      const src = imageURL(item.image);
      if (src) { picture.src = src; picture.alt = item.image_alt || item.title; }
      else picture.parentElement.hidden = true;
      setText('#project-image-caption', item.data.imageCaption);
      document.querySelector('#project-tags').replaceChildren(...item.tags.map(tag => node('span', '', tag)));

      const github = githubRepositoryURL(item.data.githubUrl);
      if (github) {
        const link = document.querySelector('#project-github');
        link.href = github;
        link.hidden = false;
      } else document.querySelector('#project-repo-status').hidden = false;

      const brief = document.querySelector('#project-brief');
      const toc = document.querySelector('#project-sections');
      for (const [index, [key, label, type]] of sections.entries()) {
        const value = item.data[key];
        if (typeof value !== 'string' || !value.trim()) continue;
        const section = node('section', 'project-section');
        section.id = `project-${key}`;
        section.append(node('span', 'eyebrow', `0${index + 1} / PROJECT BRIEF`), node('h2', '', label));
        if (type === 'text') section.append(node('p', '', value));
        else {
          const lines = value.split('\n').map(line => line.trim()).filter(Boolean);
          const list = node(type === 'tags' ? 'div' : type === 'steps' ? 'ol' : 'ul', type === 'tags' ? 'project-tech-list' : '');
          list.append(...lines.map(line => node(type === 'tags' ? 'span' : 'li', '', line)));
          section.append(list);
        }
        brief.append(section);
        const anchor = node('a', '', label); anchor.href = `#${section.id}`; toc.append(anchor);
      }

      const notesButton = document.querySelector('#load-member-notes');
      notesButton.addEventListener('click', async () => {
        notesButton.disabled = true;
        setText('#member-notes-status', 'Opening member notes…');
        try {
          const profile = await requireMember();
          if (!profile) return;
          const details = checked(await supabase.from('content_details').select('body').eq('content_id', item.id).maybeSingle());
          setText('#member-notes-body', details?.body || 'The team has not added member notes yet.');
          document.querySelector('#member-notes-body').hidden = false;
          notesButton.hidden = true;
          setText('#member-notes-status', 'Member notes opened.');
        } catch {
          setText('#member-notes-status', 'Could not load member notes. Please try again.');
        } finally { notesButton.disabled = false; }
      });

      const next = projects[(projects.indexOf(item) + 1) % projects.length];
      const nextLink = document.querySelector('#next-project');
      if (next && next.id !== item.id) { nextLink.textContent = `${next.title} ↗`; nextLink.href = projectHref(next.slug); }
      else nextLink.hidden = true;
      message.hidden = true;
      article.hidden = false;
    }
  } catch {
    message.hidden = false;
    const retry = node('button', 'project-outline-button', 'Try again');
    retry.addEventListener('click', () => location.reload());
    message.replaceChildren(node('h1', '', 'Could not load this project.'), node('p', '', 'Please try again in a moment.'), retry);
  }
}
showProject();
