/* Конфиг Phaser 3: arcade-физика, тайлмапы, статика без сборки (скоуп п.11–12). */
window.AG = window.AG || {};

window.addEventListener('load', () => {
  // Гейт ловит тач-ввод, а не узкое окно: игра требует клавиатуры, а не ширины.
  // Раньше десктоп в окне уже 900 px получал заглушку «открой на компьютере».
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  if (coarse && noHover) {
    document.getElementById('app').style.display = 'none';
    AG.UI.mobileGate();
    return;
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: 854,
    height: 480,
    backgroundColor: '#f7f7f7',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 1400 }, debug: false }
    },
    scene: [AG.PlayScene]
  });
  window.GAME = game;
});
