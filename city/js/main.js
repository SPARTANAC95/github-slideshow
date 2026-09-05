// Bootstrap: build or load a world, run the clock, wire up rendering and UI.
(function () {
  const SPEEDS = [0, 1.5, 5, 15, 45]; // ticks (hours) per second
  class App {
    constructor() {
      this.speedIdx = 2; this.acc = 0; this.lastSave = Date.now(); this.lastFrame = performance.now();
      const seedFromHash = (location.hash.match(/seed=([^&]+)/) || [])[1];
      let world = null;
      if (!seedFromHash) world = World.load();
      if (!world) { world = new World(seedFromHash ? decodeURIComponent(seedFromHash) : randomSeed()); world.generate(); }
      this.world = world;
      this.renderer = new Renderer(document.getElementById('map'), world);
      this.renderer.onSelectCitizen = c => this.ui.openCitizen(c.id);
      this.renderer.onSelectLocation = id => this.ui.openLocation(id);
      this.renderer.onSelectDistrict = d => this.ui.openLocation(d.locations[0].id);
      this.ui = new UI(this);
      this.ui.rebuildFeed();
      this.ui.refresh(true);
      this.bind();
      world.onDay = () => this.maybeSave();
      this.updateSpeedUI();
      requestAnimationFrame(t => this.frame(t));
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.world.save(); });
      window.addEventListener('pagehide', () => this.world.save());
      this.ui.toast(world.tick ? 'Welcome back to Pebbleton.' : 'A new city. Tap anyone to meet them.');
      setTimeout(() => document.getElementById('maphint').classList.add('fade'), 9000);
    }
    bind() {
      document.getElementById('play').addEventListener('click', () => { this.speedIdx = this.speedIdx === 0 ? (this.prevSpeed || 2) : (this.prevSpeed = this.speedIdx, 0); this.updateSpeedUI(); });
      document.querySelectorAll('.spd').forEach(b => b.addEventListener('click', () => { this.speedIdx = +b.dataset.spd; this.updateSpeedUI(); }));
      document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.key === ' ') { e.preventDefault(); document.getElementById('play').click(); } if (e.key >= '1' && e.key <= '4') { this.speedIdx = +e.key; this.updateSpeedUI(); } if (e.key === 'Escape') this.ui.closeSheet(); });
    }
    updateSpeedUI() {
      document.getElementById('play').textContent = this.speedIdx === 0 ? '▶' : '⏸';
      document.querySelectorAll('.spd').forEach(b => b.classList.toggle('on', +b.dataset.spd === this.speedIdx));
    }
    frame(t) {
      const dt = Math.min(0.1, (t - this.lastFrame) / 1000); this.lastFrame = t;
      const speed = SPEEDS[this.speedIdx];
      if (speed > 0) {
        this.acc += dt * speed;
        let n = 0;
        while (this.acc >= 1 && n < 60) { this.world.step(); this.acc -= 1; n++; }
        if (n) this.ui.refresh(false);
      }
      this.renderer.draw(dt);
      requestAnimationFrame(tt => this.frame(tt));
    }
    jump(days) {
      const w = this.world;
      for (let i = 0; i < days * 24; i++) w.step();
      this.ui.rebuildFeed(); this.ui.refresh(true); this.maybeSave(true);
      this.ui.toast(`Skipped ${days} day${days === 1 ? '' : 's'}.`);
    }
    maybeSave(force) { const now = Date.now(); if (force || now - this.lastSave > 20000) { this.world.save(); this.lastSave = now; } }
    newCity(seed) {
      seed = (seed || '').trim();
      World.clearSave();
      const w = new World(seed || randomSeed());
      w.generate();
      this.world = w; w.onDay = () => this.maybeSave();
      this.renderer.setWorld(w); this.ui.setWorld(w);
      this.ui.rebuildFeed(); this.ui.refresh(true); this.ui.setTab('feed');
      try { history.replaceState(null, '', '#seed=' + encodeURIComponent(w.seed)); } catch (e) { }
      this.ui.toast(`Welcome to a brand new Pebbleton (seed ${w.seed}).`);
    }
  }
  function randomSeed() { const words = ['pebble', 'goose', 'noodle', 'herring', 'courgette', 'bell', 'pigeon', 'ferry', 'bin', 'moon', 'thistle', 'otter', 'kettle', 'plinth']; return words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(Math.random() * 9000 + 1000); }
  window.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
})();
