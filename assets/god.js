// Stand-in engine: proves the switch, the loader and the build. Replaced by the real ink engine.
(() => {
  let layer = null;
  window.TDTC_GOD = {
    async enter(o) {
      if (!layer) { layer = document.createElement('div'); layer.className = 'god-layer'; document.body.append(layer); }
      if (o.animate) await layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'forwards' }).finished.catch(() => {});
      if (!o.arriving) o.toast('God mode on.');
    },
    async exit(o) {
      if (!layer) return;
      if (o.animate) await layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.catch(() => {});
      layer.remove(); layer = null;
    },
    beforeLeave() {}
  };
})();
