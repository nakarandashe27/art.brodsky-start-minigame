/* Процедурные текстуры: всё рисуется на canvas при загрузке — внешних ассетов нет.

   Два слоя по решению об арт-направлении:
   — МИР (тайлы, персонаж, фоны, мелочь) — пиксель-арт: рисуется в низком
     разрешении и увеличивается без сглаживания через AG.pixelCanvas;
   — ЭЛЕМЕНТЫ (фрагменты, слоты, собранные формы) — остаются вектором. На мелкой
     сетке двутавр и швеллер сливаются, а это ровно то различие, которое игра
     должна вбить (решение №14, принцип silhouette-legibility). */
window.AG = window.AG || {};

/* Порядок тем = порядок строк в тайлсете.
   Индекс тайла = theme * 48 + variant * 16 + маска, где variant 0..2.
   Три варианта на маску — против того, что грунт читается сплошной плитой:
   шестнадцати масок хватает на правильные кромки и углы, но внутренность
   массива при одном тайле на маску повторяется клетка в клетку. */
AG.THEMES = ['city', 'green', 'street', 'ruin', 'district'];
AG.TILE_VARIANTS = 3;
AG.TILES_PER_THEME = 16 * AG.TILE_VARIANTS;

AG.TEXTURES = {
  build(scene) {
    const P = AG.PALETTE;

    this.buildTiles(scene);
    this.buildPlayer(scene);
    this.buildBackdrops(scene);
    this.buildChrome(scene, P);
    this.buildElements(scene, P);
  },

  /* --------------------------------------------------------------- ГРУНТ
     Автотайлинг по битовой маске соседей: 1=сверху, 2=справа, 4=снизу, 8=слева.
     Шестнадцать вариантов на тему вместо двух тайлов на всю игру — открытые
     грани получают кромку и тень, закрытые уходят в массив. Раньше грунт читался
     сплошной плитой, и это была самая заметная визуальная дыра. */
  buildTiles(scene) {
    const TH = {
      city:     { top: '#4a4a55', lip: '#3a3a42', body: '#262626', deep: '#1c1c21', spec: '#2e2e36', dark: '#131316' },
      green:    { top: '#8fbf4e', lip: '#6d9a38', body: '#5b452f', deep: '#41301f', spec: '#6d543a', dark: '#2e2216' },
      street:   { top: '#9a9aa2', lip: '#7c7c85', body: '#6a6a72', deep: '#4e4e56', spec: '#83838c', dark: '#3a3a41' },
      ruin:     { top: '#a89078', lip: '#8a705a', body: '#7a614c', deep: '#544133', spec: '#8d735c', dark: '#3d2f24' },
      district: { top: '#dcd7ca', lip: '#bdb7a8', body: '#a9a294', deep: '#8b8577', spec: '#b6afa0', dark: '#6f695c' }
    };
    const C = 16;                      // ячейка в низком разрешении
    const V = AG.TILE_VARIANTS;
    const W = C * 16 * V, H = C * AG.THEMES.length;

    scene.textures.addCanvas('tiles', AG.pixelCanvas(W, H, 2, (g, px) => {
      AG.THEMES.forEach((name, row) => {
        const t = TH[name];
        let seed = 1000 + row * 77;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

        for (let k = 0; k < 16 * V; k++) {
          const variant = (k / 16) | 0, mask = k % 16;
          const ox = k * C, oy = row * C;
          const N = mask & 1, E = mask & 2, S = mask & 4, Wl = mask & 8;
          const p = (col, x, y, w, h) => px(col, ox + x, oy + y, w, h);

          // тело: под грунтом темнее, у поверхности светлее
          p(N ? t.deep : t.body, 0, 0, C, C);

          // включения — детерминированные, чтобы тайл не «дышал»;
          // число и положение зависят от варианта, поэтому соседние клетки
          // массива больше не совпадают рисунком
          for (let i = 0; i < 3 + variant; i++) {
            const x = 1 + Math.floor(rnd() * (C - 4)), y = 4 + Math.floor(rnd() * (C - 6));
            p(rnd() < 0.5 ? t.spec : t.dark, x, y, 1 + Math.floor(rnd() * (3 + variant)), 1);
          }
          if (variant === 1) p(t.spec, 0, 9 + (row % 3), C, 1);      // прослойка
          if (variant === 2) {                                        // крупное включение
            const bx = 2 + Math.floor(rnd() * 9), by = 6 + Math.floor(rnd() * 6);
            p(t.dark, bx, by, 3, 2); p(t.spec, bx, by, 2, 1);
          }

          if (!N) {                                   // открытая поверхность
            p(t.top, 0, 0, C, 1);
            p(t.lip, 0, 1, C, 1);
            p(t.dark, 0, 3, C, 1);
            if (name === 'green') {                   // трава свешивается вниз
              for (let x = 0; x < C; x += 3) p(t.top, x, 2, 1, 1 + Math.floor(rnd() * 3));
            }
            if (name === 'street') { p(t.lip, 5, 0, 1, 3); p(t.lip, 11, 0, 1, 3); } // швы плит
            if (name === 'ruin') { p(t.dark, 3, 0, 2, 2); p(t.dark, 10, 1, 3, 1); } // сколы
          }
          if (!Wl) { p(t.dark, 0, N ? 0 : 3, 1, C - (N ? 0 : 3)); p(t.lip, 1, N ? 0 : 4, 1, 2); }
          if (!E)  { p(t.dark, C - 1, N ? 0 : 3, 1, C - (N ? 0 : 3)); }
          if (!S)  { p(t.dark, 0, C - 1, C, 1); }

          // кирпичная разбивка руин и слоистость грунта
          if (name === 'ruin' && N) { const sh = variant * 3; p(t.dark, 0, (6 + sh) % C, C, 1); p(t.dark, (8 + sh * 5) % C, 0, 1, 6); p(t.dark, (4 + sh * 3) % C, 7, 1, 9); }
          if (name === 'green' && N && variant !== 1) { p(t.spec, 0, 7 + variant * 2, C, 1); }
          if (name === 'district' && !N) { p(t.lip, 0, 8, C, 1); }
        }
      });
    }));
  },

  /* ------------------------------------------------------------- ИГРОК
     Пиксельный строитель 20x28 -> 40x56. Шесть поз: стойка, четыре кадра бега,
     прыжок, скольжение по стене. */
  buildPlayer(scene) {
    const ink = '#262626', dark = '#16161a', skin = '#f0c8a0', skinSh = '#d9a97e',
          coat = '#ffffff', coatSh = '#d6d6da', pack = '#f74c2e', packSh = '#bf3a20',
          hat = '#f28d05', hatHi = '#ffc16c';

    const body = (px, lean) => {
      const d = lean || 0;
      px(hat, 6 + d, 2, 8, 1);
      px(hat, 5 + d, 3, 10, 2);
      px(hatHi, 6 + d, 2, 4, 1); px(hatHi, 5 + d, 3, 3, 1);
      px(hat, 4 + d, 5, 12, 1);
      px(dark, 4 + d, 6, 12, 1);
      px(skin, 7 + d, 7, 6, 3);
      px(skinSh, 7 + d, 9, 6, 1);
      px(ink, 11 + d, 7, 1, 1);
      px(skin, 9 + d, 10, 3, 1);
      px(pack, 3, 12, 3, 6);
      px(packSh, 3, 16, 3, 2);
      px(coat, 6, 11, 8, 8);
      px(coatSh, 6, 11, 1, 8);
      px(ink, 10, 12, 1, 6);
      px(dark, 6, 19, 8, 1);
    };

    // четырёхкадровый цикл бега: контакт — пролёт — контакт — пролёт
    const poses = {
      idle: (px) => {
        px(ink, 4, 13, 2, 5); px(ink, 14, 13, 2, 5);
        px(ink, 7, 20, 3, 5); px(ink, 11, 20, 3, 5);
        px(dark, 6, 25, 4, 2); px(dark, 11, 25, 4, 2);
      },
      run1: (px) => {                       // контакт: ноги разведены
        px(ink, 3, 12, 2, 4); px(ink, 15, 15, 2, 4);
        px(ink, 7, 20, 3, 3); px(ink, 5, 23, 3, 2);
        px(ink, 11, 20, 3, 4); px(ink, 13, 24, 3, 2);
        px(dark, 4, 25, 4, 2); px(dark, 13, 26, 4, 2);
      },
      run2: (px) => {                       // пролёт: обе ноги под корпусом
        px(ink, 4, 13, 2, 4); px(ink, 14, 13, 2, 4);
        px(ink, 8, 20, 3, 4); px(ink, 10, 20, 3, 5);
        px(dark, 7, 24, 4, 2); px(dark, 10, 25, 4, 2);
      },
      run3: (px) => {                       // контакт зеркально
        px(ink, 3, 15, 2, 4); px(ink, 15, 12, 2, 4);
        px(ink, 7, 20, 3, 4); px(ink, 5, 24, 3, 2);
        px(ink, 11, 20, 3, 3); px(ink, 13, 23, 3, 2);
        px(dark, 4, 26, 4, 2); px(dark, 13, 25, 4, 2);
      },
      run4: (px) => {                       // пролёт зеркально
        px(ink, 4, 12, 2, 4); px(ink, 14, 14, 2, 4);
        px(ink, 9, 20, 3, 5); px(ink, 11, 20, 3, 4);
        px(dark, 8, 25, 4, 2); px(dark, 11, 24, 4, 2);
      },
      jump: (px) => {
        px(ink, 3, 10, 2, 4); px(ink, 15, 10, 2, 4);
        px(ink, 7, 20, 3, 3); px(ink, 11, 20, 3, 3);
        px(ink, 6, 23, 4, 2); px(ink, 12, 23, 4, 2);
        px(dark, 5, 25, 4, 2); px(dark, 12, 25, 4, 2);
      },
      slide: (px) => {                      // прижат к стене: руки вверх, ноги согнуты
        px(ink, 14, 9, 2, 5); px(ink, 15, 14, 2, 3);
        px(ink, 4, 12, 2, 5);
        px(ink, 8, 20, 3, 4); px(ink, 12, 20, 3, 3);
        px(dark, 7, 24, 4, 2); px(dark, 12, 23, 4, 2);
      }
    };

    for (const pose of Object.keys(poses)) {
      scene.textures.addCanvas('guy_' + pose, AG.pixelCanvas(20, 28, 2, (g, px) => {
        body(px, pose === 'slide' ? 1 : 0); poses[pose](px);
      }));
    }
  },

  /* ---------------------------------------------------------------- ФОНЫ
     У каждого направления свой задник. Один генератор, пять правил силуэта:
     чтобы зона читалась с одного взгляда, различаться должна линия горизонта,
     а не только цвет. */
  buildBackdrops(scene) {
    let seed = 20260826;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    /* kind — правило силуэта; o — размеры и цвет.
       Возвращает две текстуры: дневную и «огни» (окна/фонари) поверх неё. */
    const makeLayer = (key, W, H, kind, o) => {
      const w = W >> 1, h = H >> 1;
      const shapes = [];
      let x = -8;

      while (x < w - 10) {
        const s = { x, kind: rnd(), wins: [] };
        if (kind === 'city') {
          s.w = o.wMin + Math.floor(rnd() * (o.wMax - o.wMin));
          s.h = o.hMin + Math.floor(rnd() * (o.hMax - o.hMin));
          s.crane = rnd() < (o.craneChance || 0);
          for (let wy = h - s.h + 3; wy < h - 3; wy += o.winStep)
            for (let wx = s.x + 2; wx + o.winW < s.x + s.w - 1; wx += o.winStep) {
              const r = rnd();
              s.wins.push({ x: wx, y: wy, lit: r < 0.42, warm: r < 0.34 });
            }
          x += s.w + 3 + Math.floor(rnd() * o.gapMax);
        } else if (kind === 'hills') {
          s.w = o.wMin + Math.floor(rnd() * (o.wMax - o.wMin));
          s.h = o.hMin + Math.floor(rnd() * (o.hMax - o.hMin));
          s.tree = rnd();
          x += Math.floor(s.w * 0.55);              // холмы наезжают друг на друга
        } else if (kind === 'street') {
          s.w = o.wMin + Math.floor(rnd() * (o.wMax - o.wMin));
          s.h = o.hMin + Math.floor(rnd() * (o.hMax - o.hMin));
          for (let wy = h - s.h + 4; wy < h - 10; wy += o.winStep)
            for (let wx = s.x + 3; wx + o.winW < s.x + s.w - 2; wx += o.winStep) {
              const r = rnd();
              s.wins.push({ x: wx, y: wy, lit: r < 0.55, warm: r < 0.5 });
            }
          x += s.w + 2 + Math.floor(rnd() * o.gapMax);
        } else if (kind === 'ruins') {
          s.w = o.wMin + Math.floor(rnd() * (o.wMax - o.wMin));
          s.h = o.hMin + Math.floor(rnd() * (o.hMax - o.hMin));
          s.teeth = [];                              // рваный верх
          for (let i = 0; i < s.w; i += 2) s.teeth.push(Math.floor(rnd() * 5));
          s.arch = rnd() < 0.45;
          x += s.w + 4 + Math.floor(rnd() * o.gapMax);
        } else {                                     // district: широкие низкие пласты
          s.w = o.wMin + Math.floor(rnd() * (o.wMax - o.wMin));
          s.h = o.hMin + Math.floor(rnd() * (o.hMax - o.hMin));
          s.dominant = rnd() < 0.14;                 // доминанта района
          if (s.dominant) s.h = o.hMax + 30 + Math.floor(rnd() * 26);
          for (let wy = h - s.h + 3; wy < h - 2; wy += o.winStep)
            for (let wx = s.x + 2; wx + o.winW < s.x + s.w - 1; wx += o.winStep) {
              const r = rnd();
              s.wins.push({ x: wx, y: wy, lit: r < 0.5, warm: r < 0.3 });
            }
          x += s.w + 2 + Math.floor(rnd() * o.gapMax);
        }
        shapes.push(s);
      }

      const drawBody = (px, ctx) => {
        for (const s of shapes) {
          const top = h - s.h;
          if (kind === 'hills') {
            // холм: ступенчатая парабола, ширина w, высота h
            for (let i = 0; i < s.w; i++) {
              const t = (i / s.w) * 2 - 1;
              const y = Math.round(h - s.h * (1 - t * t));
              px(o.color, s.x + i, y, 1, h - y);
            }
            if (s.tree < 0.5) {                       // дерево на гребне
              const tx = s.x + (s.w >> 1), ty = top + 2;
              px(o.trunk, tx, ty + 6, 2, 8);
              px(o.crown, tx - 4, ty - 4, 10, 8);
              px(o.crown, tx - 2, ty - 7, 6, 4);
              px(o.crown, tx - 5, ty + 2, 12, 4);
            }
            continue;
          }
          if (kind === 'ruins') {
            // рваный верх — разной высотой колонок, а не стиранием
            s.teeth.forEach((d, i) => px(o.color, s.x + i * 2, top + d, 2, s.h - d));
            if (s.arch && s.w > 16) {                 // провал арки: вырезаем насквозь
              const ax = s.x + (s.w >> 1) - 5;
              ctx.clearRect(ax, h - 18, 10, 18);
              for (let i = 0; i < 5; i++) ctx.clearRect(ax + i, h - 23 + i, 10 - i * 2, 5 - i);
            }
            continue;
          }
          px(o.color, s.x, top, s.w, s.h);
          if (kind === 'city') {
            if (s.kind < 0.28) { px(o.color, s.x + 1, top - 2, s.w - 2, 2); px(o.color, s.x + 3, top - 4, Math.max(2, s.w - 6), 2); }
            else if (s.kind < 0.46) { px(o.color, s.x + (s.w >> 1), top - 9, 1, 9); px(o.color, s.x + (s.w >> 1) - 2, top - 7, 5, 1); }
            else if (s.kind < 0.62) { px(o.color, s.x + (s.w >> 1) - 3, top - 6, 7, 4); px(o.color, s.x + (s.w >> 1) - 1, top - 2, 2, 2); }
            else px(o.color, s.x - 1, top - 2, s.w + 2, 2);
            if (s.crane && s.w > 26) {
              const cx = s.x + s.w + 5;
              px(o.color, cx, top - 22, 2, s.h + 22);
              px(o.color, cx - 13, top - 22, 28, 2);
              px(o.color, cx - 7, top - 24, 2, 2);
              px(o.color, cx - 13, top - 20, 1, 9);
              px(o.color, cx - 15, top - 11, 4, 2);
            }
          } else if (kind === 'street') {
            px(o.color, s.x - 1, top - 2, s.w + 2, 2);            // карниз
            px(o.dark || o.color, s.x + 2, h - 9, s.w - 4, 9);    // витрина в первом этаже
            px(o.color, s.x + (s.w >> 1) - 1, h - 9, 2, 9);
          } else if (kind === 'district') {
            if (s.dominant) { px(o.color, s.x + (s.w >> 1) - 1, top - 12, 3, 12); }
            else px(o.color, s.x, top - 1, s.w, 1);
          }
          for (const wn of s.wins) px(o.winDay, wn.x, wn.y, o.winW, o.winH);
        }
      };

      scene.textures.addCanvas(key, AG.pixelCanvas(w, h, 2, (g, px) => drawBody(px, g)));

      if (o.lights !== false) {
        scene.textures.addCanvas(key + '_lights', AG.pixelCanvas(w, h, 2, (g, px) => {
          for (const s of shapes)
            for (const wn of s.wins)
              if (wn.lit) px(wn.warm ? '#ffc16c' : '#d0e97e', wn.x, wn.y, o.winW, o.winH);
        }));
      }
    };

    // --- архитектура: город (существующие три слоя, не трогаем) ---
    makeLayer('bg_city_far', 2048, 300, 'city', {
      wMin: 22, wMax: 48, hMin: 45, hMax: 105, gapMax: 5, craneChance: 0.1,
      color: '#d9d6cf', winDay: '#cfccc4', winW: 2, winH: 3, winStep: 6
    });
    makeLayer('bg_city_mid', 2048, 360, 'city', {
      wMin: 32, wMax: 70, hMin: 70, hMax: 160, gapMax: 9, craneChance: 0.2,
      color: '#c9c4b9', winDay: '#bcb7ac', winW: 3, winH: 4, winStep: 8
    });
    makeLayer('bg_city_near', 2048, 430, 'city', {
      wMin: 48, wMax: 90, hMin: 100, hMax: 200, gapMax: 14, craneChance: 0.28,
      color: '#b5afa2', winDay: '#a7a195', winW: 4, winH: 5, winStep: 11
    });

    /* Высота полосы = высота текстуры (см. SETS в PlayScene): полоса короче
       текстуры показывала бы её верх, то есть пустое небо, а холмы оставались бы
       за кадром. Дальние слои выше ближних — иначе рельеф зоны их закрывает. */
    makeLayer('bg_green_far', 1536, 380, 'hills', {
      wMin: 90, wMax: 190, hMin: 90, hMax: 175, color: '#cbd9b4',
      trunk: '#b6bfa2', crown: '#bcd0a0', lights: false
    });
    makeLayer('bg_green_near', 1536, 300, 'hills', {
      wMin: 120, wMax: 260, hMin: 90, hMax: 175, color: '#a8c185',
      trunk: '#7d6a4e', crown: '#8fb469', lights: false
    });

    // --- дизайн среды: улица, низкие фасады с витринами ---
    makeLayer('bg_street_far', 1536, 380, 'city', {
      wMin: 24, wMax: 48, hMin: 95, hMax: 175, gapMax: 3, craneChance: 0,
      color: '#dcd6cb', winDay: '#cec8bd', winW: 2, winH: 3, winStep: 7
    });
    makeLayer('bg_street_near', 1536, 300, 'street', {
      wMin: 40, wMax: 76, hMin: 95, hMax: 145, gapMax: 2,
      color: '#cac1b3', dark: '#8b8175', winDay: '#b8aea1', winW: 4, winH: 5, winStep: 11
    });

    // --- реставрация: рваный верх, провалы арок ---
    makeLayer('bg_ruin_far', 1536, 380, 'ruins', {
      wMin: 30, wMax: 70, hMin: 85, hMax: 175, gapMax: 16,
      color: '#c3b3a2', lights: false
    });
    makeLayer('bg_ruin_near', 1536, 320, 'ruins', {
      wMin: 46, wMax: 110, hMin: 80, hMax: 150, gapMax: 26,
      color: '#a4907c', lights: false
    });

    // --- градостроительство: пласты района и доминанта ---
    makeLayer('bg_district_far', 1536, 380, 'district', {
      wMin: 40, wMax: 120, hMin: 80, hMax: 150, gapMax: 3,
      color: '#c6c1b6', winDay: '#bab5aa', winW: 2, winH: 2, winStep: 5
    });
    makeLayer('bg_district_near', 1536, 320, 'district', {
      wMin: 60, wMax: 170, hMin: 70, hMax: 130, gapMax: 4,
      color: '#aaa496', winDay: '#9d9789', winW: 3, winH: 3, winStep: 7
    });

    // --- звёзды и светило ---
    let s2 = 7;
    const r2 = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647;
    scene.textures.addCanvas('stars', AG.pixelCanvas(256, 150, 2, (g, px) => {
      for (let i = 0; i < 110; i++) {
        const x = Math.floor(r2() * 256), y = Math.floor(r2() * 150), r = r2();
        px(r < 0.55 ? '#8f97ad' : (r < 0.9 ? '#c9d1e4' : '#ffffff'), x, y, 1, 1);
        if (r > 0.94) { px('#ffffff', x + 1, y, 1, 1); px('#ffffff', x, y + 1, 1, 1); }
      }
    }));

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
  },

  /* ------------------------------------------- ОБВЯЗКА: сетка, кольцо, доска */
  buildChrome(scene, P) {
    scene.textures.addCanvas('grid', AG.pixelCanvas(64, 64, 2, (g, px) => {
      const line = 'rgba(38,38,38,0.07)';
      for (let i = 0; i < 64; i += 16) { px(line, i, 0, 1, 64); px(line, 0, i, 64, 1); }
    }));

    scene.textures.addCanvas('ring', AG.pixelCanvas(16, 16, 4, (g, px) => {
      const o = P.orange;
      const dots = [[6, 1], [9, 1], [3, 3], [12, 3], [1, 6], [1, 9],
                    [3, 12], [12, 12], [6, 14], [9, 14], [14, 6], [14, 9]];
      for (const d of dots) px(o, d[0], d[1], 1, 1);
    }));

    scene.textures.addCanvas('board', AG.pixelCanvas(48, 60, 2, (g, px) => {
      const ink = '#262626';
      px(ink, 2, 2, 44, 40);
      px('#ffffff', 4, 4, 40, 36);
      px('#e9e9e9', 4, 34, 40, 6);
      px(ink, 9, 42, 3, 14); px(ink, 36, 42, 3, 14);
      px(ink, 12, 50, 24, 3);
      px(P.orange, 8, 8, 32, 3);
    }));

    // движущаяся платформа и пружина — пиксельные, как весь мир
    scene.textures.addCanvas('mover', AG.pixelCanvas(48, 12, 2, (g, px) => {
      px('#262626', 0, 0, 48, 12);
      px('#5c5c66', 0, 0, 48, 2);
      px('#16161a', 0, 9, 48, 3);
      px(P.orange, 3, 3, 6, 3); px(P.orange, 39, 3, 6, 3);
    }));

    scene.textures.addCanvas('spring', AG.pixelCanvas(24, 14, 2, (g, px) => {
      px('#3a2f1f', 0, 11, 24, 3);
      px('#6d9a38', 2, 6, 20, 5);
      px('#8fbf4e', 2, 4, 20, 3);
      px('#d0e97e', 4, 2, 16, 2);
    }));

    // односторонняя платформа: сквозь неё проходят снизу
    scene.textures.addCanvas('oneway', AG.pixelCanvas(32, 8, 2, (g, px) => {
      px('#5c5c66', 0, 0, 32, 2);
      px('#262626', 0, 2, 32, 4);
      px('rgba(38,38,38,0.35)', 0, 6, 32, 2);
    }));

    // --- логотип «АРХИСБОР»: пиксельные литеры со сколами ---
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
    const GW = 7, GH = 9, GAP = 1, PAD = 2, SH = 2;
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
      for (const k of fill) px(shadow, (k % LW) + SH, ((k / LW) | 0) + SH);
      for (const k of fill) {
        const x = k % LW, y = (k / LW) | 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (!has(x + dx, y + dy)) px(ink, x + dx, y + dy);
      }
      for (const k of fill) px(face, k % LW, (k / LW) | 0);

      let seed = 4242;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const corners = [...fill].filter(k => {
        const x = k % LW, y = (k / LW) | 0;
        return (!has(x - 1, y) || !has(x + 1, y)) && (!has(x, y - 1) || !has(x, y + 1));
      });
      const used = new Set();
      for (let i = 0, guard = 0; i < 11 && guard < 200; guard++) {
        const k = corners[Math.floor(rnd() * corners.length)];
        if (used.has(k)) continue;
        used.add(k); i++;
        const x = k % LW, y = (k / LW) | 0;
        const dx = has(x - 1, y) ? -1 : 1, dy = has(x, y - 1) ? -1 : 1;
        px(P.orange, x, y);
        if (has(x + dx, y)) px(P.orange, x + dx, y);
        if (has(x, y + dy)) px(ink, x, y + dy);
      }
    }));
  },

  /* ======================= ВЕКТОРНЫЙ СЛОЙ =======================
     Архитектурные элементы. Здесь пикселизация запрещена: читаемость силуэта
     важнее фирменности и важнее единства арт-стиля. */
  buildElements(scene, P) {
    for (const el of AG.CONTENT.elements) {
      const { w, h } = el.view;
      const pad = 6, tw = w + pad * 2, th = h + pad * 2;

      // целая форма — чернильная; decor (мощение сквера) — светло-серым позади
      {
        const c = document.createElement('canvas'); c.width = tw; c.height = th;
        const g = c.getContext('2d');
        for (const d of el.decor || []) AG.fillLoops(g, [d], 1, pad, pad, '#dcdcdc', '#bcbcbc', 1.5);
        for (const p of el.pieces) AG.fillLoops(g, p.loops, 1, pad, pad, null, P.ink, 3);
        for (const p of el.pieces) AG.fillLoops(g, p.loops, 1, pad, pad, P.ink, null);
        scene.textures.addCanvas('full_' + el.id, c);
      }

      // decor отдельной текстурой — подложка на экране сборки
      if (el.decor) {
        const c = document.createElement('canvas'); c.width = tw; c.height = th;
        const g = c.getContext('2d');
        for (const d of el.decor) AG.fillLoops(g, [d], 1, pad, pad, '#e4e4e4', '#c6c6c6', 1.5);
        scene.textures.addCanvas('decor_' + el.id, c);
      }

      for (const p of el.pieces) {
        for (const variant of ['acc', 'ink']) {
          const key = 'frag_' + el.id + '_' + p.id + '_' + variant;
          const c = document.createElement('canvas'); c.width = tw; c.height = th;
          const g = c.getContext('2d');
          const fill = variant === 'acc' ? P.accent : P.ink;
          AG.fillLoops(g, p.loops, 1, pad, pad, fill, variant === 'acc' ? P.ink : null, 2.5);
          scene.textures.addCanvas(key, c);
        }
        {
          const c = document.createElement('canvas'); c.width = tw; c.height = th;
          const g = c.getContext('2d');
          AG.traceLoops(g, p.loops, 1, pad, pad);
          g.fillStyle = 'rgba(38,38,38,0.07)'; g.fill();
          g.setLineDash([5, 5]);
          g.strokeStyle = 'rgba(38,38,38,0.52)'; g.lineWidth = 2.5; g.stroke();
          scene.textures.addCanvas('slot_' + el.id + '_' + p.id, c);
        }
      }
    }
  }
};
