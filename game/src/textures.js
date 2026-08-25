/* Процедурные текстуры: всё рисуется на canvas при загрузке — внешних ассетов нет.

   Два слоя по решению об арт-направлении:
   — МИР (тайлы, персонаж, город, небо, мелочь) — пиксель-арт: рисуется в низком
     разрешении и увеличивается без сглаживания через AG.pixelCanvas;
   — ЭЛЕМЕНТЫ (фрагменты, слоты, собранные формы) — остаются вектором. На мелкой
     сетке двутавр и швеллер сливаются, а это ровно то различие, которое игра
     должна вбить (решение №14, принцип silhouette-legibility). */
window.AG = window.AG || {};

AG.TEXTURES = {
  build(scene) {
    const P = AG.PALETTE;

    // --- тайлсет 2x1: поверхность и глубина грунта ---
    // Второй тайл превращает глухую массу под ногами в разрез: игрок идёт
    // по поверхности, ниже читается основание, а не пустая тёмная заливка.
    {
      scene.textures.addCanvas('tiles', AG.pixelCanvas(32, 16, 2, (g, px) => {
        // кадр 0 (x 0..15) — поверхность
        px('#262626', 0, 0, 16, 16);
        px('#4a4a55', 0, 0, 16, 1);              // освещённая кромка
        px('#3a3a42', 0, 1, 16, 1);
        px('#16161a', 0, 3, 16, 1);              // тень под кромкой
        px('#2e2e36', 2, 6, 4, 1); px('#2e2e36', 9, 6, 5, 1);
        px('#1d1d22', 6, 9, 5, 1); px('#2e2e36', 12, 12, 3, 1);
        px('#1d1d22', 1, 13, 4, 1);

        // кадр 1 (x 16..31) — глубина: слоистое основание
        px('#1c1c21', 16, 0, 16, 16);
        px('#24242b', 16, 2, 16, 1);             // слои породы
        px('#161619', 16, 7, 16, 1);
        px('#24242b', 16, 11, 16, 1);
        px('#2b2b34', 18, 4, 3, 2);              // включения
        px('#2b2b34', 25, 8, 4, 2);
        px('#131316', 20, 13, 5, 2);
        px('#2b2b34', 29, 1, 2, 2);
      }));
    }

    // --- игрок: пиксельный строитель 20x28 -> 40x56, четыре позы ---
    {
      const ink = '#262626', dark = '#16161a', skin = '#f0c8a0', skinSh = '#d9a97e',
            coat = '#ffffff', coatSh = '#d6d6da', pack = '#f74c2e', packSh = '#bf3a20',
            hat = '#f28d05', hatHi = '#ffc16c';

      const body = (px) => {
        px(hat, 6, 2, 8, 1);                     // каска
        px(hat, 5, 3, 10, 2);
        px(hatHi, 6, 2, 4, 1); px(hatHi, 5, 3, 3, 1);
        px(hat, 4, 5, 12, 1);                    // козырёк
        px(dark, 4, 6, 12, 1);
        px(skin, 7, 7, 6, 3);                    // голова
        px(skinSh, 7, 9, 6, 1);
        px(ink, 11, 7, 1, 1);                    // глаз
        px(skin, 9, 10, 3, 1);                   // шея
        px(pack, 3, 12, 3, 6);                   // рюкзак
        px(packSh, 3, 16, 3, 2);
        px(coat, 6, 11, 8, 8);                   // куртка
        px(coatSh, 6, 11, 1, 8);
        px(ink, 10, 12, 1, 6);                   // молния
        px(dark, 6, 19, 8, 1);
      };

      const poses = {
        idle: (px) => {
          px(ink, 4, 13, 2, 5); px(ink, 14, 13, 2, 5);
          px(ink, 7, 20, 3, 5); px(ink, 11, 20, 3, 5);
          px(dark, 6, 25, 4, 2); px(dark, 11, 25, 4, 2);
        },
        run1: (px) => {
          px(ink, 3, 12, 2, 4); px(ink, 15, 15, 2, 4);
          px(ink, 7, 20, 3, 3); px(ink, 5, 23, 3, 2);
          px(ink, 11, 20, 3, 4); px(ink, 13, 24, 3, 2);
          px(dark, 4, 25, 4, 2); px(dark, 13, 26, 4, 2);
        },
        run2: (px) => {
          px(ink, 3, 15, 2, 4); px(ink, 15, 12, 2, 4);
          px(ink, 7, 20, 3, 4); px(ink, 5, 24, 3, 2);
          px(ink, 11, 20, 3, 3); px(ink, 13, 23, 3, 2);
          px(dark, 4, 26, 4, 2); px(dark, 13, 25, 4, 2);
        },
        jump: (px) => {
          px(ink, 3, 10, 2, 4); px(ink, 15, 10, 2, 4);
          px(ink, 7, 20, 3, 3); px(ink, 11, 20, 3, 3);
          px(ink, 6, 23, 4, 2); px(ink, 12, 23, 4, 2);
          px(dark, 5, 25, 4, 2); px(dark, 12, 25, 4, 2);
        }
      };

      for (const pose of ['idle', 'run1', 'run2', 'jump']) {
        scene.textures.addCanvas('guy_' + pose, AG.pixelCanvas(20, 28, 2, (g, px) => {
          body(px); poses[pose](px);
        }));
      }
    }

    // --- пиксельный город: три слоя параллакса, день + ночные окна ---
    {
      let seed = 20260826;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

      // W,H — итоговый размер; рисуем вдвое мельче и увеличиваем без сглаживания
      const makeLayer = (key, W, H, o) => {
        const w = W >> 1, h = H >> 1;
        const builds = [];
        let x = -6;
        while (x < w - 16) {
          const bw = o.wMin + Math.floor(rnd() * (o.wMax - o.wMin));
          const bh = o.hMin + Math.floor(rnd() * (o.hMax - o.hMin));
          const b = { x: x, w: bw, h: bh, kind: rnd(), crane: rnd() < o.craneChance, wins: [] };
          // окна считаем один раз, чтобы день и ночь совпали пиксель в пиксель
          const top = h - bh;
          for (let wy = top + 3; wy < h - 3; wy += o.winStep) {
            for (let wx = b.x + 2; wx + o.winW < b.x + bw - 1; wx += o.winStep) {
              const r = rnd();
              b.wins.push({ x: wx, y: wy, lit: r < 0.42, warm: r < 0.34 });
            }
          }
          builds.push(b);
          x += bw + 3 + Math.floor(rnd() * o.gapMax);
        }

        const day = AG.pixelCanvas(w, h, 2, (g, px) => {
          for (const b of builds) {
            const top = h - b.h;
            px(o.color, b.x, top, b.w, b.h);
            if (b.kind < 0.28) {                              // ступенчатый аттик
              px(o.color, b.x + 1, top - 2, b.w - 2, 2);
              px(o.color, b.x + 3, top - 4, Math.max(2, b.w - 6), 2);
            } else if (b.kind < 0.46) {                       // антенна
              px(o.color, b.x + (b.w >> 1), top - 9, 1, 9);
              px(o.color, b.x + (b.w >> 1) - 2, top - 7, 5, 1);
            } else if (b.kind < 0.62) {                       // водонапорная башня
              px(o.color, b.x + (b.w >> 1) - 3, top - 6, 7, 4);
              px(o.color, b.x + (b.w >> 1) - 1, top - 2, 2, 2);
            } else {                                          // парапет
              px(o.color, b.x - 1, top - 2, b.w + 2, 2);
            }
            if (b.crane && b.w > 26) {                        // башенный кран
              const cx = b.x + b.w + 5;
              px(o.color, cx, top - 22, 2, b.h + 22);
              px(o.color, cx - 13, top - 22, 28, 2);
              px(o.color, cx - 7, top - 24, 2, 2);
              px(o.color, cx - 13, top - 20, 1, 9);
              px(o.color, cx - 15, top - 11, 4, 2);
            }
            for (const wn of b.wins) px(o.winDay, wn.x, wn.y, o.winW, o.winH);
          }
        });

        const lights = AG.pixelCanvas(w, h, 2, (g, px) => {
          for (const b of builds) {
            for (const wn of b.wins) {
              if (wn.lit) px(wn.warm ? '#ffc16c' : '#d0e97e', wn.x, wn.y, o.winW, o.winH);
            }
          }
        });

        scene.textures.addCanvas(key, day);
        scene.textures.addCanvas(key + '_lights', lights);
      };

      makeLayer('city_far', 2048, 300, {
        wMin: 22, wMax: 48, hMin: 45, hMax: 105, gapMax: 5, craneChance: 0.1,
        color: '#d9d6cf', winDay: '#cfccc4', winW: 2, winH: 3, winStep: 6
      });
      makeLayer('city_mid', 2048, 360, {
        wMin: 32, wMax: 70, hMin: 70, hMax: 160, gapMax: 9, craneChance: 0.2,
        color: '#c9c4b9', winDay: '#bcb7ac', winW: 3, winH: 4, winStep: 8
      });
      makeLayer('city_near', 2048, 430, {
        wMin: 48, wMax: 90, hMin: 100, hMax: 200, gapMax: 14, craneChance: 0.28,
        color: '#b5afa2', winDay: '#a7a195', winW: 4, winH: 5, winStep: 11
      });
    }

    // --- звёзды и светило: пиксельные ---
    {
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

      scene.textures.addCanvas('stars', AG.pixelCanvas(256, 150, 2, (g, px) => {
        for (let i = 0; i < 110; i++) {
          const x = Math.floor(rnd() * 256), y = Math.floor(rnd() * 150), r = rnd();
          px(r < 0.55 ? '#8f97ad' : (r < 0.9 ? '#c9d1e4' : '#ffffff'), x, y, 1, 1);
          if (r > 0.94) { px('#ffffff', x + 1, y, 1, 1); px('#ffffff', x, y + 1, 1, 1); }
        }
      }));

      // светило: пиксельный круг в поле 18x18, увеличение x4
      scene.textures.addCanvas('sunmoon', AG.pixelCanvas(18, 18, 4, (g, px) => {
        const cx = 9, cy = 9, r = 8;
        for (let y = 0; y < 18; y++) {
          let run = 0;
          for (let x = 0; x < 18; x++) {
            const dx = x - cx + 0.5, dy = y - cy + 0.5;
            if (dx * dx + dy * dy <= r * r) run++;
          }
          if (run) px('#ffffff', cx - (run >> 1), y, run, 1);
        }
      }));
    }

    // --- чертёжная сетка (фон) ---
    {
      scene.textures.addCanvas('grid', AG.pixelCanvas(64, 64, 2, (g, px) => {
        const line = 'rgba(38,38,38,0.07)';
        for (let i = 0; i < 64; i += 16) { px(line, i, 0, 1, 64); px(line, 0, i, 64, 1); }
      }));
    }

    // --- кольцо подсветки пикапа: пиксельный пунктир по окружности ---
    {
      scene.textures.addCanvas('ring', AG.pixelCanvas(16, 16, 4, (g, px) => {
        const o = P.orange;
        const dots = [[6, 1], [9, 1], [3, 3], [12, 3], [1, 6], [1, 9],
                      [3, 12], [12, 12], [6, 14], [9, 14], [14, 6], [14, 9]];
        for (const d of dots) px(o, d[0], d[1], 1, 1);
      }));
    }

    // --- логотип «АРХИСБОР»: пиксельные литеры со сколами ---
    // Битмап-шрифт только под нужные восемь литер, ячейка 7x9.
    {
      const F = {
        'А': ['..###..', '.##.##.', '##...##', '##...##', '#######', '##...##', '##...##', '##...##', '##...##'],
        'Р': ['######.', '##...##', '##...##', '##...##', '######.', '##.....', '##.....', '##.....', '##.....'],
        'Х': ['##...##', '##...##', '.##.##.', '.##.##.', '..###..', '.##.##.', '.##.##.', '##...##', '##...##'],
        'И': ['##...##', '##...##', '##..###', '##.####', '##.#.##', '####.##', '###..##', '##...##', '##...##'],
        'С': ['.#####.', '##...##', '##.....', '##.....', '##.....', '##.....', '##.....', '##...##', '.#####.'],
        'Б': ['#######', '##.....', '##.....', '##.....', '######.', '##...##', '##...##', '##...##', '######.'],
        'О': ['.#####.', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.']
      };
      const word = 'АРХИСБОР';
      const GW = 7, GH = 9, GAP = 1, PAD = 2, SH = 2;      // всё в ячейках
      const cols = word.length * GW + (word.length - 1) * GAP;
      const LW = cols + PAD * 2 + SH, LH = GH + PAD * 2 + SH;

      const fill = new Set();
      word.split('').forEach((ch, i) => {
        const rows = F[ch];
        const ox = PAD + i * (GW + GAP);
        rows.forEach((row, r) => {
          for (let c = 0; c < GW; c++) if (row[c] === '#') fill.add((PAD + r) * LW + ox + c);
        });
      });
      const has = (x, y) => x >= 0 && y >= 0 && x < LW && y < LH && fill.has(y * LW + x);

      scene.textures.addCanvas('logo', AG.pixelCanvas(LW, LH, 8, (g, px) => {
        const ink = '#262626', shadow = '#16161a', face = '#f2f2f2';
        for (const k of fill) px(shadow, (k % LW) + SH, ((k / LW) | 0) + SH);   // тень
        for (const k of fill) {                                                 // контур
          const x = k % LW, y = (k / LW) | 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) if (!has(x + dx, y + dy)) px(ink, x + dx, y + dy);
        }
        for (const k of fill) px(face, k % LW, (k / LW) | 0);                   // лицевая плоскость

        // сколы: только по углам литер, выщербиной внутрь — детерминированные,
        // чтобы логотип не «дышал» между перезагрузками
        let seed = 4242;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const corners = [...fill].filter(k => {
          const x = k % LW, y = (k / LW) | 0;
          const hx = !has(x - 1, y) || !has(x + 1, y);
          const hy = !has(x, y - 1) || !has(x, y + 1);
          return hx && hy;
        });
        const used = new Set();
        for (let i = 0, guard = 0; i < 11 && guard < 200; guard++) {
          const k = corners[Math.floor(rnd() * corners.length)];
          if (used.has(k)) continue;
          used.add(k); i++;
          const x = k % LW, y = (k / LW) | 0;
          const dx = has(x - 1, y) ? -1 : 1, dy = has(x, y - 1) ? -1 : 1;
          px(P.orange, x, y);                                  // выломанный угол
          if (has(x + dx, y)) px(P.orange, x + dx, y);
          if (has(x, y + dy)) px(ink, x, y + dy);              // тёмная зазубрина внутрь
        }
      }));
    }

    // ======================= ВЕКТОРНЫЙ СЛОЙ =======================
    // Ниже — архитектурные элементы. Здесь пикселизация запрещена: читаемость
    // силуэта важнее фирменности и важнее единства арт-стиля.

    // --- фрагменты и собранные элементы ---
    for (const el of AG.CONTENT.elements) {
      const { w, h } = el.view;
      const pad = 6, tw = w + pad * 2, th = h + pad * 2;

      // целая форма — чернильная
      {
        const c = document.createElement('canvas'); c.width = tw; c.height = th;
        const g = c.getContext('2d');
        for (const p of el.pieces) AG.fillLoops(g, p.loops, 1, pad, pad, null, P.ink, 3);
        for (const p of el.pieces) AG.fillLoops(g, p.loops, 1, pad, pad, P.ink, null);
        scene.textures.addCanvas('full_' + el.id, c);
      }

      // каждый фрагмент: терракотовый (для подбора) + чернильный (для сборки)
      for (const p of el.pieces) {
        for (const variant of ['acc', 'ink']) {
          const key = 'frag_' + el.id + '_' + p.id + '_' + variant;
          const c = document.createElement('canvas'); c.width = tw; c.height = th;
          const g = c.getContext('2d');
          const fill = variant === 'acc' ? P.accent : P.ink;
          AG.fillLoops(g, p.loops, 1, pad, pad, fill, variant === 'acc' ? P.ink : null, 2.5);
          scene.textures.addCanvas(key, c);
        }
        // призрачный слот
        {
          const c = document.createElement('canvas'); c.width = tw; c.height = th;
          const g = c.getContext('2d');
          AG.traceLoops(g, p.loops, 1, pad, pad);
          g.fillStyle = 'rgba(38,38,38,0.07)'; g.fill();
          g.setLineDash([5, 5]);
          g.strokeStyle = 'rgba(38,38,38,0.38)'; g.lineWidth = 2; g.stroke();
          scene.textures.addCanvas('slot_' + el.id + '_' + p.id, c);
        }
      }
    }

    // --- доска сборки: пиксельная карточка на ножках ---
    {
      scene.textures.addCanvas('board', AG.pixelCanvas(48, 60, 2, (g, px) => {
        const ink = '#262626';
        px(ink, 2, 2, 44, 40);
        px('#ffffff', 4, 4, 40, 36);
        px('#e9e9e9', 4, 34, 40, 6);
        px(ink, 9, 42, 3, 14); px(ink, 36, 42, 3, 14);   // ножки
        px(ink, 12, 50, 24, 3);                          // перекладина
        px(P.orange, 8, 8, 32, 3);                       // фирменная полоса
      }));
    }
  }
};
