/* Звук: синтезируется на Web Audio, ни одного файла — тот же принцип, что и
   с графикой («ноль внешних ассетов»).

   Палитра намеренно чиптюновая: короткие прямоугольные волны и скольжения
   частоты. Подбор фрагмента звучит «монеткой» — это и есть та деталь, по
   которой ухо мгновенно опознаёт платформер.

   Громкость низкая осознанно: игра текстовая по нагрузке, звук не имеет права
   спорить за внимание с определением термина. M — выключить. */
window.AG = window.AG || {};

AG.SFX = (function () {
  let ctx = null, master = null;
  let muted = false;
  try { muted = localStorage.getItem('ag_muted') === '1'; } catch (e) { /* приватный режим */ }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.20;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  /** Одна нота. f2 — конечная частота, если нужно скольжение. */
  function tone(o) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const t = c.currentTime + (o.at || 0), d = o.d || 0.08;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v || 0.5, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + d + 0.03);
  }

  /** Шумовой удар — для приземления. */
  function thud(v) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const t = c.currentTime, len = Math.floor(c.sampleRate * 0.09);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = c.createGain(); g.gain.value = v || 0.5;
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t);
  }

  const seq = (notes) => notes.forEach(n => tone(n));

  const S = {
    jump:      () => tone({ f: 330, f2: 680, d: 0.10, v: 0.30 }),
    land:      () => { thud(0.45); tone({ type: 'triangle', f: 150, f2: 90, d: 0.07, v: 0.22 }); },
    // «монетка»: два быстрых восходящих тона — подпись жанра
    pickup:    () => seq([{ f: 880, d: 0.05, v: 0.32 }, { f: 1320, d: 0.11, v: 0.30, at: 0.05 }]),
    place:     () => tone({ f: 560, d: 0.06, v: 0.26 }),
    deny:      () => tone({ type: 'sawtooth', f: 190, f2: 120, d: 0.13, v: 0.20 }),
    // элемент собрался — короткое разрешение вверх
    assembled: () => seq([
      { f: 523, d: 0.09, v: 0.28 }, { f: 659, d: 0.09, v: 0.28, at: 0.09 },
      { f: 784, d: 0.09, v: 0.28, at: 0.18 }, { f: 1047, d: 0.20, v: 0.26, at: 0.27 }
    ]),
    right:     () => seq([{ f: 784, d: 0.07, v: 0.28 }, { f: 1175, d: 0.14, v: 0.26, at: 0.07 }]),
    wrong:     () => seq([{ type: 'sawtooth', f: 300, d: 0.10, v: 0.22 },
                          { type: 'sawtooth', f: 200, d: 0.16, v: 0.20, at: 0.10 }]),
    finish:    () => seq([
      { f: 523, d: 0.10, v: 0.26 }, { f: 659, d: 0.10, v: 0.26, at: 0.10 },
      { f: 784, d: 0.10, v: 0.26, at: 0.20 }, { f: 1047, d: 0.10, v: 0.26, at: 0.30 },
      { f: 1319, d: 0.32, v: 0.24, at: 0.40 }
    ]),
    start:     () => seq([{ f: 440, d: 0.07, v: 0.24 }, { f: 880, d: 0.14, v: 0.22, at: 0.07 }])
  };

  /** Разблокировка по жесту пользователя — вызывается при уходе титула. */
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  function toggle() {
    muted = !muted;
    try { localStorage.setItem('ag_muted', muted ? '1' : '0'); } catch (e) { /* приватный режим */ }
    if (!muted) { unlock(); S.place(); }
    return muted;
  }

  return Object.assign({}, S, { unlock, toggle, get muted() { return muted; } });
})();
