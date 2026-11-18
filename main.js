/* INFINYQ — scroll-driven hero + UI */
(() => {
  const FRAME_COUNT = 88;
  const END_FRAME = FRAME_COUNT - 1; // ~7.5s: front-facing, eyes open
  const HOLO_END = Math.round(END_FRAME * 8 / 113), HUMAN_AT = Math.round(END_FRAME * 62 / 113);
  const framePath = i => `assets/frames/f${String(i + 1).padStart(3, '0')}.webp`;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hero = document.getElementById('hero');
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');
  const phases = [...document.querySelectorAll('.phase')];
  const cards = [...document.querySelectorAll('.orbit__card')];
  const railFill = document.getElementById('railFill');
  const railLabels = [...document.querySelectorAll('.rail__labels li')];
  const hint = document.getElementById('hint');
  const loader = document.getElementById('loader');
  const loaderPct = document.getElementById('loaderPct');

  /* ---------- frame preloading (coarse first, then fill) ---------- */
  const frames = new Array(FRAME_COUNT);
  let loaded = 0;
  const order = [];
  [16, 8, 4, 2, 1].forEach(step => {
    for (let i = 0; i < FRAME_COUNT; i += step) if (!order.includes(i)) order.push(i);
  });
  let cursor = 0;
  const loadNext = () => {
    if (cursor >= order.length) return;
    const idx = order[cursor++];
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      frames[idx] = img; loaded++;
      loaderPct.textContent = Math.round((loaded / FRAME_COUNT) * 100) + '%';
      if (loaded === FRAME_COUNT) loader.classList.add('done');
      if (loaded === 1 || Math.abs(idx - currentFrame) < 4) requestDraw();
      loadNext();
    };
    img.onerror = loadNext;
    img.src = framePath(idx);
  };
  for (let k = 0; k < 6; k++) loadNext(); // 6 parallel streams

  /* ---------- helpers ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;

  // Scroll progress → frame index (hold hologram while frames orbit, then transform)
  const progressToFrame = p => {
    if (p < 0.4) return lerp(0, HOLO_END, p / 0.4);
    if (p < 0.78) return lerp(HOLO_END, HUMAN_AT, ease(range(p, 0.4, 0.78)));
    return lerp(HUMAN_AT, END_FRAME, range(p, 0.78, 1));
  };

  let progress = 0, currentFrame = 0, drawQueued = false;
  const isMobile = () => innerWidth <= 820;

  const nearestLoaded = i => {
    if (frames[i]) return frames[i];
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  };

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    requestDraw();
  };

  const draw = () => {
    drawQueued = false;
    const img = nearestLoaded(currentFrame);
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#030308';
    ctx.fillRect(0, 0, W, H);
    if (!img) return;
    // cover-fit, then drift right on desktop so the final face sits beside the copy
    const zoom = lerp(1.08, 1.0, range(progress, 0, 0.5));
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    let x = (W - w) / 2, y = (H - h) / 2;
    if (!isMobile()) x += W * 0.17 * ease(range(progress, 0.62, 0.9));
    else y -= H * 0.08;
    ctx.drawImage(img, x, y, w, h);
  };
  function requestDraw() { if (!drawQueued) { drawQueued = true; requestAnimationFrame(draw); } }

  /* ---------- orbiting identity frames ---------- */
  const SELECTED = 3;
  const updateOrbit = p => {
    const mobile = isMobile();
    const R = mobile ? Math.min(innerWidth * 0.36, 150) : Math.min(innerWidth * 0.17, 250);
    const appear = range(p, 0.05, 0.16);
    const converge = ease(range(p, 0.34, 0.46));   // non-selected cards collapse
    const pick = ease(range(p, 0.30, 0.40));        // selected card steps forward
    const attach = ease(range(p, 0.42, 0.54));      // selected card merges into head
    const spin = p * Math.PI * 2.4;

    cards.forEach((card, i) => {
      const a = spin + (i / cards.length) * Math.PI * 2;
      let x = Math.cos(a) * R;
      let z = Math.sin(a) * R * 0.9;
      let y = Math.sin(a * 0.5 + i) * R * 0.18;
      let scale = 1, opacity = appear;

      if (i === SELECTED) {
        // pull to front-centre, then shrink into the face
        x = lerp(x, 0, pick); z = lerp(z, 220, pick); y = lerp(y, -10, pick);
        scale = lerp(1, 1.25, pick) * lerp(1, 0.25, attach);
        opacity = appear * (1 - attach);
      } else {
        x = lerp(x, 0, converge); z = lerp(z, -200, converge); y = lerp(y, 0, converge);
        scale = lerp(1, 0.3, converge);
        opacity = appear * (1 - converge) * (0.55 + 0.45 * ((z / R + 1) / 2));
      }
      const depthBlur = i === SELECTED ? 0 : clamp(-z / R, 0, 1) * 2;
      card.style.transform = `translate3d(${x}px,${y}px,${z}px) scale(${scale})`;
      card.style.opacity = opacity.toFixed(3);
      card.style.filter = depthBlur > 0.1 ? `blur(${depthBlur.toFixed(1)}px)` : 'none';
      card.style.zIndex = Math.round(z + 1000);
    });
  };

  /* ---------- copy phases ---------- */
  const updatePhases = p => {
    phases.forEach(el => {
      const from = +el.dataset.from, to = +el.dataset.to, f = 0.05;
      const inT = range(p, from, from + f), outT = to >= 1 ? 0 : range(p, to - f, to);
      const o = Math.min(inT, 1 - outT);
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translateY(${lerp(30, 0, inT) - outT * 30}px)`;
      el.classList.toggle('is-live', o > 0.5);
    });
  };

  const updateRail = p => {
    railFill.style.height = (p * 100) + '%';
    railLabels.forEach(li => li.classList.toggle('on', p >= +li.dataset.at));
    hint.style.opacity = p > 0.03 ? 0 : 1;
    document.querySelector('.rail').style.opacity = (1 - range(p, 0.8, 0.9)).toFixed(2);
  };

  const onScroll = () => {
    const rect = hero.getBoundingClientRect();
    const total = hero.offsetHeight - innerHeight;
    progress = clamp(-rect.top / total);
    const f = Math.round(progressToFrame(progress));
    currentFrame = f; requestDraw();
    updateOrbit(progress);
    updatePhases(progress);
    updateRail(progress);
  };

  if (reduceMotion) {
    // Skip the long scroll: show the finished human with the brand message.
    hero.style.height = '100vh';
    progress = 1; currentFrame = END_FRAME;
    updatePhases(1); updateOrbit(1); updateRail(1);
    
    addEventListener('resize', resize);
  } else {
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', () => { resize(); onScroll(); });
    onScroll();
  }
  resize();

  /* ---------- nav ---------- */
  const toggle = document.querySelector('.nav__toggle');
  const mobileNav = document.querySelector('.nav__mobile');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    mobileNav.hidden = open;
  });
  mobileNav.addEventListener('click', e => {
    if (e.target.tagName === 'A') { mobileNav.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
  });

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = ((i % 4) * 70) + 'ms';
    io.observe(el);
  });

  /* ---------- demo video: play when visible ---------- */
  const vid = document.querySelector('.demo video');
  if (vid && !reduceMotion) {
    new IntersectionObserver(([en]) => { en.isIntersecting ? vid.play().catch(() => {}) : vid.pause(); }, { threshold: 0.4 }).observe(vid);
  }

  /* ---------- contact form → email draft ---------- */
  const form = document.getElementById('contactForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(form);
    const subject = `[INFINYQ] ${d.get('topic')} — ${d.get('name')}`;
    const body = `${d.get('message')}\n\n— ${d.get('name')} (${d.get('email')})`;
    location.href = `mailto:hello@infinyq.co.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    document.getElementById('formNote').textContent = 'Your email app should open with the message ready. Thank you!';
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
