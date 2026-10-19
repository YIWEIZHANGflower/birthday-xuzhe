(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const content = window.birthdayContent || {};
  const scenes = ['gift', 'unbox', 'wish', 'letter'];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animate = () => Boolean(window.gsap) && !motion.matches;
  let current = 0, wished = false, opening = false, hasOpened = false;
  let sceneTimeline, rollTimeline, signatureTimeline, signaturePending = false;
  let winningCard, winningIndex = 43, burstTimer;
  const items = [
    { name: 'AK-47', skin: '板岩', image: 'assets/ak-slate.png', rarity: 'purple' },
    { name: 'M4A1-S', skin: '毁灭者', image: 'assets/m4-decimator.png', rarity: 'pink' },
    { name: 'AWP', skin: '树蝰', image: 'assets/awp-atheris.png', rarity: 'purple' },
    { name: '★ 生日特别物品', skin: '20 周岁 · 专属好运', image: 'assets/birthday-medal.svg', rarity: 'gold' }
  ];
  document.title = `${content.recipient || '徐喆'}，20 周岁生日快乐`;
  document.querySelectorAll('[data-recipient]').forEach(el => { el.textContent = content.recipient || '徐喆'; });
  (content.paragraphs || []).forEach(text => {
    const p = document.createElement('p'); p.textContent = text; $('letter-copy').append(p);
  });
  const announce = text => { $('announcement').textContent = text; };

  const music = (() => {
    const audio = $('background-music');
    const settings = content.music || {};
    let enabled = true, requested = false, generation = 0;
    let targetVolume = settings.volume ?? .2;
    if (settings.src) audio.src = settings.src;
    audio.volume = targetVolume;
    function render() {
      const playing = !audio.paused && !audio.ended && !audio.error;
      $('music-button').textContent = playing ? '音乐 暂停' : '音乐 开启';
      $('music-button').setAttribute('aria-pressed', String(Boolean(playing)));
      $('music-button').setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
      $('music-button').title = settings.title || '马思唯 · Coco Elva Tia';
    }
    function play() {
      if (!enabled) return;
      requested = true;
      const request = ++generation;
      if (window.gsap) gsap.killTweensOf(audio);
      // Request audible playback directly inside the first tap, including WeChat.
      audio.volume = targetVolume;
      const result = audio.play();
      if (result) result.then(() => {
        if (request !== generation) return;
        if (!enabled) audio.pause();
        render();
      }).catch(render);
    }
    $('music-button').addEventListener('click', () => {
      if (!audio.paused) { enabled = false; ++generation; audio.pause(); }
      else { enabled = true; play(); }
      render();
    });
    for (const event of ['play', 'pause', 'ended', 'error']) audio.addEventListener(event, render);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { ++generation; audio.pause(); }
      else if (enabled && requested) play();
    });
    function retry(event) {
      if (event.target.closest('#music-button')) return;
      if (enabled && requested && audio.paused && !document.hidden) play();
    }
    document.addEventListener('touchend', retry, { passive: true });
    document.addEventListener('click', retry);
    function setLevel(index) {
      targetVolume = index === 1 ? .12 : index === 3 ? .16 : (settings.volume ?? .2);
      if (window.gsap) gsap.to(audio, { volume: targetVolume, duration: .9, ease: 'sine.inOut', overwrite: true });
      else audio.volume = targetVolume;
    }
    render();
    return { play, setLevel };
  })();

  const sound = (() => {
    let enabled = true, context, master, lastTick = 0;
    function prepare() {
      if (!enabled) return;
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        if (!context) { context = new Audio(); master = context.createGain(); master.gain.value = .12; master.connect(context.destination); }
        if (context.state === 'suspended') context.resume().catch(() => {});
      } catch { /* The visual experience also works without sound. */ }
    }
    function tone(frequency, duration, volume = .18, type = 'triangle', offset = 0) {
      if (!enabled || !context || context.state !== 'running' || document.hidden) return;
      const now = context.currentTime + offset;
      const osc = context.createOscillator(), gain = context.createGain();
      osc.type = type; osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .002);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      osc.connect(gain); gain.connect(master); osc.start(now); osc.stop(now + duration + .01);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
    function tick() {
      const now = performance.now();
      if (now - lastTick < 36) return;
      lastTick = now; tone(1250, .022, .24, 'square');
    }
    function win() { [440, 554.37, 659.25, 880].forEach((hz, i) => tone(hz, .48, .2, 'sine', i * .085)); }
    $('sound-button').addEventListener('click', () => {
      enabled = !enabled;
      $('sound-button').textContent = `音效 ${enabled ? '开' : '关'}`;
      $('sound-button').setAttribute('aria-pressed', String(enabled));
      $('sound-button').setAttribute('aria-label', enabled ? '关闭开箱音效' : '开启开箱音效');
      if (master) master.gain.setTargetAtTime(enabled ? .12 : 0, context.currentTime, .02);
      if (enabled) prepare();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && context?.state === 'running') context.suspend().catch(() => {});
      else if (!document.hidden && context?.state === 'suspended' && enabled) context.resume().catch(() => {});
    });
    return { prepare, tick, win };
  })();

  // The original signature's twelve ink partitions preserve the supplied photo.
  // Its mask timing follows the user's actual signing video, including pauses.
  const fromStrokes = [...document.querySelectorAll('.from-stroke')];
  const nameStrokes = [...document.querySelectorAll('.signature-stroke')];
  const allStrokes = [...fromStrokes, ...nameStrokes];
  const lengths = new Map(allStrokes.map(path => [path, path.getTotalLength()]));
  const ink = document.querySelector('.signature-finish');
  const parts = document.querySelector('.signature-parts');
  function finishSignature() {
    signatureTimeline?.kill(); signatureTimeline = null;
    allStrokes.forEach(path => { path.style.strokeDashoffset = '0'; path.style.visibility = 'visible'; });
    ink.style.opacity = '1'; parts.style.opacity = '0';
  }
  function resetSignature() {
    signatureTimeline?.kill(); signatureTimeline = null;
    if (!animate()) { finishSignature(); return; }
    allStrokes.forEach(path => {
      const length = lengths.get(path);
      path.style.strokeDasharray = `${length} ${length}`;
      path.style.strokeDashoffset = String(length); path.style.visibility = 'hidden';
    });
    ink.style.opacity = '0'; parts.style.opacity = '1';
  }
  function writeSignature() {
    signaturePending = false; resetSignature();
    if (!animate()) return;
    signatureTimeline = gsap.timeline({ defaults: { ease: 'none' } });
    function draw(path, pause = 0) {
      const length = lengths.get(path), duration = Number(path.dataset.duration);
      signatureTimeline.set(path, { visibility: 'visible' }, `+=${pause}`);
      const pace = (path.dataset.pace || '0,0;1,1').split(';').map(pair => pair.split(',').map(Number));
      for (let i = 1; i < pace.length; i++) signatureTimeline.to(path, {
        strokeDashoffset: length * (1 - pace[i][1]), duration: duration * (pace[i][0] - pace[i - 1][0])
      });
    }
    signatureTimeline.addLabel('from');
    fromStrokes.forEach(path => draw(path));
    signatureTimeline.addLabel('name');
    nameStrokes.forEach((path, i) => draw(path, Number(path.dataset.delay || 0) + (i === 0 ? .25 : 0)));
    signatureTimeline.set(ink, { opacity: 1 }).set(parts, { opacity: 0 });
  }
  const signatureObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    if (current === 3 && signaturePending && entries.some(entry => entry.isIntersecting)) writeSignature();
  }, { threshold: .5 }) : null;
  signatureObserver?.observe(document.querySelector('.signature-wrap'));
  $('rewrite-signature').addEventListener('click', writeSignature);

  function show(index, focus = true) {
    sceneTimeline?.kill();
    if (current === 1 && index !== 1) { rollTimeline?.kill(); opening = false; $('reel-track').style.willChange = ''; }
    if (index !== 3) { signaturePending = false; finishSignature(); }
    current = index; announce(''); music.setLevel(index);
    scenes.forEach((id, i) => {
      const el = $(id); el.hidden = i !== index; el.inert = i !== index;
      if (window.gsap) gsap.set(el, { clearProps: 'opacity,visibility,transform' });
    });
    $('back').hidden = index === 0;
    $('step').textContent = index + 1;
    document.querySelector('.progress').setAttribute('aria-label', `第 ${index + 1} 页，共 4 页`);
    $('main').dataset.scene = scenes[index];
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (index === 3) { resetSignature(); signaturePending = true; if (!signatureObserver || !animate()) writeSignature(); }
    if (animate()) {
      sceneTimeline = gsap.timeline({ defaults: { ease: 'power2.out', duration: .55 } });
      sceneTimeline.fromTo($(scenes[index]), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, clearProps: 'transform' }, 0);
      if (index === 0) sceneTimeline.fromTo('.case-render', { y: 20, rotation: -4 }, { y: 0, rotation: 0, duration: .9, ease: 'power3.out', clearProps: 'transform' }, .08);
      if (index === 2) sceneTimeline.fromTo('.cake-scene', { autoAlpha: 0, y: 24, scale: .93 }, { autoAlpha: 1, y: 0, scale: 1, duration: .8, clearProps: 'transform' }, .1);
      if (index === 3) sceneTimeline.fromTo('.mvp-banner', { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, clearProps: 'transform' }, .06);
    }
    if (focus) {
      const heading = $(index === 0 ? 'gift-heading' : index === 1 ? 'unbox-heading' : index === 2 ? 'wish-heading' : 'letter-heading');
      heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true });
    }
  }
  function tile(item, mini = false) {
    const el = document.createElement('div'); el.className = `${mini ? 'pool-card' : 'reel-card'} rarity-${item.rarity}`;
    const image = document.createElement('img'); image.src = item.image; image.alt = mini ? `${item.name}，${item.skin}` : ''; image.width = 128; image.height = 96; image.draggable = false;
    const name = document.createElement('strong'); name.textContent = mini && item.rarity === 'gold' ? '★ 特别物品' : item.name;
    const skin = document.createElement('span'); skin.textContent = item.skin;
    el.title = `${item.name} | ${item.skin}`; el.append(image, name, skin); return el;
  }
  items.forEach(item => $('pool-items').append(tile(item, true)));
  function buildReel() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 51; i++) {
      const item = i === winningIndex ? items[3] : items[(i * 7 + Math.floor(i / 3)) % 3];
      const el = tile(item); if (i === winningIndex) { winningCard = el; el.classList.add('winning-card'); }
      fragment.append(el);
    }
    $('reel-track').replaceChildren(fragment);
  }
  function finalX() { return $('reel-window').clientWidth / 2 - winningCard.offsetLeft - winningCard.offsetWidth / 2 + 11; }
  function showReward() {
    opening = false; hasOpened = true;
    document.querySelector('.roller-housing').hidden = true;
    document.querySelector('.unlock-heading').hidden = true;
    $('opening-note').hidden = true; $('unbox-result').hidden = false;
    $('reel-window').setAttribute('aria-label', '已揭晓金色生日奖励：20 周岁专属好运');
    announce('获得专属生日物品：20 周岁，专属好运。');
    if (animate()) {
      sceneTimeline?.kill();
      gsap.set($('unbox'), { autoAlpha: 1, y: 0, clearProps: 'transform' });
      sceneTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
      sceneTimeline.fromTo('.reward-hero', { scale: .68, autoAlpha: 0, y: 20 }, { scale: 1, autoAlpha: 1, y: 0, duration: .85, clearProps: 'transform' }, 0)
        .fromTo('.reward-glow', { scale: .6, autoAlpha: 0 }, { scale: 1.15, autoAlpha: .8, duration: 1.1 }, .05)
        .fromTo('.rare-title, .unbox-result h3, .unbox-result > p:not(.rare-title), #claim-reward', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .55, stagger: .09, clearProps: 'transform' }, .18);
    }
    sound.win(); $('claim-reward').focus({ preventScroll: true });
  }
  function beginRoll() {
    sound.prepare(); rollTimeline?.kill(); resetWish();
    opening = true; hasOpened = false;
    $('unbox-result').hidden = true; document.querySelector('.roller-housing').hidden = false;
    document.querySelector('.unlock-heading').hidden = false; $('opening-note').hidden = false;
    $('roll-status').textContent = '正在解锁…'; $('roll-state').textContent = '解锁中';
    $('reel-window').setAttribute('aria-label', '武器卡片正在横向滚动，生日奖励即将揭晓');
    document.querySelector('.roller-housing').classList.remove('landed');
    buildReel(); show(1);
    if (!animate()) { showReward(); return; }
    const track = $('reel-track'), housing = document.querySelector('.roller-housing');
    const center = $('reel-window').clientWidth / 2;
    const start = center - 2.5 * 134;
    const end = finalX(); let lastIndex = -1, slowing = false;
    gsap.set(track, { x: start }); gsap.set(housing, { clearProps: 'all' }); gsap.set(winningCard, { clearProps: 'transform' });
    track.style.willChange = 'transform';
    rollTimeline = gsap.timeline({ onComplete: () => { track.style.willChange = ''; showReward(); } });
    rollTimeline.addLabel('spin', .15).to(track, {
      x: end, duration: 6.5, ease: 'power3.out',
      onUpdate() {
        const x = Number(gsap.getProperty(track, 'x'));
        const index = Math.floor((center - x) / 134);
        if (index !== lastIndex) { sound.tick(); lastIndex = index; }
        if (!slowing && this.progress() > .55) { slowing = true; $('roll-status').textContent = '即将揭晓…'; }
      }
    }, 'spin');
    // The origin is measured once; the frame loop only reads cached transform values.
    rollTimeline.addLabel('land', 6.65).call(() => {
      gsap.set(track, { x: finalX() }); housing.classList.add('landed');
      $('roll-status').textContent = '获得专属生日物品'; $('roll-state').textContent = '已解锁';
    }, [], 'land').to(winningCard, { scale: 1.06, duration: .36, ease: 'power2.out' }, 'land+=.03')
      .to(housing, { autoAlpha: 0, y: -9, duration: .3, ease: 'power2.in' }, 'land+=.7');
  }
  function resetWish() {
    wished = false; $('cake').classList.remove('blown');
    $('cake').setAttribute('aria-label', 'CS2 黑金巧克力生日蛋糕，带有武器箱装饰和点亮的金色 20 蜡烛');
    $('make-wish').hidden = false; $('open-letter').hidden = true;
    $('wish-hint').textContent = '二十岁的愿望，这一回合留给你。';
    $('wish-note').textContent = '愿望不报点，心里知道就好。';
  }
  function confetti() {
    clearTimeout(burstTimer); const container = $('confetti'); container.replaceChildren();
    if (!animate()) return;
    for (let i = 0; i < 20; i++) {
      const piece = document.createElement('i');
      piece.style.setProperty('--x', `${Math.random() * 100}%`);
      piece.style.setProperty('--drift', `${Math.random() * 120 - 60}px`);
      piece.style.setProperty('--spin', `${Math.random() * 720 - 360}deg`);
      piece.style.setProperty('--delay', `${Math.random() * .3}s`);
      piece.style.background = ['#efa43c', '#f7d8a1', '#8498a4'][i % 3]; container.append(piece);
    }
    burstTimer = setTimeout(() => container.replaceChildren(), 2100);
  }
  $('open-gift').addEventListener('click', () => { if (!opening) { music.play(); beginRoll(); } });
  $('claim-reward').addEventListener('click', () => { show(2); confetti(); });
  $('make-wish').addEventListener('click', () => {
    if (wished) return;
    wished = true; $('cake').classList.add('blown');
    $('cake').setAttribute('aria-label', '生日蛋糕上的蜡烛已经熄灭，愿望已经许好');
    $('make-wish').hidden = true; $('open-letter').hidden = false;
    $('wish-hint').textContent = '愿你许下的愿望，往后都逐一达成。';
    $('wish-note').textContent = '愿望已锁定，队友祝福已就绪。';
    $('open-letter').focus({ preventScroll: true }); announce('蜡烛已经熄灭，生日愿望已许好。');
  });
  $('open-letter').addEventListener('click', () => show(3));
  $('back').addEventListener('click', () => {
    const next = Math.max(0, current - 1); show(next);
    if (next === 1 && hasOpened) showReward();
  });
  $('replay').addEventListener('click', () => {
    rollTimeline?.kill(); opening = false; hasOpened = false; resetWish();
    clearTimeout(burstTimer); $('confetti').replaceChildren(); show(0);
  });
  window.addEventListener('resize', () => {
    if (current === 1 && hasOpened && window.gsap && winningCard) gsap.set($('reel-track'), { x: finalX() });
  }, { passive: true });
  if (window.gsap) gsap.matchMedia().add('(prefers-reduced-motion: reduce)', () => {
    sceneTimeline?.progress(1); rollTimeline?.progress(1); finishSignature();
  });
  show(0, false);
})();
