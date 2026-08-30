/* DOM-оверлеи поверх канваса: гейт для мобильных, тосты, карточки термина,
   пауза, викторина узнавания, финальный экран.
   Стиль — фирменный: AdvakenSans капс в заголовках, Inter Tight в тексте,
   машинные метки [ ... ], лестница из квадратов, синие CTA-пилюли. */
window.AG = window.AG || {};

AG.UI = (() => {
  const P = AG.PALETTE;
  let toastBudget = 2;            // скоуп п.18: максимум два тоста за сеанс
  const shownOnce = new Set();
  let activeToast = null;
  let overlayRoot = null;
  let chipEl = null;

  function root() {
    if (!overlayRoot) overlayRoot = document.getElementById('overlay');
    return overlayRoot;
  }

  const stairs = (dark) => '<span class="stairs' + (dark ? ' on-dark' : '') + '"><i></i><i></i><i></i></span>';

  // ---------- правовые документы школы ----------
  const LEGAL = {
    policy: 'https://disk.yandex.ru/d/lHjasPcdcpl3jg',
    offer:  'https://disk.yandex.ru/i/aRbWWJK2A8EQig'
  };

  function legalLinks(onDark) {
    const col = onDark ? 'rgba(255,255,255,.62)' : 'inherit';
    const a = (href, text) => '<a href="' + href + '" target="_blank" rel="noopener noreferrer"' +
      ' style="color:' + col + '">' + text + '</a>';
    return a(LEGAL.policy, 'политика обработки данных') + ' · ' + a(LEGAL.offer, 'публичная оферта');
  }

  // Уведомление о сборе: показывается на титуле, до начала игры.
  let legalEl = null;
  function showLegal() {
    if (!legalEl) {
      legalEl = document.createElement('div');
      legalEl.className = 'legal';
      legalEl.innerHTML =
        '<span class="tag">данные</span>' +
        '<span>Игра использует Яндекс.Метрику: сохраняются файлы cookie и IP-адрес — ' +
        'только для статистики посещений. Имя, телефон и почта не собираются.<br>' +
        legalLinks(false) + '</span>';
      root().appendChild(legalEl);
    }
    legalEl.style.opacity = '1';
  }
  function hideLegal() { if (legalEl) legalEl.style.opacity = '0'; }

  // машинный чип-счётчик фрагментов (левый верхний угол)
  function hudChip() {
    if (!chipEl) {
      chipEl = document.createElement('div');
      chipEl.style.cssText = 'position:absolute;top:20px;left:24px;pointer-events:none;';
      root().appendChild(chipEl);
    }
    return chipEl;
  }

  function setChip(text) {
    const el = hudChip();
    el.innerHTML = '<span class="tag" style="background:var(--c-dark);color:var(--c-white);' +
      'border-radius:var(--r-pill-sm);padding:8px 15px;box-shadow:var(--shadow-soft)">' +
      text + '</span>';
  }

  function hideChip() { if (chipEl) chipEl.innerHTML = ''; }

  // ---------- мобильный гейт ----------
  function mobileGate() {
    const el = document.createElement('div');
    el.className = 'gate';
    el.innerHTML =
      '<div class="gate-photo"></div>' +
      '<div class="gate-card">' +
      '<div class="gate-mark"></div>' +
      '<span class="tag tag--ondark">форма раньше слова</span>' +
      '<h1 class="display">Платформер <span class="accent">архитектурных</span> терминов</h1>' +
      '<p class="gate-note">Игра живёт на компьютере: точный прыжок требует клавиатуры.</p>' +
      '<p class="gate-big">Открой ссылку на компьютере</p>' +
      '<div class="gate-actions">' +
      '<button id="copyLink" class="btn btn-blue">Скопировать ссылку</button>' +
      '<a id="mailLink" class="btn btn-ghost" href="mailto:?subject=' +
      encodeURIComponent('Ссылка на игру') + '&body=' +
      encodeURIComponent('Открой на компьютере: ') + '">Отправить себе письмом</a>' +
      '</div>' +
      '<p class="legal-mini" style="margin-top:18px;color:var(--on-dark-faint)">' +
      legalLinks(true) + '</p>' +
      '</div>';
    root().appendChild(el);
    el.querySelector('#copyLink').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        el.querySelector('#copyLink').textContent = 'Ссылка скопирована';
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = location.href;
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
        el.querySelector('#copyLink').textContent = 'Ссылка скопирована';
      }
    });
    return el;
  }

  // ---------- тосты ----------
  function anyKeyCloses() {
    const close = () => { if (activeToast) dismissToast(); };
    window.addEventListener('keydown', close, { passive: true });
  }

  function dismissToast() {
    if (!activeToast) return;
    const t = activeToast; activeToast = null;
    t.el.classList.remove('show');
    setTimeout(() => t.el.remove(), 300);
  }

  function toast(id, text) {
    if (toastBudget <= 0 || shownOnce.has(id) || activeToast) return null;
    toastBudget--; shownOnce.add(id);
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="tag">' + (toastBudget === 1 ? 'управление' : 'панель') + '</span>' +
      '<span>' + text + '</span><button aria-label="Закрыть">×</button>';
    root().appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const rec = { el };
    activeToast = rec;
    el.querySelector('button').addEventListener('click', dismissToast);
    rec.timer = setTimeout(dismissToast, 5200);
    return rec;
  }

  // ---------- индикатор звука ----------
  let muteEl = null, muteTimer = null;
  function muteToast(isMuted) {
    if (!muteEl) {
      muteEl = document.createElement('div');
      muteEl.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);' +
        'pointer-events:none;transition:opacity .25s var(--ease);opacity:0;';
      root().appendChild(muteEl);
    }
    muteEl.innerHTML = '<span class="tag" style="background:var(--c-dark);color:var(--c-white);' +
      'border-radius:var(--r-pill-sm);padding:8px 15px">звук :: ' +
      (isMuted ? 'выкл' : 'вкл') + '</span>';
    muteEl.style.opacity = '1';
    clearTimeout(muteTimer);
    muteTimer = setTimeout(() => { muteEl.style.opacity = '0'; }, 1100);
  }

  // ---------- карточка термина ----------
  function termCard(el_, svgFull, onDone, zoneIdx) {
    const card = document.createElement('div');
    card.className = 'termcard-wrap';
    // одно слово заголовка — акцентное
    const words = el_.name.toUpperCase().split(' ');
    words[words.length - 1] = '<span class="accent">' + words[words.length - 1] + '</span>';
    card.innerHTML =
      '<div class="card termcard">' +
      '<span class="tag">сборка :: 0' + (zoneIdx + 1) + '</span>' +
      '<div class="termcard-art">' + svgFull + '</div>' +
      '<h2 class="display">' + words.join(' ') + '</h2>' +
      '<p>' + el_.definition + '</p>' +
      '<button class="btn btn-blue">Дальше</button>' +
      '</div>';
    root().appendChild(card);
    requestAnimationFrame(() => card.classList.add('show'));
    const opened = Date.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      AG.METRICS.goal('term_read_' + (zoneIdx + 1),
        { read: Math.round((Date.now() - opened) / 1000) });
      card.classList.remove('show');
      setTimeout(() => card.remove(), 350);
      onDone();
    };
    card.querySelector('button').addEventListener('click', finish);
    return finish;
  }

  // ---------- пауза ----------
  let pauseEl = null;
  function togglePause(onToggle) {
    if (pauseEl) {
      pauseEl.remove(); pauseEl = null;
      onToggle(false);
      return false;
    }
    pauseEl = document.createElement('div');
    pauseEl.className = 'pause';
    pauseEl.innerHTML =
      '<div class="card pause-card">' +
      '<span class="tag">пауза</span>' +
      '<h2 class="display">Пауза</h2>' +
      '<dl class="controls">' +
      '<dt>A / D или стрелки</dt><dd>идти</dd>' +
      '<dt>Пробел</dt><dd>прыжок</dd>' +
      '<dt>Esc</dt><dd>пауза</dd>' +
      '<dt>M</dt><dd>звук вкл/выкл</dd>' +
      '</dl>' +
      '<button class="btn btn-blue">Продолжить</button>' +
      '</div>';
    root().appendChild(pauseEl);
    const resume = () => togglePause(onToggle);
    pauseEl.querySelector('button').addEventListener('click', resume);
    onToggle(true);
    return true;
  }

  // ---------- викторина узнавания ----------
  // Вопрос называет термин, игрок выбирает форму (скоуп п.9)
  function quiz(elements, onFinish, results) {
    const wrap = document.createElement('div');
    wrap.className = 'quiz';
    root().appendChild(wrap);
    const state = { i: 0 };
    results = results || [];

    function askNext() {
      if (state.i >= elements.length) {
        wrap.remove();
        onFinish(results);
        return;
      }
      const target = elements[state.i];
      const opts = shuffle(target.quiz.options.map(id => silhouetteOf(id)));
      const words = target.quiz.question.replace('Какой из них — ', '').replace('?', '')
        .toUpperCase().split(' ');
      const term = words.join(' ');

      wrap.innerHTML =
        '<div class="card quiz-card">' +
        '<div class="quiz-head"><span class="idx">0' + (state.i + 1) + ' / 03</span>' +
        '<span class="tag" style="color:var(--on-light-dim)">проверка</span></div>' +
        '<h2 class="display">Какой из них — <span class="accent">' + term + '</span>?</h2>' +
        '<div class="quiz-opts"></div>' +
        '<p class="quiz-hint">Ошибка ничего не блокирует — покажем правильный ответ.</p>' +
        '</div>';
      const box = wrap.querySelector('.quiz-opts');

      for (const opt of opts) {
        const b = document.createElement('button');
        b.className = 'quiz-opt';
        b.innerHTML = AG.loopsToSvg(opt.loops, opt.w, opt.h, '#f7f7f7', '#262626', 3);
        b.addEventListener('click', () => {
          const correct = opt.id === target.id;
          results.push({ id: target.id, picked: opt.id, correct });
          AG.METRICS.goal('quiz_answer', { term: target.id, ok: correct ? 1 : 0 });
          (correct ? AG.SFX.right : AG.SFX.wrong)();
          if (correct) {
            b.classList.add('is-right');
            setTimeout(askNext, 650);
          } else {
            b.classList.add('is-wrong');
            box.querySelectorAll('.quiz-opt').forEach(o => {
              if (o.dataset.optid === target.id) o.classList.add('is-right');
              o.disabled = true;
            });
            setTimeout(askNext, 1400);
          }
        });
        b.dataset.optid = opt.id;
        box.appendChild(b);
      }
      state.i++;
    }
    askNext();
  }

  // Равномерная тасовка (Фишер–Йейтс). sort со случайным компаратором
  // даёт смещение, а от равномерности здесь зависит честность замера.
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // возвращает силуэт по id элемента или дистрактора
  function silhouetteOf(id) {
    const el = AG.CONTENT.elements.find(e => e.id === id);
    if (el) {
      return { id, loops: el.pieces.flatMap(p => p.loops), w: el.view.w, h: el.view.h, correct: true };
    }
    const ex = AG.CONTENT.extraSilhouettes[id];
    return { id, loops: ex.loops, w: ex.view.w, h: ex.view.h, correct: false };
  }

  // ---------- финальный экран (тёмная секция) ----------
  function endScreen(elements, results) {
    const right = results.filter(r => r.correct).length;
    AG.METRICS.goal('finish', { right: right });
    AG.SFX.finish();
    const wrap = document.createElement('div');
    wrap.className = 'end';
    wrap.innerHTML =
      '<div class="end-card">' +
      stairs(true) +
      '<h1 class="display">Готово<span class="accent">.</span></h1>' +
      '<div class="end-row">' +
      elements.map(e =>
        '<figure>' + AG.loopsToSvg(silhouetteOf(e.id).loops, e.view.w, e.view.h, '#ffffff', '#262626', 2) +
        '<figcaption>' + e.name + '</figcaption></figure>').join('') +
      '</div>' +
      '<p class="end-note">Узнано с первого раза: <b>' + right + ' из ' + results.length +
      '</b>. Три слова остались привязаны к трём формам.</p>' +
      '<button class="btn btn-ghost">Играть снова</button>' +
      '<p class="legal-mini" style="margin-top:26px;color:var(--on-dark-faint)">' +
      legalLinks(true) + '</p>' +
      '</div>';
    root().appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    wrap.querySelector('button').addEventListener('click', () => {
      AG.METRICS.goal('replay');
      setTimeout(() => location.reload(), 150);
    });
  }

  return { mobileGate, toast, dismissToast, termCard, togglePause, quiz, endScreen,
           anyKeyCloses, setChip, hideChip, muteToast, showLegal, hideLegal };
})();
