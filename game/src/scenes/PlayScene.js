/* Игровая сцена: пять зон-направлений профессии, подбор фрагментов, ручная
   сборка кликом, карточки термина после замыкания силуэта, финальная проверка.

   Устройство после ревизии «зоны = направления»:
   — ZONES[] здесь — ГЕОМЕТРИЯ (колонки, платформы, пикапы, доски, стены);
     содержание (термины, формы, определения) живёт в content.js и сюда не течёт;
   — станция сборки = индекс элемента (их семь), зона = направление (их пять);
     всё внутреннее состояние по-прежнему ключуется индексом ЭЛЕМЕНТА, поэтому
     обучающая петля осталась той же, что была проверена на трёх элементах. */
window.AG = window.AG || {};

AG.PlayScene = class extends Phaser.Scene {
  constructor() { super('play'); }

  /* ----------------------------------------------------------- ГЕОМЕТРИЯ
     Каждая зона: колонки [c0,c1], рельеф, односторонние площадки, движущиеся
     платформы, пружины, станции (элемент + доска + стена) и точки пикапов.
     Пикап задаётся клеткой ПОВЕРХНОСТИ, на которой стоит: [col, row]. */
  static LEVEL() {
    return [
      // ---------------------------------------------------- 1. архитектура
      {
        zone: 0, c0: 0, c1: 176,
        terrain: (A) => {
          A.fill(10, 29, 15, 29);                 // ступенька на старте
          A.clear(20, 30, 23, 32); A.fill(23, 32, 23, 32);   // учебный обрыв на уступ
          // карниз: башня из платформ
          A.plat(30, 33, 27); A.plat(36, 39, 24); A.plat(42, 45, 21); A.plat(37, 40, 18);
          // арочное окно: плато и две башни
          A.fill(64, 28, 77, 29); A.fill(68, 27, 69, 27); A.fill(79, 27, 80, 27);
          A.plat(84, 87, 26); A.plat(90, 93, 23); A.plat(96, 99, 26);
          A.plat(100, 103, 22); A.plat(94, 97, 19); A.plat(88, 91, 16);
          // двутавр: долина и высокая башня
          A.clear(126, 30, 139, 32); A.fill(136, 32, 137, 32);
          A.plat(148, 151, 27); A.plat(155, 158, 23); A.plat(162, 165, 19);
        },
        stations: [
          { el: 0, board: 54, wall: 58, pickups: [[31, 27], [37, 24], [43, 21], [38, 18]] },
          { el: 1, board: 112, wall: 116,
            pickups: [[85, 26], [91, 23], [97, 26], [101, 22], [95, 19], [89, 16]] },
          { el: 2, board: 172, wall: 176, pickups: [[149, 27], [156, 23], [163, 19]] }
        ]
      },

      // -------------------------------------------------------- 2. ландшафт
      // Склон, взятый ступенями: террасы — сплошной грунт, между ними висят
      // площадки «сквозь низ». Промах падает в промоину, откуда выбрасывает
      // пружина: наказания нет, есть другой способ вернуться.
      {
        zone: 1, c0: 177, c1: 238,
        terrain: (A) => {
          A.fill(186, 29, 194, 35);
          A.fill(196, 27, 204, 35);
          A.fill(206, 25, 214, 35);
          A.clear(216, 30, 220, 32);              // промоина, дно — строка 33
          A.spring(218, 33);
          A.fill(221, 29, 226, 35);               // ступень за промоиной
          A.fill(227, 26, 232, 35);               // верхняя терраса
          A.oneway(189, 191, 26); A.oneway(199, 201, 23);
          A.oneway(209, 211, 21); A.oneway(229, 231, 22);
        },
        stations: [
          { el: 3, board: 233, wall: 238, pickups: [[190, 26], [200, 23], [210, 21], [230, 22]] }
        ]
      },

      // ---------------------------------------------------- 3. дизайн среды
      { zone: 2, c0: 239, c1: 298,
        terrain: (A) => {
          A.clear(254, 30, 262, 32);
          A.mover(252, 264, 28);                  // подъёмник через разрыв улицы
          A.oneway(246, 248, 26); A.oneway(268, 270, 26); A.oneway(274, 276, 23);
          A.fill(286, 28, 292, 35);
        },
        stations: [
          { el: 4, board: 293, wall: 298, pickups: [[242, 30], [247, 26], [269, 26], [275, 23]] }
        ]
      },

      // ------------------------------------------------------ 4. реставрация
      // Шахта между двумя обломками стены: проходится и обычными прыжками по
      // уступам, и скольжением с отталкиванием — второе быстрее, но не
      // обязательно. Входить должен школьник, а не игрок в Celeste.
      { zone: 3, c0: 299, c1: 364,
        terrain: (A) => {
          // Уступы через каждые три строки (96 px): подъём одиночного прыжка —
          // 146 px, так что шахта берётся и без отталкивания от стен.
          A.fill(312, 17, 313, 27); A.fill(317, 17, 318, 27);
          A.fill(315, 27, 315, 27); A.fill(314, 24, 314, 24);
          A.fill(316, 21, 316, 21); A.fill(314, 19, 314, 19);
          A.fill(317, 16, 325, 16);               // выход поверх правой стены
          A.mover(328, 340, 24);                  // люлька на лесах
          A.fill(333, 20, 339, 20);
          A.fill(344, 22, 350, 22);
          A.fill(354, 26, 358, 26);
        },
        stations: [
          { el: 5, board: 359, wall: 364, pickups: [[306, 30], [314, 19], [336, 20], [347, 22]] }
        ]
      },

      // ------------------------------------------- 5. градостроительство
      { zone: 4, c0: 365, c1: 430,
        terrain: (A) => {
          A.fill(374, 28, 384, 35);
          A.fill(388, 26, 400, 35);
          A.fill(404, 24, 414, 35);
          A.oneway(379, 381, 24); A.oneway(393, 395, 22);
          A.oneway(408, 410, 20); A.oneway(418, 420, 26);
        },
        stations: [
          { el: 6, board: 423, wall: 428, pickups: [[379, 24], [393, 22], [408, 20], [419, 26]] }
        ]
      }
    ];
  }

  create() {
    const T = (this.T = 32);
    this.COLS = 432;
    this.ROWS = 36;
    this.GROUND_ROW = 30;
    this.WORLD_W = this.COLS * T;
    this.WORLD_H = this.ROWS * T;
    this.LEVEL = AG.PlayScene.LEVEL();
    this.NEL = AG.CONTENT.elements.length;

    AG.TEXTURES.build(this);

    this.addBackground();
    this.buildLevel();

    this.collected = Array.from({ length: this.NEL }, () => []);
    this.assembledEls = new Set();
    this.doneZones = new Set();
    this.currentEl = -1;
    this.currentZone = -1;
    this.selectedPiece = null;
    this.assembling = false;
    this.finished = false;

    this.setupPlayer();
    this.setupHud();
    this.setupColliders();

    /* Границы мира по бокам. Слева от нулевой колонки грунта нет, и игрок,
       побежавший влево от старта, просто уходил в пустоту: камера упирается в
       ноль, персонаж падает за кадр и вернуться уже не может. По вертикали
       границы отодвинуты далеко — они здесь не для игры, а как страховка. */
    this.physics.world.setBounds(0, -2000, this.WORLD_W, this.WORLD_H + 4000);
    this.player.setCollideWorldBounds(true);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, this.WORLD_W, this.WORLD_H);
    this.cameras.main.setDeadzone(120, 160);

    this.input.keyboard.on('keydown-M', () => AG.UI.muteToast(AG.SFX.toggle()));
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.assembling || this.finished || this.titleUp) return;
      AG.UI.togglePause((p) => (p ? this.physics.pause() : this.physics.resume()));
    });

    this.showTitle();
  }

  // ---------------------------------------------------------- титульный экран
  // Поверх живого мира, без затемнения. Он же первый экран для преподавателя:
  // что это, сколько занимает и чему учит — видно, не запуская (риск S3).
  showTitle() {
    const W = this.scale.width, H = this.scale.height;
    this.titleUp = true;
    this.physics.pause();
    this.hud.setVisible(false);
    AG.UI.hideChip();

    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(300);
    this.titleUi = c;

    const logo = this.add.image(W / 2, Math.round(H * 0.28), 'logo');
    c.add(logo);

    const txt = (s, size, color, weight) => this.add.text(0, 0, s, {
      fontFamily: 'Inter Tight, Arial, sans-serif',
      fontSize: size + 'px', color, fontStyle: (weight || 600) + ' ' + size + 'px Inter Tight'
    }).setLetterSpacing(1.6).setOrigin(0, 0.5);

    const parts = [txt('АРХИТЕКТОР ', 14, '#ffffff'), txt('НЕ ПРОСТО', 14, '#f28d05'), txt(' РИСУЕТ ДОМА', 14, '#ffffff')];
    const textW = parts.reduce((s, t) => s + t.width, 0);
    const padX = 38, plaqueH = 36;
    const plaqueW = textW + padX * 2;
    const py = Math.round(logo.y + logo.height / 2 + 24);
    const px0 = Math.round(W / 2 - plaqueW / 2);

    const g = this.add.graphics();
    g.fillStyle(0x262626, 1); g.fillRect(px0, py - plaqueH / 2, plaqueW, plaqueH);
    g.lineStyle(2, 0x7a7a7a, 1); g.strokeRect(px0, py - plaqueH / 2, plaqueW, plaqueH);
    g.fillStyle(0xf28d05, 1);
    g.fillRect(px0 + 13, py - 3, 6, 6); g.fillRect(px0 + plaqueW - 19, py - 3, 6, 6);
    c.add(g);

    let tx = px0 + padX;
    for (const t of parts) { t.setPosition(tx, py); tx += t.width; c.add(t); }

    const meta = txt('[ 10–12 МИНУТ · ПЯТЬ НАПРАВЛЕНИЙ · СЕМЬ ТЕРМИНОВ · КЛАВИАТУРА ]', 11, '#5c5c5c', 400)
      .setOrigin(0.5, 0.5).setPosition(W / 2, py + 30);
    const hint = txt('НАЖМИ ЛЮБУЮ КЛАВИШУ', 13, '#262626')
      .setOrigin(0.5, 0.5).setPosition(W / 2, py + 62);
    c.add(meta); c.add(hint);
    this.tweens.add({ targets: hint, alpha: 0.25, duration: 780, yoyo: true, repeat: -1 });

    AG.UI.showLegal();

    const start = () => this.hideTitle();
    this.input.keyboard.once('keydown', start);
    this.input.once('pointerdown', start);
  }

  hideTitle() {
    if (!this.titleUp) return;
    this.titleUp = false;
    const c = this.titleUi;
    this.titleUi = null;
    this.tweens.add({
      targets: c, alpha: 0, y: -18, duration: 320, ease: 'Cubic.easeIn',
      onComplete: () => c.destroy(true)
    });
    AG.UI.hideLegal();
    this.physics.resume();
    this.refreshHud();
    AG.UI.toast(AG.CONTENT.toasts[0].id, AG.CONTENT.toasts[0].text);
    AG.UI.anyKeyCloses();
    AG.METRICS.goal('start');
    AG.SFX.unlock();
    AG.SFX.start();
  }

  // ---------------------------------------------------------------- уровень
  buildLevel() {
    const T = this.T;
    const G = Array.from({ length: this.ROWS }, () => new Array(this.COLS).fill(0));
    const onewayDefs = [], moverDefs = [], springDefs = [];

    const A = {
      fill: (c0, r0, c1, r1) => {
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++) if (G[r] && c >= 0 && c < this.COLS) G[r][c] = 1;
      },
      clear: (c0, r0, c1, r1) => {
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++) if (G[r] && c >= 0 && c < this.COLS) G[r][c] = 0;
      },
      plat: (c0, c1, r) => A.fill(c0, r, c1, r),
      oneway: (c0, c1, r) => onewayDefs.push([c0, c1, r]),
      mover: (c0, c1, r) => moverDefs.push([c0, c1, r]),
      spring: (c, r) => springDefs.push([c, r])
    };

    // сплошной грунт под всем уровнем, дальше зоны режут и надстраивают
    A.fill(0, this.GROUND_ROW, this.COLS - 1, this.ROWS - 1);
    this.themeRow = new Array(this.COLS).fill(0);
    for (const seg of this.LEVEL) {
      const themeIdx = AG.THEMES.indexOf(AG.CONTENT.zones[seg.zone].theme);
      for (let c = seg.c0; c <= seg.c1 && c < this.COLS; c++) this.themeRow[c] = themeIdx;
      seg.terrain(A);
    }

    /* Автотайлинг. Маска считается ПО ИСХОДНОЙ копии: читать клетки, уже
       изменённые в этом же проходе, — старая ошибка, дававшая чередование. */
    const src = G.map(row => row.slice());
    const solid = (c, r) => (r < 0 ? false : (r >= this.ROWS ? true : (src[r] && src[r][c] === 1)));
    const data = Array.from({ length: this.ROWS }, () => new Array(this.COLS).fill(-1));
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++) {
        if (src[r][c] !== 1) continue;
        const mask = (solid(c, r - 1) ? 1 : 0) | (solid(c + 1, r) ? 2 : 0) |
                     (solid(c, r + 1) ? 4 : 0) | (solid(c - 1, r) ? 8 : 0);
        // вариант рисунка — детерминированный хеш клетки: тот же уровень
        // выглядит одинаково между запусками, но соседи не повторяются
        const v = (((c * 73856093) ^ (r * 19349663)) >>> 0) % AG.TILE_VARIANTS;
        data[r][c] = 1 + this.themeRow[c] * AG.TILES_PER_THEME + v * 16 + mask;
      }

    const map = this.make.tilemap({ data, tileWidth: T, tileHeight: T });
    const ts = map.addTilesetImage('tiles', 'tiles', T, T, 0, 0, 1);
    const layer = map.createLayer(0, ts, 0, 0);
    layer.setCollisionByExclusion([-1]);
    this.groundLayer = layer;

    // --- односторонние площадки: держат сверху, пропускают снизу ---
    this.oneways = this.physics.add.staticGroup();
    for (const [c0, c1, r] of onewayDefs) {
      const w = (c1 - c0 + 1) * T;
      const img = this.add.tileSprite((c0 + (c1 - c0 + 1) / 2) * T, r * T + 8, w, 16, 'oneway')
        .setDepth(3);
      this.physics.add.existing(img, true);
      img.body.setSize(w, 12);
      img.body.position.set(img.x - w / 2, r * T + 2);
      img.body.checkCollision.down = false;
      img.body.checkCollision.left = false;
      img.body.checkCollision.right = false;
      this.oneways.add(img);
    }

    // --- движущиеся платформы: статическое тело, двигается вручную ---
    this.movers = [];
    for (const [c0, c1, r] of moverDefs) {
      const img = this.add.image(c0 * T, r * T, 'mover').setDepth(3);
      this.physics.add.existing(img, true);
      img.body.setSize(96, 24);
      this.movers.push({ img, x0: c0 * T, x1: c1 * T, y: r * T, t: Math.random() * Math.PI * 2, px: c0 * T });
    }

    // --- пружины: ландшафтная зона, выброс из промоины ---
    this.springs = [];
    for (const [c, r] of springDefs) {
      const img = this.add.image((c + 0.5) * T, r * T - 6, 'spring').setDepth(3);
      this.springs.push({ img, x: img.x, y: img.y });
    }

    // --- пикапы, доски и стены по станциям ---
    this.pickupsData = [];
    this.boards = new Array(this.NEL).fill(null);
    this.walls = new Array(this.NEL).fill(null);
    this.stationX = new Array(this.NEL).fill(0);

    for (const seg of this.LEVEL) {
      for (const st of seg.stations) {
        const el = AG.CONTENT.elements[st.el];
        st.pickups.slice(0, el.pieces.length).forEach(([c, r], i) => {
          this.pickupsData.push({
            elIdx: st.el, pieceId: el.pieces[i].id, taken: false,
            x: (c + 0.5) * T, y: r * T - 34
          });
        });
        this.makeBoard(st.el, st.board);
        this.makeWall(st.el, st.wall);
        this.stationX[st.el] = st.board * T;
      }
    }

    for (const p of this.pickupsData) {
      const el = AG.CONTENT.elements[p.elIdx];
      const ring = this.add.image(p.x, p.y, 'ring').setAlpha(0.85).setDepth(2);
      this.tweens.add({ targets: ring, scale: 1.18, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
      const m = this.fitPiece(el, p.pieceId, 62, 40, 0.55);
      const icon = this.add.image(p.x - m.dx, p.y - m.dy,
        'frag_' + el.id + '_' + p.pieceId + '_acc').setScale(m.scale).setDepth(3);
      p.ring = ring; p.icon = icon;
    }
  }

  makeBoard(elIdx, col) {
    const T = this.T;
    const bx = col * T, by = (this.GROUND_ROW - 1) * T - 60;
    const board = this.add.image(bx, by, 'board').setDepth(3);
    const dots = this.add.graphics({ x: bx, y: by }).setDepth(4);
    this.drawDots(dots, elIdx, 0);
    this.boards[elIdx] = { img: board, dots, x: bx, y: by };
  }

  /* Стена прогресса: барьер во всю высоту мира, от неба до грунта.
     Высота не декоративная — она гарантия. Прыжок от стены умеет поднимать
     игрока вдоль вертикальной поверхности, поэтому «достаточно высокой» стены
     больше не существует: перелезть нельзя только через то, у чего нет верха. */
  makeWall(elIdx, col) {
    const T = this.T;
    const wx = col * T;
    if (!this.textures.exists('wall')) {
      const c = document.createElement('canvas'); c.width = 10; c.height = 32;
      const g = c.getContext('2d');
      g.strokeStyle = AG.PALETTE.orange; g.lineWidth = 4; g.setLineDash([6, 6]);
      g.beginPath(); g.moveTo(5, 0); g.lineTo(5, 32); g.stroke();
      this.textures.addCanvas('wall', c);
    }
    const wallH = this.GROUND_ROW * T;
    const img = this.add.tileSprite(wx, 0, 10, wallH, 'wall').setOrigin(0.5, 0).setDepth(4);
    // Тело выше нарисованного на высоту экрана: рисовать барьер там, куда не
    // доедет камера, незачем, а держать — обязательно. Иначе достаточно
    // оказаться выше y=0, чтобы обойти стену поверху.
    const OVER = 720;
    const body = this.add.zone(wx, (wallH - OVER) / 2, 18, wallH + OVER);
    this.physics.add.existing(body, true);
    this.walls[elIdx] = { img, body, collider: null };
  }

  // Габарит фигуры внутри холста: масштаб под коробку + сдвиг, чтобы
  // центрировать саму фигуру, а не холст целого элемента.
  fitPiece(el, pieceId, boxW, boxH, maxScale) {
    const piece = el.pieces.find(p => p.id === pieceId);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const loop of piece.loops) for (const pt of loop) {
      x0 = Math.min(x0, pt[0]); x1 = Math.max(x1, pt[0]);
      y0 = Math.min(y0, pt[1]); y1 = Math.max(y1, pt[1]);
    }
    const pad = 6, tw = el.view.w + pad * 2, th = el.view.h + pad * 2;
    const scale = Math.min(boxW / (x1 - x0), boxH / (y1 - y0), maxScale || Infinity);
    return {
      scale,
      dx: ((x0 + x1) / 2 + pad - tw / 2) * scale,
      dy: ((y0 + y1) / 2 + pad - th / 2) * scale
    };
  }

  drawDots(g, elIdx, have) {
    const total = AG.CONTENT.elements[elIdx].pieces.length;
    g.clear();
    for (let i = 0; i < total; i++) {
      g.fillStyle(i < have ? AG.PALETTE.accent : 0xe9e9e9, 1);
      g.fillCircle(-total * 11 + i * 22 + 11, 20, 6);
      g.lineStyle(1.5, AG.PALETTE.ink, 1);
      g.strokeCircle(-total * 11 + i * 22 + 11, 20, 6);
    }
  }

  /* ------------------------------------------------------------------- ФОН
     Пять комплектов задников по числу направлений; переключаются кроссфейдом
     по положению игрока. Ночной коэффициент тоже свой у каждой зоны: город —
     день, улица с фонарями — вечер, район — ночь. */
  addBackground() {
    const W = this.scale.width, H = this.scale.height;
    this.skyRect = this.add.rectangle(0, 0, W, H * 2, 0xf7f7f7)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(-20);
    this.stars = this.add.tileSprite(0, 0, W, 340, 'stars').setOrigin(0, 0)
      .setScrollFactor(0).setDepth(-18).setAlpha(0);
    this.sunmoon = this.add.image(130, 88, 'sunmoon').setScrollFactor(0).setDepth(-17).setScale(0.9);
    this.grid = this.add.tileSprite(0, 0, this.WORLD_W, this.WORLD_H, 'grid').setOrigin(0, 0).setDepth(-15);

    const SETS = {
      city:     [['bg_city_far', 310, 0.15, 1], ['bg_city_mid', 250, 0.35, 1], ['bg_city_near', 190, 0.6, 1]],
      // высота полосы обязана совпадать с высотой текстуры из buildBackdrops:
      // полоса короче показывает верх текстуры, то есть пустое небо
      green:    [['bg_green_far', 380, 0.18, 0], ['bg_green_near', 300, 0.5, 0]],
      street:   [['bg_street_far', 380, 0.2, 1], ['bg_street_near', 300, 0.55, 1]],
      ruin:     [['bg_ruin_far', 380, 0.18, 0], ['bg_ruin_near', 320, 0.52, 0]],
      district: [['bg_district_far', 380, 0.14, 1], ['bg_district_near', 320, 0.42, 1]]
    };
    this.bgSets = {};
    for (const name of AG.THEMES) {
      this.bgSets[name] = SETS[name].map(([key, h, factor, hasLights]) => {
        const day = this.add.tileSprite(0, H - h, W, h, key).setOrigin(0, 0)
          .setScrollFactor(0).setDepth(-11).setAlpha(0);
        const night = hasLights && this.textures.exists(key + '_lights')
          ? this.add.tileSprite(0, H - h, W, h, key + '_lights').setOrigin(0, 0)
            .setScrollFactor(0).setDepth(-10).setAlpha(0)
          : null;
        return { day, night, factor };
      });
    }

    // дневное небо и ночной коэффициент по зонам
    this.zoneSky = [[247, 247, 247], [232, 242, 224], [244, 238, 228], [240, 232, 220], [238, 240, 244]];
    this.zoneNight = [0, 0.08, 0.5, 0.72, 0.95];
    this._nf = 0;
    this._sky = [247, 247, 247];
    this._motes = [];
    this._moteAt = 0;
  }

  /* Вес каждой зоны в точке x: единица внутри, спад к нулю за BLEND пикселей
     от границы. Ниже по нему смешивается всё — небо, свет, задники. */
  zoneWeights(x) {
    const T = this.T, BLEND = 420;
    const w = new Array(AG.CONTENT.zones.length).fill(0);
    let sum = 0;
    for (const seg of this.LEVEL) {
      const x0 = seg.c0 * T, x1 = (seg.c1 + 1) * T;
      const d = x < x0 ? x0 - x : (x > x1 ? x - x1 : 0);
      const v = Math.max(0, 1 - d / BLEND);
      w[seg.zone] += v; sum += v;
    }
    if (sum <= 0) { w[0] = 1; sum = 1; }
    return w.map(v => v / sum);
  }

  applyBackground(x) {
    const w = this.zoneWeights(x);

    let nf = 0, sky = [0, 0, 0];
    w.forEach((k, i) => {
      nf += k * this.zoneNight[i];
      for (let j = 0; j < 3; j++) sky[j] += k * this.zoneSky[i][j];
    });
    // сглаживаем, чтобы смена зоны не мигала
    this._nf += (nf - this._nf) * 0.04;
    for (let j = 0; j < 3; j++) this._sky[j] += (sky[j] - this._sky[j]) * 0.04;
    const nf2 = this._nf;

    const skyCol = AG.mixInt(this._sky.map(Math.round), AG.NIGHT_SKY, nf2);
    this.skyRect.fillColor = skyCol;
    document.body.style.background = AG.mix(this._sky.map(Math.round), AG.NIGHT_SKY, nf2);
    this.grid.setAlpha((1 - nf2 * 0.85) * 0.9);
    this.stars.setAlpha(nf2 * 0.9);

    // Здания темнеют медленнее неба — иначе на вечерних зонах силуэт
    // застройки сливается с фоном и задник исчезает целиком.
    const tint = AG.mixInt([255, 255, 255], [120, 126, 140], nf2);
    const sx = this.cameras.main.scrollX;
    AG.THEMES.forEach((name, i) => {
      const k = w[i] || 0;
      for (const l of this.bgSets[name]) {
        l.day.setAlpha(k);
        l.day.setTint(tint);
        l.day.tilePositionX = sx * l.factor;
        if (l.night) {
          l.night.setAlpha(k * nf2 * 0.95);
          l.night.tilePositionX = sx * l.factor;
        }
      }
    });
    this.stars.tilePositionX = sx * 0.06;
    this.sunmoon.setTint(AG.mixInt([242, 141, 5], [214, 220, 230], nf2));
    this.sunmoon.setAlpha(0.85 - nf2 * 0.25);
  }

  /* Частицы под характер зоны: листья в ландшафте, пыль в руинах, искры фонарей
     на улице. Пять штук в кадре максимум — это акцент, а не система частиц. */
  ambientMotes(time, zoneIdx) {
    if (time - this._moteAt < 520 || this._motes.length > 14) return;
    this._moteAt = time;
    const spec = [null,
      { c: 0x8fb469, w: 5, fall: 22, drift: 26 },     // ландшафт: лист
      { c: 0xffc16c, w: 3, fall: -14, drift: 8 },     // улица: искра фонаря
      { c: 0xb0a08c, w: 3, fall: 10, drift: 30 },     // руины: пыль
      null][zoneIdx];
    if (!spec) return;
    const cam = this.cameras.main;
    const x = cam.scrollX + Math.random() * this.scale.width;
    const y = cam.scrollY + Math.random() * this.scale.height * 0.7;
    const r = this.add.rectangle(x, y, spec.w, spec.w, spec.c).setDepth(1).setAlpha(0.55);
    this._motes.push(r);
    this.tweens.add({
      targets: r, y: y + spec.fall * 6, x: x + (Math.random() - 0.5) * spec.drift * 4,
      alpha: 0, duration: 2600 + Math.random() * 1600, ease: 'Sine.easeInOut',
      onComplete: () => { r.destroy(); this._motes = this._motes.filter(m => m !== r); }
    });
  }

  // ---------------------------------------------------------------- игрок
  setupPlayer() {
    this.player = this.physics.add.sprite(3 * this.T, 27 * this.T, 'guy_idle');
    this.player.setDepth(5);
    this.player.setScale(1.15);
    this.player.body.setSize(18, 48, true);
    this.player.setMaxVelocity(280, 920);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D,W,SPACE');

    this.jumpBufferedAt = -9999;
    this.lastGroundedAt = -9999;
    this.wallJumpLockUntil = 0;
    this.wallSide = 0;
    this.lastWallJumpAt = -9999;
    this.lastWallJumpSide = 0;
    const buffer = () => (this.jumpBufferedAt = this.time.now);
    this.input.keyboard.on('keydown-SPACE', buffer);
    this.input.keyboard.on('keydown-W', buffer);
    this.input.keyboard.on('keydown-UP', buffer);
  }

  setupHud() {
    const W = this.scale.width;
    this.hud = this.add.container(W - 62, 52).setScrollFactor(0).setDepth(50);
    this.hudGfx = this.add.graphics();
    this.hud.add(this.hudGfx);
    this.hudIcons = this.add.container(0, 0);
    this.hud.add(this.hudIcons);
    this.hud.setVisible(false);
  }

  /* Панель фрагментов — тёмная пилюля с фирменной полосой, как чип-счётчик в
     левом углу. Раньше это был белый прямоугольник, не связанный ни с чем в
     кадре: на светлом фоне города он сливался с доской сборки за ним. */
  drawHudPanel(n) {
    const g = this.hudGfx;
    g.clear();
    const h = Math.max(2, n) * 46 + 34;
    g.fillStyle(0x000000, 0.18); g.fillRoundedRect(-32, -36, 80, h, 22);
    g.fillStyle(0x262626, 0.94); g.fillRoundedRect(-35, -39, 80, h, 22);
    g.fillStyle(0xf28d05, 1); g.fillRect(-19, -28, 48, 3);
  }

  refreshHud() {
    this.hudIcons.removeAll(true);
    if (this.currentEl < 0) { this.hud.setVisible(false); return; }
    if (this.finished || this.assembling) { this.hud.setVisible(false); AG.UI.hideChip(); return; }
    const el = AG.CONTENT.elements[this.currentEl];
    const got = this.collected[this.currentEl];
    const noun = el.mode === 'place' ? 'формы' : 'фрагменты';
    const pad = (n) => (n < 10 ? '0' : '') + n;
    if (!got.length) {
      this.hud.setVisible(false);
      AG.UI.setChip(noun + '::' + pad(0) + '/' + pad(el.pieces.length));
      return;
    }
    this.hud.setVisible(true);
    this.drawHudPanel(el.pieces.length);
    got.forEach((pid, i) => {
      const m = this.fitPiece(el, pid, 54, 30, 0.34);
      const icon = this.add.image(-m.dx, -18 + i * 46 - m.dy,
        'frag_' + el.id + '_' + pid + '_acc').setScale(m.scale);
      this.hudIcons.add(icon);
    });
    AG.UI.setChip(noun + '::' + pad(got.length) + '/' + pad(el.pieces.length));
  }

  setupColliders() {
    this.physics.add.collider(this.player, this.groundLayer);
    this.physics.add.collider(this.player, this.oneways);
    for (const m of this.movers) this.physics.add.collider(this.player, m.img);
    for (const w of this.walls) if (w) w.collider = this.physics.add.collider(this.player, w.body);
  }

  // ---------------------------------------------------------------- сбор
  collect(p) {
    p.taken = true;
    this.collected[p.elIdx].push(p.pieceId);
    AG.SFX.pickup();
    if (!this._gotFirst) { this._gotFirst = true; AG.METRICS.goal('frag_first'); }
    const el = AG.CONTENT.elements[p.elIdx];

    const cam = this.cameras.main;
    this.tweens.add({
      targets: [p.icon, p.ring],
      x: cam.scrollX + this.hud.x, y: cam.scrollY + this.hud.y,
      scale: 0.2, alpha: 0.2, duration: 420, ease: 'Cubic.easeIn',
      onComplete: () => { p.icon.destroy(); p.ring.destroy(); this.refreshHud(); }
    });

    AG.UI.toast(AG.CONTENT.toasts[1].id, AG.CONTENT.toasts[1].text);

    const b = this.boards[p.elIdx];
    if (b) this.drawDots(b.dots, p.elIdx, this.collected[p.elIdx].length);
    void el;
  }

  /* Станция, к которой относится игрок: первая несобранная доска правее него,
     иначе последняя. Раньше это были три захардкоженные границы по x. */
  currentElAt(x) {
    for (let i = 0; i < this.NEL; i++) {
      if (this.assembledEls.has(i)) continue;
      if (x <= this.stationX[i] + 200) return i;
    }
    return this.NEL - 1;
  }

  zoneAt(x) {
    const T = this.T;
    for (const seg of this.LEVEL) if (x >= seg.c0 * T && x <= (seg.c1 + 1) * T) return seg.zone;
    return x < 0 ? 0 : AG.CONTENT.zones.length - 1;
  }

  tryAssembly(elIdx) {
    if (this.assembling || this.assembledEls.has(elIdx)) return;
    if (this.collected[elIdx].length < AG.CONTENT.elements[elIdx].pieces.length) {
      if (!this._pulseAt || this.time.now - this._pulseAt > 900) {
        this._pulseAt = this.time.now;
        this.tweens.add({
          targets: this.boards[elIdx].img, scale: { from: 1, to: 1.08 }, duration: 130, yoyo: true
        });
      }
      return;
    }
    this.openAssembly(elIdx);
  }

  // ------------------------------------------------------- сборка кликом
  // Один и тот же экран обслуживает обе механики. Разница в ритме, а не в коде:
  // при mode:'place' фрагменты — уже готовые предметы, цель — сквер, и каждый
  // предмет называет себя одной строкой в момент установки (бриф 3.2).
  openAssembly(elIdx) {
    this.assembling = true;
    this.physics.pause();
    this.selectedPiece = null;
    const el = AG.CONTENT.elements[elIdx];
    const place = el.mode === 'place';
    const ui = {};
    this.asmUi = ui;

    const W = this.scale.width, H = this.scale.height;
    const cx = W / 2;
    const n0 = el.pieces.length;
    // В расстановке цель — сцена целиком (сквер), а не один элемент, поэтому
    // карточка шире, а «фрагменты» в лотке крупнее: это готовые предметы, их
    // надо узнавать, а не опознавать как обрезки.
    const trayGap = Math.min(place ? 80 : 62, Math.floor((H - 190) / Math.max(1, n0)));
    const cardW = Math.min(place ? 780 : 640, W - 40);
    const cardH = Math.min(H - 40, Math.max(n0 * trayGap + 104, 300));
    const cardT = Math.round((H - cardH) / 2);
    const formFrac = place ? 0.58 : 0.5;

    ui.dim = this.add.rectangle(cx, H / 2, W, H, 0x262626, 0.38).setScrollFactor(0).setDepth(200).setInteractive();
    ui.card = this.add.graphics().setScrollFactor(0).setDepth(201);
    ui.card.fillStyle(0xffffff, 1); ui.card.fillRoundedRect(cx - cardW / 2, cardT, cardW, cardH, 24);
    ui.card.lineStyle(2, AG.PALETTE.ink, 1); ui.card.strokeRoundedRect(cx - cardW / 2, cardT, cardW, cardH, 24);
    this.hud.setVisible(false);
    AG.UI.hideChip();

    const trayX = cx + cardW * 0.30;
    ui.texts = [];
    const mkText = (x, y, str, size, color, origin) => {
      const t = this.add.text(x, y, str, {
        fontFamily: 'Inter Tight, Arial, sans-serif', fontSize: size + 'px',
        color, fontStyle: '400 ' + size + 'px Inter Tight'
      }).setLetterSpacing(0.5).setScrollFactor(0).setDepth(205).setOrigin(origin === undefined ? 0 : origin);
      ui.texts.push(t);
      return t;
    };
    const zone = AG.CONTENT.zones[AG.zoneOfElement(elIdx)];
    mkText(cx - cardW / 2 + 20, cardT + 16,
      '[ ' + (place ? 'РАССТАНОВКА' : 'СБОРКА') + ' :: ' + zone.tag.toUpperCase() +
      (el.projection ? ' :: ' + el.projection.toUpperCase() : '') + ' ]', 11, '#5c5c5c');
    mkText(trayX, cardT + 22, place ? '[ ФОРМЫ ]' : '[ ФРАГМЕНТЫ ]', 11, '#5c5c5c', 0.5);
    const hint = this.add.text(cx - cardW * 0.22, cardT + cardH - 26,
      place ? 'Выбери форму — поставь её в сквер' : 'Выбери фрагмент — поставь на своё место', {
        fontFamily: 'Inter Tight, Arial, sans-serif', fontSize: '12px', color: '#5c5c5c'
      }).setLetterSpacing(0.3).setScrollFactor(0).setDepth(205).setOrigin(0.5, 1);
    ui.texts.push(hint);

    const fit = Math.min((cardH - 110) / el.view.h, (cardW * formFrac) / el.view.w);
    const ox = cx - cardW * 0.22, oy = cardT + cardH / 2 - 8;

    // подложка сквера: мощение — контекст, а не собираемая форма
    if (el.decor && this.textures.exists('decor_' + el.id)) {
      ui.decor = this.add.image(ox, oy, 'decor_' + el.id)
        .setScale(fit).setScrollFactor(0).setDepth(201.5);
    }

    ui.slotImgs = {};
    ui.labels = [];
    for (const piece of el.pieces) {
      const s = this.add.image(ox, oy, 'slot_' + el.id + '_' + piece.id)
        .setScale(fit).setScrollFactor(0).setDepth(202);
      s.setInteractive(this.hitConfig(piece, place));
      s.pieceId = piece.id;
      s.on('pointerdown', () => this.tryPlace(elIdx, piece.id));
      ui.slotImgs[piece.id] = s;
    }

    ui.tray = [];
    ui.trayY0 = cardT + 58;
    ui.trayGap = trayGap;
    el.pieces.forEach((piece, i) => {
      const m = this.fitPiece(el, piece.id, place ? 175 : 150, trayGap - 10, place ? 0.9 : 0.5);
      const t = this.add.image(trayX - m.dx, ui.trayY0 + i * trayGap - m.dy,
        'frag_' + el.id + '_' + piece.id + '_acc')
        .setScale(m.scale).setScrollFactor(0).setDepth(203);
      t.dyOff = m.dy;
      t.setInteractive(this.hitConfig(piece, place));
      t.pieceId = piece.id;
      t.baseScale = m.scale;
      t.on('pointerdown', () => this.selectTrayItem(t));
      ui.tray.push(t);
    });

    ui.elIdx = elIdx;
    ui.placedCount = 0;
    ui.sig = {};
    for (const piece of el.pieces) ui.sig[piece.id] = this.pieceSignature(piece);
  }

  /* Подпись формы: контур, сдвинутый в начало координат. Два фрагмента с
     одинаковой подписью игрок не различает в принципе — левый и правый косяк
     арки, верхняя и нижняя полка двутавра, противоположные стороны квартала
     попиксельно совпадают. Требовать от него угадать, «который из двух», —
     не работа над формой, а монетка, и она обнуляла бы решение 6 скоупа на
     восьми постановках из двадцати девяти. Поэтому они взаимозаменяемы. */
  pieceSignature(piece) {
    let x0 = 1e9, y0 = 1e9;
    for (const l of piece.loops) for (const pt of l) { x0 = Math.min(x0, pt[0]); y0 = Math.min(y0, pt[1]); }
    return piece.loops
      .map(l => l.map(pt => Math.round(pt[0] - x0) + ',' + Math.round(pt[1] - y0)).join(' '))
      .sort().join('|');
  }

  /* Точный хит-ареал по контуру. Раньше бралось только первое кольцо, из-за
     чего фрагмент из нескольких колец (скамья, пергола) ловил клики лишь
     частью себя. Прозрачные углы текстуры по-прежнему кликов не ловят. */
  /* bbox=true — габаритный прямоугольник вместо контура. Нужен там, где
     фигуры разнесены в пространстве (сквер): у скамьи планки в десять пикселей
     толщиной, и попасть по контуру мышью — отдельное упражнение, которого в
     задании нет. Там, где фрагменты лежат впритык (карниз, квартал), остаётся
     точный контур: иначе слоты перехватывали бы клики друг у друга. */
  hitConfig(piece, bbox) {
    const pad = 6;
    if (bbox) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const loop of piece.loops) for (const p of loop) {
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      return {
        hitArea: new Phaser.Geom.Rectangle(x0 + pad - 4, y0 + pad - 4, x1 - x0 + 8, y1 - y0 + 8),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains
      };
    }
    // Именно конфигурационная форма: обычный объект во втором варианте вызова
    // Phaser принимает за config и молча ставит прямоугольник во всю текстуру,
    // а холсты у всех фрагментов одинаковые — клик попадал бы куда угодно.
    return {
      hitArea: { loops: piece.loops.map(l => l.map(p => [p[0] + pad, p[1] + pad])) },
      hitAreaCallback: AG.PlayScene.hitLoops
    };
  }

  static hitLoops(area, x, y) {
    for (const loop of area.loops) {
      let inside = false;
      for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
        const xi = loop[i][0], yi = loop[i][1], xj = loop[j][0], yj = loop[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  }

  selectTrayItem(item) {
    if (this.selectedPiece === item) {
      item.setScale(item.baseScale); item.setAlpha(1);
      this.selectedPiece = null;
      return;
    }
    if (this.selectedPiece) {
      this.selectedPiece.setScale(this.selectedPiece.baseScale);
      this.selectedPiece.setAlpha(1);
    }
    this.selectedPiece = item;
    item.setScale(item.baseScale * 1.25);
    Object.values(this.asmUi.slotImgs).forEach(s => {
      if (!s.filled) this.tweens.add({ targets: s, alpha: { from: 1, to: 0.55 }, duration: 260, yoyo: true });
    });
  }

  tryPlace(elIdx, pieceId) {
    const ui = this.asmUi;
    if (!this.selectedPiece) return;
    // одинаковые по форме фрагменты подходят в оба места: различить их нельзя
    const congruent = ui.sig[this.selectedPiece.pieceId] === ui.sig[pieceId];
    if (this.selectedPiece.pieceId !== pieceId && !congruent) {
      // промах: фрагмент не встал, пробуй снова, без наказания
      const it = this.selectedPiece;
      this.tweens.add({ targets: it, x: { from: it.x - 8, to: it.x }, duration: 160, ease: 'Sine.easeInOut' });
      this.selectedPiece = null;
      it.setScale(it.baseScale);
      AG.SFX.deny();
      return;
    }
    const el = AG.CONTENT.elements[elIdx];
    const piece = el.pieces.find(p => p.id === pieceId);
    const slot = ui.slotImgs[pieceId];
    const item = this.selectedPiece;
    this.tweens.add({
      targets: item, x: slot.x, y: slot.y, scale: slot.scaleX, alpha: 0,
      duration: 200, ease: 'Cubic.easeOut', onComplete: () => item.destroy()
    });
    AG.SFX.place();
    slot.setTexture('frag_' + el.id + '_' + pieceId + '_ink');
    slot.filled = true;
    slot.disableInteractive();
    this.selectedPiece = null;
    ui.tray = ui.tray.filter(t => t !== item);
    ui.tray.forEach((t, i) => this.tweens.add({
      targets: t, y: ui.trayY0 + i * ui.trayGap - t.dyOff, duration: 200, ease: 'Cubic.easeOut'
    }));

    // форма называет себя — одной строкой, только в режиме расстановки
    if (piece.label) this.showPieceLabel(el, piece, slot);

    ui.placedCount++;
    if (ui.placedCount >= el.pieces.length) this.completeAssembly(elIdx);
  }

  showPieceLabel(el, piece, slot) {
    const pad = 6;
    let x0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const loop of piece.loops) for (const p of loop) {
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
    }
    const s = slot.scaleX;
    const cx = slot.x + ((x0 + x1) / 2 + pad - (el.view.w + pad * 2) / 2) * s;
    const cy = slot.y + (y1 + pad - (el.view.h + pad * 2) / 2) * s + 16;
    const t = this.add.text(cx, cy, piece.label, {
      fontFamily: 'Inter Tight, Arial, sans-serif', fontSize: '13px', color: '#262626',
      fontStyle: '600 13px Inter Tight'
    }).setLetterSpacing(0.6).setOrigin(0.5, 0).setScrollFactor(0).setDepth(206).setAlpha(0);
    this.asmUi.texts.push(t);
    this.tweens.add({ targets: t, alpha: 1, y: cy - 4, duration: 260, ease: 'Cubic.easeOut' });
  }

  completeAssembly(elIdx) {
    const ui = this.asmUi;
    const el = AG.CONTENT.elements[elIdx];
    this.assembledEls.add(elIdx);
    AG.SFX.assembled();

    // секунда тишины с готовой формой — потом слово
    this.time.delayedCall(el.mode === 'place' ? 900 : 250, () => {
      if (!this.asmUi) return;
      Object.values(ui.slotImgs).forEach(s => s.destroy());
      ui.tray.forEach(t => t.destroy());
      (ui.texts || []).forEach(t => t.destroy());
      if (ui.decor) ui.decor.destroy();
      const full = this.add.image(this.scale.width / 2, this.scale.height / 2, 'full_' + el.id)
        .setScrollFactor(0).setDepth(204).setScale(0.6).setAlpha(0);
      ui.full = full;
      const target = Math.min(1, (this.scale.height - 150) / (el.view.h + 12));
      this.tweens.add({ targets: full, scale: target, alpha: 1, duration: 450, ease: 'Back.easeOut' });

      this.time.delayedCall(1000, () => {
        const loops = el.pieces.flatMap(p => p.loops);
        const svg = AG.loopsToSvg(loops, el.view.w, el.view.h, '#f7f7f7', AG.PALETTE.ink, 3);
        AG.UI.termCard(el, svg, () => this.afterTermCard(elIdx), elIdx);
      });
    });
  }

  afterTermCard(elIdx) {
    if (!this.asmUi) return; // защита от двойного клика по «Дальше»
    const ui = this.asmUi;
    if (ui.full) ui.full.destroy();
    ui.dim.destroy(); ui.card.destroy();
    this.asmUi = null;
    this.assembling = false;
    this.physics.resume();
    this.refreshHud();

    // стена снимается
    const w = this.walls[elIdx];
    if (w) {
      this.tweens.add({ targets: w.img, alpha: 0, duration: 400, onComplete: () => w.img.destroy() });
      if (w.collider) this.physics.world.removeCollider(w.collider);
      w.body.destroy();
      this.walls[elIdx] = null;
    }

    // зона закрыта, когда собраны все её станции
    const zi = AG.zoneOfElement(elIdx);
    const zone = AG.CONTENT.zones[zi];
    if (zone.els.every(i => this.assembledEls.has(i)) && !this.doneZones.has(zi)) {
      this.doneZones.add(zi);
      AG.METRICS.goal('zone_done_' + (zi + 1));
    }

    if (elIdx === this.NEL - 1) this.startQuiz();
  }

  /* Название направления при входе в зону: одна строка в углу, не блокирует
     и не требует нажатия. Без него зоны остаются «уровнями», а весь смысл
     ревизии в том, что это направления профессии. */
  announceZone(zi) {
    const zone = AG.CONTENT.zones[zi];
    if (this._zoneBanner) this._zoneBanner.destroy();
    const t = this.add.text(this.scale.width / 2, 74, '[ ' + zone.tag.toUpperCase() + ' ]', {
      fontFamily: 'Inter Tight, Arial, sans-serif', fontSize: '15px', color: '#262626',
      fontStyle: '600 15px Inter Tight'
    }).setLetterSpacing(2.4).setOrigin(0.5).setScrollFactor(0).setDepth(60).setAlpha(0);
    this._zoneBanner = t;
    this.tweens.add({
      targets: t, alpha: 1, duration: 320, yoyo: true, hold: 1500,
      onComplete: () => { t.destroy(); if (this._zoneBanner === t) this._zoneBanner = null; }
    });
  }

  // ------------------------------------------------------------ проверка
  startQuiz() {
    if (this._quizStarted) return;
    this._quizStarted = true;
    this.finished = true;
    this.physics.pause();
    this.hud.setVisible(false);
    AG.UI.hideChip();
    AG.UI.quiz(AG.CONTENT.elements, (results) => AG.UI.endScreen(AG.CONTENT.elements, results));
  }

  // Подправка угла: если на подъёме игрок зацепил край платформы одним углом
  // и вошёл в тайл на пару пикселей — сдвигаем вбок и возвращаем прыжок.
  cornerCorrect() {
    const b = this.player.body;
    if (!b.blocked.up || !(this._prevVy < 0)) return;
    const T = this.T, tol = 10;
    const top = b.top - 2;
    const solid = (t) => !!t && t.collides;
    const tl = this.groundLayer.getTileAtWorldXY(b.left + 2, top);
    const tr = this.groundLayer.getTileAtWorldXY(b.right - 2, top);
    let push = 0;
    if (solid(tl) && !solid(tr)) push = (tl.pixelX + T) - b.left + 1;
    else if (solid(tr) && !solid(tl)) push = -(b.right - tr.pixelX + 1);
    if (push !== 0 && Math.abs(push) <= tol) {
      this.player.x += push;
      this.player.setVelocityY(Math.min(-220, this._prevVy * 0.8));
    }
  }

  puff(x, y, dir) {
    for (let i = 0; i < 5; i++) {
      const s = 4 + ((Math.random() * 3) | 0);
      const r = this.add.rectangle(x + (Math.random() - 0.5) * 16, y - 2, s, s, 0xa9a9b4)
        .setDepth(4).setAlpha(0.85);
      this.tweens.add({
        targets: r,
        x: r.x + (Math.random() - 0.5) * 44 - dir * 14,
        y: r.y - Math.random() * 16,
        alpha: 0, scaleX: 0.25, scaleY: 0.25,
        duration: 280 + Math.random() * 220, ease: 'Cubic.easeOut',
        onComplete: () => r.destroy()
      });
    }
  }

  // Платформы двигаются вручную: тело статическое, поэтому не толкает игрока
  // само — перенос делаем явно, иначе игрок стоит на месте, а платформа уезжает.
  updateMovers(delta) {
    for (const m of this.movers) {
      m.t += delta / 1000;
      const mid = (m.x0 + m.x1) / 2, amp = (m.x1 - m.x0) / 2;
      const nx = mid + Math.sin(m.t * 1.05) * amp;   // период ~6 с, не 11
      const dx = nx - m.px;
      m.px = nx;
      m.img.x = nx;
      m.img.body.updateFromGameObject();
      const b = this.player.body;
      const onIt = b.blocked.down &&
        Math.abs(b.bottom - m.img.body.top) < 6 &&
        b.right > m.img.body.left && b.left < m.img.body.right;
      if (onIt) this.player.x += dx;
    }
  }

  // --------------------------------------------------------------- update
  update(time, delta) {
    if (this.assembling || this.finished) return;

    this.applyBackground(this.player.x);
    if (this.titleUp) return;   // мир живёт, игрок ждёт

    this.updateMovers(delta);

    // зона направления и станция сборки
    const zi = this.zoneAt(this.player.x);
    if (zi !== this.currentZone) {
      this.currentZone = zi;
      if (this._zonesSeen) { if (!this._zonesSeen.has(zi)) { this._zonesSeen.add(zi); this.announceZone(zi); } }
      else { this._zonesSeen = new Set([zi]); }
    }
    this.ambientMotes(time, zi);

    const e = this.currentElAt(this.player.x);
    if (e !== this.currentEl) { this.currentEl = e; this.refreshHud(); }

    const b = this.player.body;
    const onFloor = b.blocked.down || b.touching.down;
    if (onFloor) { this.lastGroundedAt = time; this.lastWallJumpSide = 0; }

    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const speed = 265;
    const locked = time < this.wallJumpLockUntil;
    if (!locked) {
      if (left && !right) this.player.setVelocityX(-speed);
      else if (right && !left) this.player.setVelocityX(speed);
      else this.player.setVelocityX(b.velocity.x * 0.72);
    }

    /* Скольжение по стене и прыжок от неё. Открывает вертикальные сцены и
       прощает недолёт, но нигде не является единственным путём: в шахте
       реставрации есть уступы под обычный прыжок. */
    const atWallL = b.blocked.left && left, atWallR = b.blocked.right && right;
    let sliding = false;
    if (!onFloor && (atWallL || atWallR) && b.velocity.y > 40) {
      this.player.setVelocityY(Math.min(b.velocity.y, 95));   // мягкое сползание
      this.wallSide = atWallL ? -1 : 1;
      sliding = true;
      this.lastGroundedAt = -9999;
    }
    const nearWall = (b.blocked.left || b.blocked.right) && !onFloor;
    if (nearWall) this.wallSide = b.blocked.left ? -1 : 1;

    const wantJump = time - this.jumpBufferedAt < 120;
    const canJump = time - this.lastGroundedAt < 110;
    if (wantJump && canJump) {
      this.player.setVelocityY(-640);
      this.jumpBufferedAt = -9999;
      this.tweens.add({ targets: this.player, scaleX: 0.84, scaleY: 1.14, duration: 90, yoyo: true });
      this.puff(this.player.x, b.bottom, 0);
      AG.SFX.jump();
    } else if (wantJump && nearWall &&
               time - this.lastWallJumpAt > 180 &&
               this.wallSide !== this.lastWallJumpSide) {
      /* Две защиты, и обе обязательны.
         Пауза 180 мс — потому что зажатый пробел повторяет keydown, и без неё
         прыжок срабатывал КАЖДЫЙ кадр: игрок уезжал вверх по любой стене.
         Смена стороны — потому что и с паузой одиночную стену можно перелезть,
         отскакивая от неё же. В шахте стены чередуются, цепочка работает;
         у стены прогресса сторона всегда одна, и второго прыжка не будет. */
      this.player.setVelocityY(-600);
      this.player.setVelocityX(-this.wallSide * 300);
      this.wallJumpLockUntil = time + 170;     // иначе зажатая клавиша гасит отскок
      this.jumpBufferedAt = -9999;
      this.lastWallJumpAt = time;
      this.lastWallJumpSide = this.wallSide;
      this.puff(this.player.x + this.wallSide * 10, b.center.y, this.wallSide);
      AG.SFX.jump();
    }

    const upHeld = this.cursors.up.isDown || this.keys.SPACE.isDown || this.keys.W.isDown;
    if (!upHeld && b.velocity.y < -320) this.player.setVelocityY(-320);

    this.cornerCorrect();

    // пружины: выброс вверх, без наказания за падение в промоину
    for (const s of this.springs) {
      if (Math.abs(this.player.x - s.x) < 26 && Math.abs(b.bottom - s.y) < 26 && b.velocity.y >= 0) {
        this.player.setVelocityY(-870);
        this.tweens.add({ targets: s.img, scaleY: { from: 0.55, to: 1 }, duration: 220, ease: 'Back.easeOut' });
        AG.SFX.jump();
      }
    }

    // приземление — сплющивание, пыль, короткая тряска камеры
    if (onFloor && !this._wasFloor && this._fallSpeed > 420) {
      this.tweens.add({ targets: this.player, scaleX: 1.16, scaleY: 0.86, duration: 90, yoyo: true });
      this.puff(this.player.x, b.bottom, 0);
      this.cameras.main.shake(90, 0.0035);
      AG.SFX.land();
    }
    this._wasFloor = onFloor;
    this._prevVy = this._fallSpeed;
    this._fallSpeed = b.velocity.y;

    const lead = Phaser.Math.Clamp(b.velocity.x * 0.30, -120, 120);
    this._lead = Phaser.Math.Linear(this._lead || 0, lead, 0.05);
    this.cameras.main.setFollowOffset(-this._lead, 0);

    // анимация: стойка / четыре кадра бега / прыжок / скольжение
    const moving = Math.abs(b.velocity.x) > 30;
    let pose = 'idle';
    if (sliding) pose = 'slide';
    else if (!onFloor) pose = 'jump';
    else if (moving) pose = 'run' + (1 + Math.floor(time / 95) % 4);
    if (this.player.texture.key !== 'guy_' + pose) this.player.setTexture('guy_' + pose);
    if (sliding) this.player.setFlipX(this.wallSide > 0);
    else if (moving) this.player.setFlipX(b.velocity.x < 0);
    this.player.rotation = (onFloor && moving) ? Math.sin(time / 60) * 0.04 : 0;

    // подбор фрагментов: дистанционная проверка (детерминированная)
    for (const p of this.pickupsData) {
      if (p.taken) continue;
      if (Math.abs(this.player.x - p.x) < 30 && Math.abs(this.player.y - p.y) < 40) this.collect(p);
    }

    // страховка: край мира всегда завершает уровень, а не упирается в пустоту
    if (this.player.x > this.WORLD_W - 96) { this.startQuiz(); return; }

    // триггеры досок сборки
    for (let i = 0; i < this.NEL; i++) {
      const bd = this.boards[i];
      if (!bd || this.assembledEls.has(i)) continue;
      if (Math.abs(this.player.x - bd.x) < 46 && Math.abs(this.player.y - bd.y) < 150) this.tryAssembly(i);
    }
  }
};
