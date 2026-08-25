/* Игровая сцена: уровень из трёх зон, подбор фрагментов, ручная сборка кликом,
   карточки термина после замыкания силуэта, финальная проверка узнаванием. */
window.AG = window.AG || {};

AG.PlayScene = class extends Phaser.Scene {
  constructor() { super('play'); }

  create() {
    const T = (this.T = 32);
    this.COLS = 230;
    this.ROWS = 36;
    this.WORLD_W = this.COLS * T;
    this.WORLD_H = this.ROWS * T;

    AG.TEXTURES.build(this);

    this.addBackground();
    this.buildLevel();

    this.fragmentsLeft = [null, null, null]; // по зонам
    this.collected = [[], [], []];
    this.assembledZones = new Set();
    this.currentZone = -1;
    this.selectedPiece = null;
    this.assembling = false;
    this.finished = false;

    this.setupPlayer();
    this.setupHud();
    this.setupColliders();

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, this.WORLD_W, this.WORLD_H);
    this.cameras.main.setDeadzone(120, 160);

    // Первый тост — управление, без экрана управления и меню (vision)
    AG.UI.toast(AG.CONTENT.toasts[0].id, AG.CONTENT.toasts[0].text);
    AG.UI.anyKeyCloses();

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.assembling || this.finished) return;
      AG.UI.togglePause((p) => (p ? this.physics.pause() : this.physics.resume()));
    });
  }

  // ---------------------------------------------------------------- уровень
  buildLevel() {
    const T = this.T;
    const G = Array.from({ length: this.ROWS }, () => new Array(this.COLS).fill(-1));
    const fill = (c0, r0, c1, r1) => {
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) G[r][c] = 1;
    };
    const clear = (c0, r0, c1, r1) => {
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) G[r][c] = -1;
    };

    // основной грунт
    fill(0, 30, this.COLS - 1, 35);
    // безопасный коридор: ступенька и учебный «обрыв» на уступ ниже
    fill(14, 29, 19, 29);
    clear(24, 30, 27, 32);         // дно промаха (пол — строка 33)
    fill(27, 32, 27, 32);          // ступень возврата

    // --- зона 1 (карниз): башня из платформ ---
    const z1 = [
      [42, 45, 27], [48, 51, 24], [54, 57, 21], [49, 52, 18]
    ];
    z1.forEach(([c0, c1, r]) => fill(c0, r, c1, r));

    // --- зона 2 (арочное окно): плато и две башни ---
    fill(84, 28, 97, 29);
    fill(88, 27, 89, 27);
    fill(99, 27, 100, 27);         // промежуточная ступень через гэп
    const z2 = [
      [104, 107, 26], [110, 113, 23], [116, 119, 26],
      [120, 123, 22], [114, 117, 19], [108, 111, 16]
    ];
    z2.forEach(([c0, c1, r]) => fill(c0, r, c1, r));

    // --- зона 3 (двутавр): долина и высокая башня ---
    clear(162, 30, 175, 32);       // дно долины (пол — строка 33)
    fill(172, 32, 173, 32);        // ступень возврата из долины
    const z3 = [
      [184, 187, 27], [191, 194, 23], [198, 201, 19]
    ];
    z3.forEach(([c0, c1, r]) => fill(c0, r, c1, r));

    // поверхность против глубины: solid-клетка, над которой пусто, — это верх,
    // всё остальное уходит в основание вторым тайлом
    for (let r = 0; r < this.ROWS; r++)
      for (let c = 0; c < this.COLS; c++)
        if (G[r][c] !== -1 && r > 0 && G[r - 1][c] !== -1) G[r][c] = 2;

    const map = this.make.tilemap({ data: G, tileWidth: T, tileHeight: T });
    const ts = map.addTilesetImage('tiles', 'tiles', T, T, 0, 0, 1);
    const layer = map.createLayer(0, ts, 0, 0);
    layer.setCollisionByExclusion([-1]);
    this.groundLayer = layer;

    // пикапы: над центром каждой платформы (подбор — дистанционный, без физики)
    const mkPickups = (elIdx, plats) =>
      plats.slice(0, AG.CONTENT.elements[elIdx].pieces.length).map(([c0, c1, r], i) => ({
        elIdx, pieceId: AG.CONTENT.elements[elIdx].pieces[i].id, taken: false,
        x: ((c0 + c1 + 1) / 2) * T, y: r * T - 34
      }));
    this.pickupsData = [
      ...mkPickups(0, z1),
      ...mkPickups(1, z2),
      ...mkPickups(2, z3)
    ];

    for (const p of this.pickupsData) {
      const el = AG.CONTENT.elements[p.elIdx];
      const ring = this.add.image(p.x, p.y, 'ring').setAlpha(0.85).setDepth(2);
      this.tweens.add({ targets: ring, scale: 1.18, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
      // центруем по самой фигуре, иначе кольцо висит сбоку от фрагмента
      const m = this.fitPiece(el, p.pieceId, 62, 40, 0.55);
      const icon = this.add.image(p.x - m.dx, p.y - m.dy,
        'frag_' + el.id + '_' + p.pieceId + '_acc').setScale(m.scale).setDepth(3);
      p.ring = ring; p.icon = icon;
    }

    // доски сборки и стены прогресса по зонам
    this.boards = [];
    this.walls = [];
    const zoneDefs = [
      { elIdx: 0, boardCol: 66, wallCol: 71 },
      { elIdx: 1, boardCol: 140, wallCol: 145 },
      { elIdx: 2, boardCol: 214, wallCol: 219 }
    ];
    for (const zd of zoneDefs) {
      const bx = zd.boardCol * T, wx = zd.wallCol * T;
      const board = this.add.image(bx, 29 * T - 60, 'board').setDepth(3);
      const dots = this.add.graphics({ x: bx, y: 29 * T - 60 }).setDepth(4);
      this.drawDots(dots, zd.elIdx, 0);
      this.boards[zd.elIdx] = { img: board, dots, def: zd };

      const wtex = this.textures.exists('wall') ? 'wall' : null;
      if (!wtex) {
        const c = document.createElement('canvas'); c.width = 10; c.height = 32;
        const g = c.getContext('2d');
        g.strokeStyle = AG.PALETTE.orange; g.lineWidth = 4; g.setLineDash([6, 6]);
        g.beginPath(); g.moveTo(5, 0); g.lineTo(5, 32); g.stroke();
        this.textures.addCanvas('wall', c);
      }
      const wallH = 26 * T;
      const wallImg = this.add.tileSprite(wx, 17 * T, 10, wallH, 'wall').setOrigin(0.5, 0).setDepth(4);
      // барьер во всю нарисованную высоту: раньше тело было 32x32 и стена перепрыгивалась
      const body = this.add.zone(wx, 17 * T + wallH / 2, 18, wallH);
      this.physics.add.existing(body, true);
      this.walls[zd.elIdx] = { img: wallImg, body, collider: null };
    }
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

  addBackground() {
    const W = this.scale.width, H = this.scale.height;
    this.skyRect = this.add.rectangle(0, 0, W, H * 2, 0xf7f7f7).setOrigin(0, 0).setScrollFactor(0).setDepth(-20);
    // звёзды и светило (ночь)
    this.stars = this.add.tileSprite(0, 0, W, 340, 'stars').setOrigin(0, 0)
      .setScrollFactor(0).setDepth(-18).setAlpha(0);
    this.sunmoon = this.add.image(130, 88, 'sunmoon').setScrollFactor(0).setDepth(-17).setScale(0.9);
    // миллиметровка на весь мир
    this.grid = this.add.tileSprite(0, 0, this.WORLD_W, this.WORLD_H, 'grid').setOrigin(0, 0).setDepth(-15);
    // город: три слоя + ночные окна
    const mkCity = (key, y, h, factor) => {
      const day = this.add.tileSprite(0, y, W, h, key).setOrigin(0, 0)
        .setScrollFactor(0).setDepth(-11);
      const night = this.add.tileSprite(0, y, W, h, key + '_lights').setOrigin(0, 0)
        .setScrollFactor(0).setDepth(-11).setAlpha(0);
      return { day, night, factor };
    };
    this.cityFar = mkCity('city_far', H - 310, 310, 0.15);
    this.cityMid = mkCity('city_mid', H - 250, 250, 0.35);
    this.cityNear = mkCity('city_near', H - 190, 190, 0.6);
    this.cityLayers = [this.cityFar, this.cityMid, this.cityNear];
    this._nf = 0;
  }

  // 0 = день (зона 1), 1 = ночь (зона 3), плавный переход через зону 2
  nightTarget(x) {
    if (x < 2000) return 0;
    if (x > 4700) return 1;
    const t = (x - 2000) / 2700;
    return t * t * (3 - 2 * t); // smoothstep
  }

  applyNight(nf) {
    this._nf += (nf - this._nf) * 0.03;
    const nf2 = this._nf;
    const sky = AG.mixInt(AG.DAY_SKY, AG.NIGHT_SKY, nf2);
    this.skyRect.fillColor = sky;
    document.body.style.background = AG.mix(AG.DAY_SKY, AG.NIGHT_SKY, nf2);
    this.grid.setAlpha(1 - nf2 * 0.85);
    this.stars.setAlpha(nf2 * 0.9);
    // здания темнеют, окна загораются
    const tint = AG.mixInt([255, 255, 255], [82, 88, 102], nf2);
    for (const l of this.cityLayers) {
      l.day.setTint(tint);
      l.night.setAlpha(nf2 * 0.95);
    }
    // светило: тёплое солнце -> бледная луна
    this.sunmoon.setTint(AG.mixInt([242, 141, 5], [214, 220, 230], nf2));
    this.sunmoon.setAlpha(0.85 - nf2 * 0.25);
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
    this.input.keyboard.on('keydown-SPACE', () => (this.jumpBufferedAt = this.time.now));
    this.input.keyboard.on('keydown-W', () => (this.jumpBufferedAt = this.time.now));
    this.input.keyboard.on('keydown-UP', () => (this.jumpBufferedAt = this.time.now));
  }

  setupHud() {
    const W = this.scale.width;
    this.hud = this.add.container(W - 62, 52).setScrollFactor(0).setDepth(50);
    this.hudGfx = this.add.graphics();
    this.hud.add(this.hudGfx);
    this.hudIcons = this.add.container(0, 0);
    this.hud.add(this.hudIcons);
    this.hud.setVisible(false);
    AG.UI.setChip('фрагменты::00/04');
  }

  drawHudPanel(n) {
    const g = this.hudGfx;
    g.clear();
    const h = Math.max(2, n) * 46 + 26;
    g.fillStyle(0x262626, 0.10); g.fillRoundedRect(-32, -38, 80, h, 16);   // мягкая тень
    g.fillStyle(0xffffff, 1); g.fillRoundedRect(-35, -41, 80, h, 16);
    g.lineStyle(2, AG.PALETTE.ink, 1); g.strokeRoundedRect(-35, -41, 80, h, 16);
  }

  refreshHud() {
    this.hudIcons.removeAll(true);
    if (this.currentZone < 0) { this.hud.setVisible(false); return; }
    if (this.finished || this.assembling) { this.hud.setVisible(false); AG.UI.hideChip(); return; }
    const el = AG.CONTENT.elements[this.currentZone];
    const got = this.collected[this.currentZone];
    // панель появляется с первым фрагментом: пустая белая коробка ничего не сообщает
    if (!got.length) {
      this.hud.setVisible(false);
      AG.UI.setChip('фрагменты::00/0' + el.pieces.length);
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
    AG.UI.setChip('фрагменты::0' + got.length + '/0' + el.pieces.length);
  }

  setupColliders() {
    this.physics.add.collider(this.player, this.groundLayer);
    for (const w of this.walls) {
      if (w) w.collider = this.physics.add.collider(this.player, w.body);
    }
    // триггеры досок: дистанционные зоны
    this.boardXs = [];
    for (const b of this.boards) {
      this.boardXs.push({ elIdx: b.def.elIdx, x: b.def.boardCol * this.T });
    }
  }

  // ---------------------------------------------------------------- сбор
  collect(p) {
    p.taken = true;
    this.collected[p.elIdx].push(p.pieceId);
    const el = AG.CONTENT.elements[p.elIdx];

    // полёт в панель: панель прибита к экрану, переводим её точку в мир
    const cam = this.cameras.main;
    this.tweens.add({
      targets: [p.icon, p.ring],
      x: cam.scrollX + this.hud.x, y: cam.scrollY + this.hud.y,
      scale: 0.2, alpha: 0.2, duration: 420, ease: 'Cubic.easeIn',
      onComplete: () => {
        p.icon.destroy(); p.ring.destroy();
        this.refreshHud();
      }
    });

    // второй тост — про панель, только раз и до первого замыкания
    AG.UI.toast(AG.CONTENT.toasts[1].id, AG.CONTENT.toasts[1].text);

    const b = this.boards[p.elIdx];
    if (b) this.drawDots(b.dots, p.elIdx, this.collected[p.elIdx].length);
  }

  currentZoneAt(x) {
    if (x < 2400) return 0;
    if (x < 4800) return 1;
    return 2;
  }

  tryAssembly(elIdx) {
    if (this.assembling || this.assembledZones.has(elIdx)) return;
    if (this.collected[elIdx].length < AG.CONTENT.elements[elIdx].pieces.length) {
      // мягкая подсказка без текста: доска пульсирует
      if (!this._pulseAt || this.time.now - this._pulseAt > 900) {
        this._pulseAt = this.time.now;
        this.tweens.add({
          targets: this.boards[elIdx].img,
          scale: { from: 1, to: 1.08 }, duration: 130, yoyo: true
        });
      }
      return;
    }
    this.openAssembly(elIdx);
  }

  // ------------------------------------------------------- сборка кликом
  openAssembly(elIdx) {
    this.assembling = true;
    this.physics.pause();
    this.selectedPiece = null;
    const el = AG.CONTENT.elements[elIdx];
    const ui = {};
    this.asmUi = ui;

    const W = this.scale.width, H = this.scale.height;
    const cx = W / 2;
    const n0 = el.pieces.length;
    const trayGap = 62;
    const cardW = Math.min(640, W - 40);
    const cardH = Math.min(H - 40, Math.max(n0 * trayGap + 104, 300));
    const cardT = Math.round((H - cardH) / 2);

    ui.dim = this.add.rectangle(cx, H / 2, W, H, 0x262626, 0.38).setScrollFactor(0).setDepth(200).setInteractive();
    ui.card = this.add.graphics().setScrollFactor(0).setDepth(201);
    ui.card.fillStyle(0xffffff, 1); ui.card.fillRoundedRect(cx - cardW / 2, cardT, cardW, cardH, 24);
    ui.card.lineStyle(2, AG.PALETTE.ink, 1); ui.card.strokeRoundedRect(cx - cardW / 2, cardT, cardW, cardH, 24);
    this.hud.setVisible(false);
    AG.UI.hideChip();

    // машинные метки и подсказка внутри карточки
    const trayX = cx + cardW * 0.30;
    ui.texts = [];
    const mkText = (x, y, str, size, color, origin) => {
      const t = this.add.text(x, y, str, {
        fontFamily: 'Inter Tight, Arial, sans-serif', fontSize: size + 'px',
        color, fontStyle: '400 ' + size + 'px Inter Tight'
      }).setLetterSpacing(0.5).setScrollFactor(0).setDepth(205).setOrigin(origin || 0);
      ui.texts.push(t);
      return t;
    };
    mkText(cx - cardW / 2 + 20, cardT + 16, '[ СБОРКА :: 0' + (elIdx + 1) + ' ]', 11, '#5c5c5c');
    mkText(trayX, cardT + 22, '[ ФРАГМЕНТЫ ]', 11, '#5c5c5c', 0.5);
    const hint = this.add.text(cx - cardW * 0.22, cardT + cardH - 30,
      'Выбери фрагмент — поставь на своё место', {
        fontFamily: 'Inter Tight, Arial, sans-serif', fontSize: '12px', color: '#5c5c5c'
      }).setLetterSpacing(0.3).setScrollFactor(0).setDepth(205).setOrigin(0.5, 1);
    ui.texts.push(hint);

    // форма крупно слева: слоты в масштабе
    const fit = Math.min((cardH - 96) / el.view.h, (cardW * 0.5) / el.view.w);
    const ox = cx - cardW * 0.22, oy = cardT + cardH / 2;
    ui.slotImgs = {};
    for (const piece of el.pieces) {
      // все фрагменты — вырезки одного канваса (view + pad), поэтому
      // каждый слот ставится в одну и ту же точку: пад отменяется
      const s = this.add.image(ox, oy, 'slot_' + el.id + '_' + piece.id)
        .setScale(fit).setScrollFactor(0).setDepth(202);
      // точный хит-ареал по контуру: прозрачные углы текстуры не ловят клики
      const pad = 6;
      const poly = new Phaser.Geom.Polygon(
        piece.loops[0].map(p => new Phaser.Geom.Point(p[0] + pad, p[1] + pad))
      );
      s.setInteractive(poly, Phaser.Geom.Polygon.Contains);
      s.pieceId = piece.id;
      s.on('pointerdown', () => this.tryPlace(elIdx, piece.id));
      ui.slotImgs[piece.id] = s;
    }

    // лоток фрагментов справа
    ui.tray = [];
    ui.trayY0 = cardT + 58;
    ui.trayGap = trayGap;
    el.pieces.forEach((piece, i) => {
      const m = this.fitPiece(el, piece.id, 150, 52, 0.5);
      const ts = m.scale;
      const t = this.add.image(trayX - m.dx, ui.trayY0 + i * trayGap - m.dy,
        'frag_' + el.id + '_' + piece.id + '_acc')
        .setScale(ts).setScrollFactor(0).setDepth(203);
      t.dyOff = m.dy;
      const poly = new Phaser.Geom.Polygon(
        piece.loops[0].map(p => new Phaser.Geom.Point(p[0] + 6, p[1] + 6))
      );
      t.setInteractive(poly, Phaser.Geom.Polygon.Contains);
      t.pieceId = piece.id;
      t.baseScale = ts;
      t.on('pointerdown', () => this.selectTrayItem(t));
      ui.tray.push(t);
    });

    ui.elIdx = elIdx;
    ui.placedCount = 0;
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
    // подсветить все пустые слоты лёгким пульсом
    Object.values(this.asmUi.slotImgs).forEach(s => {
      if (!s.filled) this.tweens.add({ targets: s, alpha: { from: 1, to: 0.55 }, duration: 260, yoyo: true });
    });
  }

  tryPlace(elIdx, pieceId) {
    const ui = this.asmUi;
    if (!this.selectedPiece) return;
    if (this.selectedPiece.pieceId !== pieceId) {
      // промах: фрагмент не встал, пробуй снова, без наказания
      const it = this.selectedPiece;
      this.tweens.add({
        targets: it, x: { from: it.x - 8, to: it.x }, duration: 160, ease: 'Sine.easeInOut'
      });
      this.selectedPiece = null;
      it.setScale(it.baseScale);
      return;
    }
    // верное место
    const el = AG.CONTENT.elements[elIdx];
    const slot = ui.slotImgs[pieceId];
    const item = this.selectedPiece;
    this.tweens.add({
      targets: item,
      x: slot.x, y: slot.y, scale: slot.scaleX, alpha: 0,
      duration: 200, ease: 'Cubic.easeOut',
      onComplete: () => item.destroy()
    });
    slot.setTexture('frag_' + el.id + '_' + pieceId + '_ink');
    slot.filled = true;
    slot.disableInteractive();
    this.selectedPiece = null;
    ui.tray = ui.tray.filter(t => t !== item);
    ui.tray.forEach((t, i) => this.tweens.add({
      targets: t, y: ui.trayY0 + i * ui.trayGap - t.dyOff, duration: 200, ease: 'Cubic.easeOut'
    }));

    ui.placedCount++;
    if (ui.placedCount >= el.pieces.length) this.completeAssembly(elIdx);
  }

  completeAssembly(elIdx) {
    const ui = this.asmUi;
    const el = AG.CONTENT.elements[elIdx];
    this.assembledZones.add(elIdx);

    // секунда тишины с готовым элементом
    this.time.delayedCall(250, () => {
      Object.values(ui.slotImgs).forEach(s => s.destroy());
      ui.tray.forEach(t => t.destroy());
      (ui.texts || []).forEach(t => t.destroy());
      const full = this.add.image(this.scale.width / 2, this.scale.height / 2, 'full_' + el.id)
        .setScrollFactor(0).setDepth(204).setScale(0.6).setAlpha(0);
      ui.full = full;
      this.tweens.add({ targets: full, scale: 1, alpha: 1, duration: 450, ease: 'Back.easeOut' });

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
    this.hud.setVisible(true);
    this.refreshHud();

    // снять стену зоны
    const w = this.walls[elIdx];
    if (w) {
      this.tweens.add({
        targets: w.img, alpha: 0, duration: 400,
        onComplete: () => { w.img.destroy(); }
      });
      if (w.collider) this.physics.world.removeCollider(w.collider);
      w.body.destroy();
      this.walls[elIdx] = null;
    }

    if (elIdx === 2) this.startQuiz();
  }

  // ------------------------------------------------------------ проверка
  startQuiz() {
    this.finished = true;
    this.physics.pause();
    this.hud.setVisible(false);
    AG.UI.hideChip();
    AG.UI.quiz(AG.CONTENT.elements, (results) => {
      AG.UI.endScreen(AG.CONTENT.elements, results);
    });
  }

  // --------------------------------------------------------------- update
  update(time, delta) {
    void delta;
    if (this.assembling || this.finished) return;

    // фон-параллакс
    const sx = this.cameras.main.scrollX;
    for (const l of this.cityLayers) l.day.tilePositionX = sx * l.factor;
    for (const l of this.cityLayers) l.night.tilePositionX = sx * l.factor;
    this.stars.tilePositionX = sx * 0.06;
    this.applyNight(this.nightTarget(this.player.x));

    // зона для панели
    const z = this.currentZoneAt(this.player.x);
    if (z !== this.currentZone) {
      this.currentZone = z;
      this.refreshHud();
    }

    const onFloor = this.player.body.blocked.down || this.player.body.touching.down;
    if (onFloor) this.lastGroundedAt = time;

    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const speed = 265;
    if (left && !right) this.player.setVelocityX(-speed);
    else if (right && !left) this.player.setVelocityX(speed);
    else this.player.setVelocityX(this.player.body.velocity.x * 0.72);

    // прыжок: coyote + буфер + переменная высота
    const wantJump = time - this.jumpBufferedAt < 120;
    const canJump = time - this.lastGroundedAt < 110;
    if (wantJump && canJump) {
      this.player.setVelocityY(-640);
      this.jumpBufferedAt = -9999;
      this.tweens.add({ targets: this.player, scaleX: 0.84, scaleY: 1.14, duration: 90, yoyo: true });
    }
    const upHeld = this.cursors.up.isDown || this.keys.SPACE.isDown || this.keys.W.isDown;
    if (!upHeld && this.player.body.velocity.y < -320) this.player.setVelocityY(-320);

    // приземление — сплющивание
    if (onFloor && !this._wasFloor && this._fallSpeed > 420) {
      this.tweens.add({ targets: this.player, scaleX: 1.16, scaleY: 0.86, duration: 90, yoyo: true });
    }
    this._wasFloor = onFloor;
    this._fallSpeed = this.player.body.velocity.y;

    // анимация персонажа: стойка / бег / прыжок
    const moving = Math.abs(this.player.body.velocity.x) > 30;
    let pose = 'idle';
    if (!onFloor) pose = 'jump';
    else if (moving) pose = Math.floor(time / 110) % 2 ? 'run1' : 'run2';
    if (this.player.texture.key !== 'guy_' + pose) this.player.setTexture('guy_' + pose);
    // лёгкое покачивание при беге
    if (onFloor && moving) {
      this.player.rotation = Math.sin(time / 60) * 0.04;
    } else this.player.rotation = 0;

    // подбор фрагментов: дистанционная проверка (детерминированная)
    for (const p of this.pickupsData) {
      if (p.taken) continue;
      if (Math.abs(this.player.x - p.x) < 30 && Math.abs(this.player.y - p.y) < 40) this.collect(p);
    }
    // страховка: край мира всегда завершает уровень, а не упирается в пустоту
    if (this.player.x > this.WORLD_W - 96) { this.startQuiz(); return; }
    // триггеры досок сборки
    for (const b of this.boardXs) {
      if (Math.abs(this.player.x - b.x) < 46 && this.player.y > 780) this.tryAssembly(b.elIdx);
    }
  }
};
