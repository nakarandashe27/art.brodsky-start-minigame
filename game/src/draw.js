/* Рисование полигонов-колец на canvas/svg. Плоский вектор: заливка + обводка. */
window.AG = window.AG || {};

AG.PALETTE = {
  paper: '#f7f7f7',       // светлая секция — небо
  paperDeep: '#e9e9e9',
  ink: '#262626',         // тёмные поверхности
  inkSoft: 'rgba(38,38,46,0.55)',
  accent: '#f74c2e',      // брендовый красно-оранжевый — фрагменты
  orange: '#f28d05',      // акцент маркеров
  blue: '#4d61f4',        // CTA
  lime: '#d0e97e',        // счётчики, успех
  sky: '#f7f7f7'
};

// Фирменный градиент 135° (не перекрашивать и не разворачивать)
AG.brandGradient = function (ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#f74c2e');
  g.addColorStop(0.55, '#f28d05');
  g.addColorStop(1, '#d0e97e');
  return g;
};

// смешение двух цветов [r,g,b] в CSS
AG.mix = function (a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
};
AG.mixInt = function (a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return (r << 16) | (g << 8) | bl;
};
AG.DAY_SKY = [247, 247, 247];
AG.NIGHT_SKY = [18, 21, 27];

/* Обвести и залить кольца точек [[x,y],...] с масштабом и сдвигом.
   beginPath — ОДИН раз на все кольца: каждое следующее открывается moveTo как
   подпуть. Раньше beginPath стоял внутри цикла и обнулял путь, поэтому из
   фигуры с несколькими кольцами на canvas рисовалось только последнее —
   у скамьи оставалась одна ножка. В SVG (loopsToSvg) этой ошибки не было,
   поэтому в проверке узнаванием фигуры выглядели целыми, а во фрагментах нет. */
AG.traceLoops = function (ctx, loops, scale, ox, oy) {
  ctx.beginPath();
  for (const loop of loops) {
    loop.forEach((p, i) => {
      const x = ox + p[0] * scale, y = oy + p[1] * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
};

AG.fillLoops = function (ctx, loops, scale, ox, oy, fill, stroke, lw) {
  AG.traceLoops(ctx, loops, scale, ox, oy);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw || 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
};

// SVG path из колец — для DOM-оверлеев (викторина, финал)
AG.loopsToSvg = function (loops, w, h, fill, stroke, lw) {
  const d = loops.map(loop =>
    'M' + loop.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z'
  ).join('');
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="' + d + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' +
    (lw || 0) + '" stroke-linejoin="round"/></svg>';
};

/* ---------------------------------------------------------------------------
   Пиксельный слой. Мир (тайлы, персонаж, город, небо) рисуется в низком
   разрешении и увеличивается без сглаживания. Архитектурные элементы —
   фрагменты, силуэты, варианты проверки — остаются вектором: на мелкой сетке
   двутавр и швеллер сливаются, а именно это различие игра и должна вбить.
   --------------------------------------------------------------------------- */
AG.pixelCanvas = function (w, h, scale, draw) {
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  const sg = small.getContext('2d');
  sg.imageSmoothingEnabled = false;
  // px(цвет, x, y, ширина=1, высота=1) — один пиксель-блок в низком разрешении
  const px = (color, x, y, pw, ph) => {
    sg.fillStyle = color;
    sg.fillRect(x | 0, y | 0, pw === undefined ? 1 : pw, ph === undefined ? 1 : ph);
  };
  draw(sg, px);
  const big = document.createElement('canvas');
  big.width = w * scale; big.height = h * scale;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(small, 0, 0, w * scale, h * scale);
  return big;
};
