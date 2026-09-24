(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INK = '#16161A', GREY = '#77767A';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // Runs a Web Animation and resolves when it ends (or gets cancelled)
  const A = (el, keyframes, opts) => el.animate(keyframes, Object.assign({ fill: 'forwards', easing: 'cubic-bezier(.2,.7,.2,1)' }, opts)).finished.catch(() => {});
  const onScreen = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; };
  const visible = el => !el.closest('[hidden]') && onScreen(el);

  // Cursors: a pencil by default, its eraser end on old lines, a pen for hiring
  function cursor(transform, shapes, hotspot) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g transform="' + transform +
      '" stroke="#16161A" stroke-width="1" stroke-linejoin="round">' + shapes + '</g></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + hotspot;
  }
  const pencil = '<polygon points="5,-2 10,-4.5 10,4.5 5,2" fill="#EACDA3"/><polygon points="0,0 5,-2 5,2" fill="#2B2B2B"/>' +
    '<rect x="10" y="-4.5" width="20" height="9" fill="#F2C230"/><rect x="30" y="-4.5" width="3" height="9" fill="#BDBBB4"/>' +
    '<rect x="33" y="-4.5" width="5" height="9" rx="1.5" fill="#F0A3A3"/>';
  const pen = '<polygon points="0,0 8,-3.5 8,3.5" fill="#D8D6CF"/><line x1="1" y1="0" x2="6" y2="0"/>' +
    '<rect x="8" y="-3.5" width="4" height="7" fill="#16161A"/><rect x="12" y="-4.5" width="19" height="9" rx="2" fill="#D2232A"/>' +
    '<rect x="17" y="-6.5" width="12" height="2" fill="#BDBBB4"/><rect x="31" y="-4.5" width="5" height="9" rx="2.5" fill="#16161A"/>';
  root.style.setProperty('--c-pencil', cursor('translate(1.5 1.5) rotate(45)', pencil, '1 1'));
  root.style.setProperty('--c-eraser', cursor('translate(1.5 1.5) rotate(45) translate(38 0) scale(-1 1)', pencil, '2 2'));
  root.style.setProperty('--c-pen', cursor('translate(1.5 1.5) rotate(45)', pen, '1 1'));

  // Small message at the bottom of the screen
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  // Dry mode: switching on makes the jokes evaporate; switching off inks them back in
  const dryBtn = document.getElementById('dryToggle');
  let dryOn = root.classList.contains('is-dry'), dryRun = 0, dryAnims = [];
  const track = a => { dryAnims.push(a); return a; };
  // When Dry mode adds or removes things, everything that moves glides to its new place instead of jumping,
  // and the part of the page being read stays put
  function flipLayout(change) {
    const page = document.querySelector('.page:not([hidden])');
    const outer = [...page.querySelectorAll(':scope > .book > *'), document.querySelector('.foot')];
    const inner = [...page.querySelectorAll(':scope > .book > * > .row')];
    const shown = el => el.getClientRects().length > 0;
    const top = el => el.getBoundingClientRect().top;
    const anchor = outer.find(el => shown(el) && el.getBoundingClientRect().bottom > 90);
    const anchorTop = anchor ? top(anchor) : 0;
    const before = new Map();
    [...outer, ...inner].forEach(el => { if (shown(el)) before.set(el, top(el)); });
    change();
    if (anchor && shown(anchor)) {
      const drift = top(anchor) - anchorTop;
      if (Math.abs(drift) > 1) jumpTo(window.scrollY + drift);
    }
    if (reduce) return;
    const moved = new Map();
    const glide = (el, dy) => el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.2,.7,.2,1)' });
    const appear = (el, delay) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay, easing: 'ease', fill: 'backwards' });
    outer.forEach(el => {
      if (!shown(el)) return;
      if (!before.has(el)) { appear(el, 0); return; }
      const dy = before.get(el) - top(el);
      moved.set(el, dy);
      if (Math.abs(dy) > 1) glide(el, dy);
    });
    inner.forEach(el => {
      if (!shown(el)) return;
      if (!before.has(el)) { appear(el, 120); return; }
      const dy = before.get(el) - top(el) - (moved.get(el.parentElement) || 0);
      if (Math.abs(dy) > 1) glide(el, dy);
    });
  }
  async function setDry(on, animate) {
    const run = ++dryRun;
    dryAnims.forEach(a => a.cancel());
    dryAnims = [];
    dryBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    store.set('dryMode', on ? '1' : '0');
    if (!animate || reduce) { root.classList.toggle('is-dry', on); return; }
    if (on) {
      const jokes = [...document.querySelectorAll('.note, .ins, .co svg, .only-wet')].filter(visible);
      jokes.forEach((el, i) => track(el.animate(
        [{ opacity: 1, filter: 'blur(0px)', translate: '0 0' }, { opacity: 0, filter: 'blur(6px)', translate: '0 -18px' }],
        { duration: 760, delay: Math.min(i, 10) * 60, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' })));
      document.querySelectorAll('.strike').forEach(s => {
        if (!visible(s)) return;
        track(s.animate([{ transform: 'rotate(-4deg) scaleX(1)', transformOrigin: 'right center' }, { transform: 'rotate(-4deg) scaleX(0)', transformOrigin: 'right center' }],
          { duration: 380, delay: 300, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards', pseudoElement: '::after' }));
        track(s.animate([{ color: GREY }, { color: INK }], { duration: 400, delay: 450, fill: 'forwards' }));
      });
      await wait(960);
      if (run !== dryRun) return;
      flipLayout(() => {
        root.classList.add('is-dry');
        dryAnims.forEach(a => a.cancel());
        dryAnims = [];
      });
      toast('Dry mode on. The jokes have left the building.');
    } else {
      flipLayout(() => root.classList.remove('is-dry'));
      // The hero's strike, "Cheesy" and circle redraw themselves through their own CSS animations
      const jokes = [...document.querySelectorAll('.note, .only-wet, .edit[data-keep="new"] .strike')].filter(visible);
      jokes.forEach((el, i) => track(el.animate([{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }],
        { duration: 520, delay: 250 + Math.min(i, 10) * 90, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' })));
      toast('Jokes are back. They missed you.');
    }
  }
  setDry(dryOn, false);
  dryBtn.addEventListener('click', () => { dryOn = !dryOn; setDry(dryOn, true); });

  // Phone menu
  const bar = document.querySelector('.top'), menuBtn = document.getElementById('menuBtn');
  function closeMenu() { bar.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', () => {
    const open = bar.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Rub out the old lines: move the eraser across them, or tap
  document.querySelectorAll('.rw-before').forEach(line => {
    const row = line.closest('.rw');
    let travelled = 0, last = null;
    function erase() {
      if (row.classList.contains('done')) return;
      row.classList.add('done');
      line.classList.add('gone');
      line.setAttribute('aria-hidden', 'true');
      line.tabIndex = -1;
    }
    line.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || row.classList.contains('done')) return;
      if (last) travelled += Math.hypot(e.clientX - last.x, e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
      const p = Math.min(1, travelled / 700);
      line.style.opacity = String(1 - p * 0.8);
      line.style.filter = 'blur(' + (p * 1.5).toFixed(2) + 'px)';
      if (p >= 1) erase();
    });
    line.addEventListener('pointerleave', () => { last = null; });
    line.addEventListener('click', erase);
    line.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); erase(); }
    });
  });

  // Margin notes and ticks ink in as they scroll into view (the hero's notes wait for the hero edit)
  const io = (!reduce && 'IntersectionObserver' in window) ? new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('inked'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  document.querySelectorAll('.note:not(.hn), .tick').forEach(el => {
    if (io) io.observe(el); else el.classList.add('inked');
  });

  // Fill-in-the-blanks form: opens WhatsApp (or email) with the sentence ready to send
  const form = document.getElementById('hireForm');
  const blanks = form ? [...form.querySelectorAll('input[data-blank]')] : [];
  if (form) {
  const err = document.getElementById('formErr');
  const fit = input => { input.style.width = (Math.max(input.placeholder.length, input.value.length) + 2) + 'ch'; };
  blanks.forEach(input => {
    fit(input);
    input.addEventListener('input', () => {
      fit(input);
      input.removeAttribute('aria-invalid');
      err.textContent = '';
    });
  });
  function sentence() {
    const v = blanks.map(i => i.value.trim());
    return "Hi, I'm " + v[0] + ' from ' + v[1] + '. We need ' + v[2] + ' by ' + v[3] + '.';
  }
  function ready() {
    const empty = blanks.filter(i => !i.value.trim());
    blanks.forEach(i => { if (empty.includes(i)) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); });
    if (!empty.length) { err.textContent = ''; return true; }
    const label = form.querySelector('label[for="' + empty[0].id + '"]');
    err.textContent = 'Fill in "' + (label ? label.textContent : 'every blank') + '" first.';
    empty[0].focus();
    return false;
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (ready()) window.open('https://wa.me/917016227880?text=' + encodeURIComponent(sentence()), '_blank', 'noopener');
  });
  document.getElementById('emailBtn').addEventListener('click', () => {
    if (ready()) location.href = 'mailto:info@thedrytextco.in?subject=' + encodeURIComponent('Hiring the pen') + '&body=' + encodeURIComponent(sentence());
  });

  }

  // Every page has its own address (/work, /services...). A click strikes the heading out
  // first, the way it always did, then the browser loads the next page and slides it up.
  const PATHS = ['/', '/work', '/services', '/about', '/contact'];
  function jumpTo(y, el) {
    const before = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    if (el) el.scrollIntoView(); else window.scrollTo(0, y);
    root.style.scrollBehavior = before;
  }
  const here = document.querySelector('.page');

  // Old links, like thedrytextco.in/#work, still land in the right place
  const oldHash = '/' + decodeURIComponent(location.hash.slice(1));
  if (location.pathname === '/' && PATHS.includes(oldHash) && oldHash !== '/') location.replace(oldHash);

  const badUrl = document.getElementById('badUrl');
  if (badUrl) badUrl.textContent = 'thedrytextco.in' + location.pathname;

  // Arriving: the heading writes itself in
  const arrived = here && here.querySelector('[data-reveal]');
  if (arrived && !reduce && here.dataset.page !== 'home') {
    arrived.animate([{ clipPath: 'inset(-60% 100% -30% 0)' }, { clipPath: 'inset(-60% 0 -30% 0)' }],
      { duration: 560, delay: 120, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
  }

  async function strikeThenGo(href) {
    const heading = here && here.querySelector('[data-reveal]');
    if (heading && onScreen(heading) && !reduce) {
      const line = document.createElement('span');
      line.className = 'pst';
      heading.append(line);
      await Promise.race([A(line, [{ scale: '0 1' }, { scale: '1 1' }], { duration: 280, easing: 'cubic-bezier(.65,0,.35,1)' }), wait(400)]);
    }
    location.href = href;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) { closeMenu(); return; }
    if (!PATHS.includes(url.pathname)) return;
    e.preventDefault();
    closeMenu();
    strikeThenGo(url.href);
  });

  // The hero edit: the strike, then "Cheesy", then the circle around "Co.", then the margin notes one by one
  function playHero() {
    root.classList.remove('hero-wait');
    root.classList.add('hero-go');
    const delays = [1150, 1450, 2250, 2650, 3050];
    document.querySelectorAll('.hn').forEach((n, i) => setTimeout(() => n.classList.add('inked'), reduce ? 0 : delays[i] || 3000));
  }

  // Opening (once per visit): two bad drafts of the name get struck out, the right one files itself into the top bar
  async function runIntro() {
    const intro = document.getElementById('intro');
    const nameEl = intro.querySelector('.intro-name'), tx = intro.querySelector('.intro-tx');
    const lbl = intro.querySelector('.intro-lbl'), st = intro.querySelector('.intro-st');
    const brand = document.querySelector('.brand'), fading = [document.getElementById('main'), document.querySelector('.foot')];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      root.classList.remove('intro');
      [brand, ...fading].forEach(el => el.getAnimations().forEach(a => a.cancel()));
      intro.remove();
      setTimeout(playHero, 150);
    };
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
    intro.addEventListener('click', finish);
    setTimeout(finish, 8000); // never keep the page covered if the animation stalls
    document.addEventListener('keydown', finish, { once: true });
    await Promise.race([document.fonts ? document.fonts.ready : wait(0), wait(1200)]);
    await wait(650);
    for (const [text, label] of [['Dry Text &amp; Co.', 'draft_2'], ['The Dry Text Co.', 'final_final_v3 ✓']]) {
      if (done) return;
      await A(st, [{ scale: '0 1' }, { scale: '1 1' }], { duration: 320, easing: 'cubic-bezier(.65,0,.35,1)' });
      await wait(160);
      await A(nameEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease' });
      tx.innerHTML = text;
      lbl.textContent = label;
      st.getAnimations().forEach(a => a.cancel());
      await A(nameEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' });
      await wait(300);
    }
    if (done) return;
    lbl.style.color = 'var(--red)';
    await wait(420);
    if (done) return;
    nameEl.getAnimations().forEach(a => a.cancel());
    lbl.remove();
    st.remove();
    // The name and the top-bar name share the same font settings, so scaling one onto the other lines up exactly
    const a = nameEl.getBoundingClientRect(), b = brand.getBoundingClientRect();
    intro.style.pointerEvents = 'none';
    A(nameEl, [{ transform: 'none' }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width})` }], { duration: 780, easing: 'cubic-bezier(.7,0,.2,1)' });
    A(intro, [{ backgroundColor: 'rgba(251,251,249,1)' }, { backgroundColor: 'rgba(251,251,249,0)' }], { duration: 520, delay: 320, easing: 'ease', fill: 'both' });
    fading.forEach(el => A(el, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 460, fill: 'both' }));
    await wait(790);
    if (done) return;
    A(brand, [{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'linear' });
    await A(nameEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'linear' });
    await wait(400);
    finish();
  }
  if (document.getElementById('intro') && root.classList.contains('intro')) runIntro();
  else if (document.querySelector('.hero')) setTimeout(playHero, reduce ? 0 : 300);
  else root.classList.remove('hero-wait');

  // The tagline machine
  const REELS = [
    ['Write bolder.', 'Say less.', 'Sell without shouting.', 'Cut the cliché.', 'Land the first line.', 'Skip the buzzwords.'],
    ['Charge more.', 'Sound like someone.', 'Get read, not skimmed.', 'Win the inbox.', 'Make them screenshot it.', 'Outlive the scroll.'],
    ['Then sleep.', 'Then send it.', 'Then do it again.', 'Then raise your rates.', 'Then thank the pen.', 'Then order chai.']
  ];
  const reels = [...document.querySelectorAll('#reels .reel')], spinBtn = document.getElementById('spinBtn'), tagSend = document.getElementById('tagSend');
  const pick = list => list[Math.floor(Math.random() * list.length)];
  if (spinBtn && tagSend) {
  const settleTag = () => { tagSend.href = 'https://wa.me/917016227880?text=' + encodeURIComponent('Your tagline machine gave me this: ' + reels.map(r => r.textContent).join(' ')); };
  reels.forEach((r, i) => { r.textContent = REELS[i][i]; });
  settleTag();
  spinBtn.addEventListener('click', () => {
    if (reduce) { reels.forEach((r, i) => { r.textContent = pick(REELS[i]); }); settleTag(); return; }
    spinBtn.disabled = true;
    reels.forEach((r, i) => {
      let ticks = 0;
      r.classList.add('spinning');
      const t = setInterval(() => {
        r.textContent = pick(REELS[i]);
        if (++ticks <= 8 + i * 5) return;
        clearInterval(t);
        r.classList.remove('spinning');
        r.animate([{ transform: 'translateY(-6px)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
        if (i === reels.length - 1) { spinBtn.disabled = false; settleTag(); }
      }, 70);
    });
  });
  }

  // Who we are: the red pen circles the five things we do, one at a time.
  // Each circle is drawn to its own word's size, so the line stays even; the last one fades as the next is drawn.
  (() => {
    const words = [...document.querySelectorAll('#does .w')];
    if (!words.length) return;
    const NS = 'http://www.w3.org/2000/svg', PX = 6, PY = 4;
    const ringPath = (w, h) => {
      const X = x => (x * w / 100).toFixed(1), Y = y => (y * h / 40).toFixed(1);
      return `M${X(58)} ${Y(3)}C${X(30)} ${Y(0)} ${X(3)} ${Y(6)} ${X(2)} ${Y(20)}C${X(1)} ${Y(33)} ${X(25)} ${Y(38)} ${X(51)} ${Y(37)}` +
             `C${X(77)} ${Y(36)} ${X(98)} ${Y(30)} ${X(98)} ${Y(18)}C${X(98)} ${Y(6)} ${X(76)} ${Y(1)} ${X(46)} ${Y(3)}`;
    };
    // Sized when drawn: Home may have been hidden (and zero-sized) when a ring was last built
    const ring = w => {
      const W = w.offsetWidth + PX * 2, H = w.offsetHeight + PY * 2;
      if (w._ring && w._ring.W === W && w._ring.H === H) return w._ring;
      if (w._ring) w._ring.svg.remove();
      const svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
      svg.setAttribute('class', 'pen-ring');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.style.left = -PX + 'px';
      svg.style.top = -PY + 'px';
      path.setAttribute('d', ringPath(W, H));
      svg.appendChild(path);
      w.appendChild(svg);
      const L = path.getTotalLength();
      path.style.strokeDasharray = L;
      path.style.strokeDashoffset = L;
      return (w._ring = { svg, path, L, W, H });
    };
    let cur = -1;
    function circle(i, animate) {
      const next = words[i];
      if (!next.offsetWidth) return;
      const prev = words[cur];
      if (prev && prev !== next && prev._ring) {
        const r = prev._ring;
        if (animate) {
          const fade = r.svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' });
          fade.finished.then(() => { r.path.style.strokeDashoffset = r.L; fade.cancel(); }).catch(() => {});
        } else r.path.style.strokeDashoffset = r.L;
      }
      const { path, L } = ring(next);
      path.style.strokeDashoffset = 0;
      if (animate) path.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)' });
      cur = i;
    }
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      circle(0, !reduce);
      if (!reduce) setInterval(() => {
        if (document.hidden || root.classList.contains('is-dry')) return;
        circle((cur + 1) % words.length, true);
      }, 2000);
      let t;
      addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (cur >= 0) circle(cur, false); }, 150); });
    });
  })();

  // Work: the long chapters are an index with the piece open beside it. Switching lifts the open one
  // away, slides the next one in and writes its title in.
  const two = n => String(n).padStart(2, '0');
  const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  function deck(listId, readId, items, nextLabel) {
    const list = document.getElementById(listId), read = document.getElementById(readId);
    if (!list || !read || !items.length) return;
    let at = -1, swap = null;
    items.forEach((it, i) => {
      const b = make('button', 'ob-item');
      b.type = 'button';
      b.tabIndex = i ? -1 : 0;
      b.append(make('span', 'ob-no', it.label), make('span', 'ob-sub', it.title));
      b.addEventListener('click', () => open(i));
      list.append(b);
    });
    function fill(i) {
      const it = items[i], h = make('h3', '', it.title), nav = make('div', 'ob-nav');
      const prev = make('button', 'ghost', '\u2190 Previous'), next = make('button', 'btn', nextLabel);
      prev.type = next.type = 'button';
      prev.addEventListener('click', () => open(at - 1));
      next.addEventListener('click', () => open(at + 1));
      nav.append(make('span', '', two(i + 1) + ' / ' + items.length), prev, next);
      read.textContent = '';
      read.append(make('p', 'ob-to', it.meta), h, make('p', 'ob-body', it.body));
      if (it.subs && it.subs.length) {
        const alt = make('div', 'ob-alt'), ul = make('ul');
        it.subs.forEach(t => ul.append(make('li', '', t)));
        alt.append(make('p', '', 'Other subject lines written for this one'), ul);
        read.append(alt);
      }
      read.append(nav);
      read.scrollTop = 0;
      return h;
    }
    async function open(i) {
      i = (i + items.length) % items.length;
      if (i === at) return;
      const first = at < 0;
      at = i;
      [...list.children].forEach((b, j) => { b.setAttribute('aria-current', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
      const row = list.children[i];
      list.scrollTo({ top: row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2, behavior: first || reduce ? 'auto' : 'smooth' });
      if (first || reduce) { fill(i); return; }
      const token = swap = {};
      await Promise.race([A(read, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 150, easing: 'ease-in' }), wait(300)]);
      if (token !== swap) return;
      read.getAnimations().forEach(a => a.cancel());
      const h = fill(i);
      read.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' });
      h.animate([{ clipPath: 'inset(-20% 100% -20% 0)' }, { clipPath: 'inset(-20% 0 -20% 0)' }], { duration: 560, delay: 90, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    }
    list.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      open(at + (e.key === 'ArrowDown' ? 1 : -1));
      list.children[at].focus();
    });
    open(0);
  }
  const readData = id => { const el = document.getElementById(id); return el ? JSON.parse(el.textContent) : null; };
  const WORK = readData('workData') || {}, MAILS = readData('mailData') || [];
  deck('liList', 'liRead', WORK.linkedin || [], 'Next post \u2192');
  deck('orList', 'orRead', WORK.outreach || [], 'Next mail \u2192');
  deck('obList', 'obRead', MAILS.map(m => ({
    label: 'Dry Text #' + two(m.n) + ' \u00b7 ' + m.to,
    meta: 'DRY TEXT #' + two(m.n) + '  \u00b7  TO ' + m.to.toUpperCase(),
    title: m.subject,
    body: m.body
  })), 'Next mail \u2192');

  // Visitors' own margin notes, in blue, between our red ones. They're kept in this browser only,
  // and can be downloaded as a PDF or sent over WhatsApp.
  const NOTES_KEY = 'dtc-notes';
  let myNotes = (() => { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); } catch (e) { return {}; } })();
  const saveNotes = () => { try { localStorage.setItem(NOTES_KEY, JSON.stringify(myNotes)); } catch (e) {} };
  const PAGE_NAMES = { home: 'Home', work: 'Work', services: 'Services', about: 'About', contact: 'Contact' };
  const slots = [];
  document.querySelectorAll('.page').forEach(page => {
    const name = page.dataset.page;
    if (!PAGE_NAMES[name]) return;
    page.querySelectorAll(':scope > .book > .page-head, :scope > .book > .hero > .row:last-child, :scope > .book > section.sec > .row:first-of-type').forEach((row, k) => {
      let stack = row.querySelector(':scope > .note-stack');
      if (!stack) {
        stack = make('div', 'note-stack');
        const note = row.querySelector(':scope > .note');
        if (note) { note.before(stack); stack.append(note); } else row.append(stack);
      }
      const heading = row.closest('.hero') ? null : (row.querySelector('.eyebrow') || row.querySelector('h1, h2'));
      const slot = make('div', 'slot');
      slot.dataset.key = name + ':' + (row.closest('section[id]') ? row.closest('section[id]').id : k);
      slot.dataset.label = PAGE_NAMES[name] + ' · ' + (heading ? heading.textContent.trim() : 'Top of the page');
      stack.append(slot);
      slots.push(slot);
    });
  });
  const dock = document.getElementById('dock'), dockMenu = document.getElementById('dockMenu'), dockBtn = document.getElementById('dockBtn');
  const writtenNotes = () => slots.map(sl => ({ where: sl.dataset.label, text: (myNotes[sl.dataset.key] || '').trim() })).filter(n => n.text);
  function updateDock() {
    const all = writtenNotes();
    dock.hidden = !all.length;
    if (!all.length) { dockMenu.hidden = true; dockBtn.setAttribute('aria-expanded', 'false'); }
    document.getElementById('dockCount').textContent = all.length + (all.length === 1 ? ' note' : ' notes');
    document.getElementById('notesSend').href = 'https://wa.me/917016227880?text=' + encodeURIComponent('My notes from your site:\n\n' + all.map(n => '• ' + n.where + ': ' + n.text).join('\n'));
  }
  function renderSlot(slot) {
    const key = slot.dataset.key, text = (myNotes[key] || '').trim();
    slot.textContent = '';
    if (!text) {
      const add = make('button', 'add', '✎ your note');
      add.type = 'button';
      add.setAttribute('aria-label', 'Add your own note: ' + slot.dataset.label);
      add.addEventListener('click', () => editSlot(slot));
      slot.append(add);
      return;
    }
    const mine = make('p', 'mine', text);
    mine.title = 'Click to edit';
    mine.addEventListener('click', () => editSlot(slot));
    const del = make('button', 'del', '×');
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete this note');
    del.addEventListener('click', e => { e.stopPropagation(); delete myNotes[key]; saveNotes(); renderSlot(slot); updateDock(); });
    mine.append(del);
    slot.append(mine);
  }
  function editSlot(slot) {
    const key = slot.dataset.key, was = myNotes[key] || '';
    slot.textContent = '';
    const ta = make('textarea');
    ta.value = was;
    ta.rows = 1;
    ta.setAttribute('aria-label', 'Your note: ' + slot.dataset.label);
    const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    // Saved as they type too, so closing the tab mid-note loses nothing
    ta.addEventListener('input', () => {
      grow();
      const v = ta.value.trim();
      if (v) myNotes[key] = v; else delete myNotes[key];
      saveNotes();
      updateDock();
    });
    ta.addEventListener('keydown', e => { if (e.key === 'Escape') { ta.value = was; ta.dispatchEvent(new Event('input')); ta.blur(); } });
    ta.addEventListener('blur', () => {
      const v = ta.value.trim();
      if (v) myNotes[key] = v; else delete myNotes[key];
      saveNotes();
      renderSlot(slot);
      updateDock();
    });
    slot.append(ta);
    grow();
    ta.focus();
  }
  function loadPdfMaker() {
    if (window.jspdf) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      tag.onload = resolve;
      tag.onerror = reject;
      document.head.append(tag);
    });
  }
  async function downloadNotes() {
    try { await loadPdfMaker(); } catch (e) { toast("Couldn't load the PDF maker. Check your connection and try again."); return; }
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 56, textW = W - M - 170;
    const marginLine = () => { doc.setDrawColor(242, 184, 184); doc.setLineWidth(1.2); doc.line(W - 140, 36, W - 140, H - 36); };
    const small = () => { doc.setFont('courier', 'normal'); doc.setFontSize(9); doc.setTextColor(119, 118, 122); };
    marginLine();
    doc.setFont('times', 'normal');
    doc.setFontSize(24);
    doc.setTextColor(22, 22, 26);
    doc.text('Notes from thedrytextco.in', M, 92);
    small();
    doc.text(new Date().toLocaleString(), M, 112);
    let y = 152;
    writtenNotes().forEach(n => {
      if (y > H - 110) { doc.addPage(); marginLine(); y = 80; }
      small();
      doc.text(n.where.toUpperCase(), M, y);
      y += 17;
      doc.setFont('times', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(47, 91, 211);
      doc.splitTextToSize(n.text, textW).forEach(line => {
        if (y > H - 70) { doc.addPage(); marginLine(); y = 80; }
        doc.text(line, M, y);
        y += 19;
      });
      y += 20;
    });
    small();
    doc.text('Written by you. We just held the pen.', M, H - 48);
    doc.save('my-notes-the-dry-text-co.pdf');
  }
  dockBtn.addEventListener('click', () => {
    const open = dockMenu.hidden;
    dockMenu.hidden = !open;
    dockBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.getElementById('notesPdf').addEventListener('click', downloadNotes);
  document.getElementById('notesClear').addEventListener('click', () => {
    myNotes = {};
    saveNotes();
    slots.forEach(renderSlot);
    updateDock();
    toast('Notes cleared.');
  });
  slots.forEach(renderSlot);
  updateDock();

  document.getElementById('yr').textContent = new Date().getFullYear();
  window.__inkReady = true;
})();
