import './help-center.css';

const banner = document.createElement('dialog');
banner.id = 'sac-help-center';
banner.className = 'sac-help-banner';
banner.setAttribute('aria-labelledby', 'sac-help-title');
banner.setAttribute('aria-describedby', 'sac-help-info');
banner.innerHTML = `
  <button class="sac-help-close" type="button" aria-label="Close Help Center" autofocus>×</button>
  <p class="sac-help-label">HELP CENTER</p>
  <h2 id="sac-help-title">Contact Team SAC</h2>
  <p id="sac-help-info">Need help with membership, events, projects, or your account? Email our team with a brief description of your question.</p>
  <a class="sac-help-email" href="mailto:info@saclub.tech">info@saclub.tech</a>
  <p class="sac-help-signature">Sensing and Automation Club </p>
`;
document.body.append(banner);

let opener;
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-help-center]');
  if (!trigger || banner.open) return;
  opener = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  banner.showModal();
});

banner.querySelector('.sac-help-close').addEventListener('click', () => banner.close());
banner.addEventListener('click', (event) => {
  if (event.target !== banner) return;
  const box = banner.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) banner.close();
});
banner.addEventListener('close', () => {
  opener?.setAttribute('aria-expanded', 'false');
  opener?.focus({ preventScroll: true });
});
