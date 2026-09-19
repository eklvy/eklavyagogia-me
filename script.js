const GH_USER = 'eklvy';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------------- Nav ---------------- */
(function nav(){
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 20);
  }, { passive: true });

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });

  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
})();

/* ---------------- Hero canvas: drifting node graph ---------------- */
(function heroCanvas(){
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  let w, h, nodes;

  function size(){
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }

  function makeNodes(){
    const count = Math.max(18, Math.floor((w * h) / 42000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
    }));
  }

  function frame(){
    ctx.clearRect(0, 0, w, h);
    nodes.forEach(n => {
      if (!reduceMotion){
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
    });
    for (let i = 0; i < nodes.length; i++){
      for (let j = i + 1; j < nodes.length; j++){
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 140){
          ctx.strokeStyle = `rgba(231,163,62,${0.12 * (1 - dist / 140)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
    nodes.forEach(n => {
      ctx.fillStyle = 'rgba(237,238,244,0.5)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    });
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  size();
  makeNodes();
  frame();
  window.addEventListener('resize', () => { size(); makeNodes(); if (reduceMotion) frame(); }, { passive: true });
})();

/* ---------------- Count-up ---------------- */
function countUp(el, target, duration = 900){
  if (reduceMotion || !isFinite(target)){ el.textContent = target; return; }
  const start = performance.now();
  function step(now){
    const p = Math.min(1, (now - start) / duration);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function timeAgo(dateStr){
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  const units = [[31536000,'y'],[2592000,'mo'],[86400,'d'],[3600,'h'],[60,'m']];
  for (const [secs, label] of units){
    if (diff >= secs) return `${Math.floor(diff / secs)}${label} ago`;
  }
  return 'just now';
}

/* ---------------- GitHub profile stats ---------------- */
fetch(`https://api.github.com/users/${GH_USER}`)
  .then(r => { if (!r.ok) throw new Error('rate-limited-or-unavailable'); return r.json(); })
  .then(data => {
    countUp(document.getElementById('statRepos'), data.public_repos || 0);
    countUp(document.getElementById('statFollowers'), data.followers || 0);
    document.getElementById('ghNote').textContent = 'Refreshed just now';
  })
  .catch(() => {
    document.getElementById('statRepos').textContent = '—';
    document.getElementById('statFollowers').textContent = '—';
    document.getElementById('ghNote').innerHTML =
      `Live stats didn't load — <a href="https://github.com/${GH_USER}" target="_blank" rel="noopener" style="color:var(--accent)">view on GitHub</a>`;
  });

/* ---------------- Repo cards ---------------- */
fetch(`https://api.github.com/users/${GH_USER}/repos?per_page=100&sort=updated`)
  .then(r => { if (!r.ok) throw new Error('unavailable'); return r.json(); })
  .then(repos => {
    const grid = document.getElementById('repoGrid');
    const top = repos
      .filter(r => !r.fork)
      .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at)))
      .slice(0, 4);

    if (!top.length){
      grid.innerHTML = `<p style="color:var(--text-muted)">No public repositories to show yet — check the profile directly.</p>`;
      return;
    }

    grid.innerHTML = top.map(r => `
      <a class="repo-card" href="${r.html_url}" target="_blank" rel="noopener">
        <h3>${r.name}</h3>
        <p>${r.description ? escapeHtml(r.description) : 'No description provided.'}</p>
        <div class="repo-card__meta">
          ${r.language ? `<span>${r.language}</span>` : ''}
          <span>★ ${r.stargazers_count}</span>
          <span>Updated ${timeAgo(r.pushed_at)}</span>
        </div>
      </a>
    `).join('');
  })
  .catch(() => {
    document.getElementById('repoGrid').innerHTML =
      `<p style="color:var(--text-muted)">Couldn't load repositories right now — <a href="https://github.com/${GH_USER}" target="_blank" rel="noopener" style="color:var(--accent)">browse them on GitHub</a>.</p>`;
  });

function escapeHtml(str){
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------------- Contribution heatmap ---------------- */
fetch(`https://github-contributions-api.jogruber.de/v4/${GH_USER}?y=last`)
  .then(r => { if (!r.ok) throw new Error('unavailable'); return r.json(); })
  .then(data => {
    const days = data.contributions || [];
    const totalContrib = Object.values(data.total || {}).reduce((a, b) => a + b, 0);
    countUp(document.getElementById('statContrib'), totalContrib);

    // current streak: walk backward from most recent day
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--){
      if (days[i].count > 0) streak++; else break;
    }
    countUp(document.getElementById('statStreak'), streak);

    const wrap = document.getElementById('heatmap');
    wrap.innerHTML = days.map((d, i) => `
      <div class="cell" data-level="${d.level}" title="${d.count} contribution${d.count === 1 ? '' : 's'} on ${d.date}"
           style="animation-delay:${Math.min(i * 1.2, 500)}ms"></div>
    `).join('');
  })
  .catch(() => {
    document.getElementById('heatmap').innerHTML =
      `<p style="color:var(--text-muted); font-size:0.85rem;">Contribution graph didn't load — see it live on the GitHub profile.</p>`;
    document.getElementById('statContrib').textContent = '—';
    document.getElementById('statStreak').textContent = '—';
  });
