/* Яндекс.Метрика: считаем ДОХОДИМОСТЬ, а не усвоение.

   Разделение принципиальное и взято из премортема (07-risks/strategic.md):
   «аналитику обучения» проект сознательно отверг, потому что на малой выборке
   она создаёт иллюзию замера; «счётчик открытий и завершений» — оставил.
   Здесь только второе. Выводов об усвоении по этим цифрам не делать: финальная
   проверка завышает результат по transfer-appropriate processing.

   Игра — canvas, поэтому Вебвизор и карта кликов видят только DOM-оверлеи
   (карточка термина, викторина, финал, заглушка). Вся ценность — в событиях. */
window.AG = window.AG || {};

AG.METRICS = (function () {
  // ← номер счётчика Яндекс.Метрики. null = аналитика выключена целиком.
  const COUNTER = 112091538;

  // Свои прогоны не должны топить статистику при выборке в два десятка человек.
  const isLocal = location.protocol === 'file:' ||
    /^(localhost|127\.|0\.0\.0\.0|\[::1\]|.*\.local)$/.test(location.hostname);
  const on = !!COUNTER && !isLocal;

  const log = [];                       // след для самопроверки, не уходит наружу
  const t0 = Date.now();
  const since = () => Math.round((Date.now() - t0) / 1000);

  if (on) {
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      for (let j = 0; j < e.scripts.length; j++) if (e.scripts[j].src === r) return;
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

    window.ym(COUNTER, 'init', {
      webvisor: true,               // полезен только на DOM-оверлеях, см. шапку
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      defer: false
    });
  }

  /** Цель Метрики. sec — секунды от загрузки, чтобы видеть, где именно теряем. */
  function goal(name, params) {
    const p = Object.assign({ sec: since() }, params || {});
    log.push([name, p]);
    if (on) {
      try { window.ym(COUNTER, 'reachGoal', name, p); } catch (e) { /* аналитика не должна ронять игру */ }
    }
    if (AG.METRICS_DEBUG) console.log('[goal]', name, p);
  }

  return {
    goal,
    get enabled() { return on; },
    get counter() { return COUNTER; },
    get log() { return log.slice(); }
  };
})();
