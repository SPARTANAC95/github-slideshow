// Canvas map: districts, places, and citizens drifting between them.
(function () {
  const D = window.DATA;
  const W = 1000, H = 820;
  const LAYOUT = {
    uptown: [20, 20, 300, 230], commons: [340, 20, 320, 230], uni: [680, 20, 300, 230],
    steel: [20, 280, 300, 230], green: [340, 280, 320, 230], night: [680, 280, 300, 230],
    docks: [20, 540, 960, 230],
  };
  const locPos = {};
  for (const d of D.DISTRICTS) {
    const [x, y, w, h] = LAYOUT[d.id];
    const n = d.locations.length;
    d.locations.forEach((l, i) => {
      let px, py;
      if (d.id === 'docks') { px = x + w * (i + 0.5) / n; py = y + h * 0.55; }
      else if (n <= 3) { px = x + w * (i + 0.5) / n; py = y + h * 0.55; }
      else { const top = Math.ceil(n / 2), bottom = n - top; if (i < top) { px = x + w * (i + 0.5) / top; py = y + h * 0.36; } else { px = x + w * (i - top + 0.5) / bottom; py = y + h * 0.76; } }
      locPos[l.id] = { x: px, y: py };
    });
  }

  class Renderer {
    constructor(canvas, world) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.world = world;
      this.scale = 1; this.tx = 0; this.ty = 0; this.zoom = 1; this.panX = 0; this.panY = 0;
      this.selected = null; this.selectedGroup = null; this.pulse = 0;
      this.jitter = {};
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.bindPointer();
    }
    setWorld(w) { this.world = w; this.jitter = {}; }
    resize() {
      const r = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.cw = r.width; this.ch = r.height;
      this.canvas.width = r.width * dpr; this.canvas.height = r.height * dpr;
      this.canvas.style.width = r.width + 'px'; this.canvas.style.height = r.height + 'px';
      this.dpr = dpr;
      this.scale = Math.min(r.width / W, r.height / H);
      this.tx = (r.width - W * this.scale) / 2; this.ty = (r.height - H * this.scale) / 2;
    }
    // world -> screen
    toScreen(x, y) { const s = this.scale * this.zoom; return [x * s + this.tx * this.zoom + this.panX, y * s + this.ty * this.zoom + this.panY]; }
    toWorld(sx, sy) { const s = this.scale * this.zoom; return [(sx - this.tx * this.zoom - this.panX) / s, (sy - this.ty * this.zoom - this.panY) / s]; }
    jit(c) {
      let j = this.jitter[c.id];
      if (!j) { const a = (c.id * 2.399) % (Math.PI * 2), r = 7 + (c.id * 7 % 10); j = this.jitter[c.id] = { dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.7, phase: c.id * 0.7 }; }
      return j;
    }
    targetOf(c) { const p = locPos[c.loc] || locPos[c.home]; const j = this.jit(c); return [p.x + j.dx, p.y + j.dy]; }
    bindPointer() {
      const cv = this.canvas;
      let pointers = new Map(), lastDist = 0, moved = false, start = null, lastTap = 0;
      cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); moved = false; start = [e.clientX, e.clientY, this.panX, this.panY]; if (pointers.size === 2) lastDist = dist(pointers); });
      cv.addEventListener('pointermove', e => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, [e.clientX, e.clientY]);
        if (pointers.size === 2) {
          const d = dist(pointers); if (lastDist) { const r = cv.getBoundingClientRect(); const pts = [...pointers.values()]; const cx = (pts[0][0] + pts[1][0]) / 2 - r.left, cy = (pts[0][1] + pts[1][1]) / 2 - r.top; this.zoomAt(cx, cy, d / lastDist); }
          lastDist = d; moved = true;
        } else if (start) {
          const dx = e.clientX - start[0], dy = e.clientY - start[1];
          if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
          if (moved) { this.panX = start[2] + dx; this.panY = start[3] + dy; }
        }
      });
      const up = e => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) lastDist = 0;
        if (!moved && start && pointers.size === 0) {
          const now = Date.now();
          const r = cv.getBoundingClientRect();
          if (now - lastTap < 300) { this.zoom = 1; this.panX = 0; this.panY = 0; }
          else this.tap(e.clientX - r.left, e.clientY - r.top);
          lastTap = now;
        }
        start = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 0.87); }, { passive: false });
      function dist(m) { const p = [...m.values()]; return Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); }
    }
    zoomAt(cx, cy, f) {
      const nz = clamp(this.zoom * f, 1, 5);
      const [wx, wy] = this.toWorld(cx, cy);
      this.zoom = nz;
      const [sx, sy] = this.toScreen(wx, wy);
      this.panX += cx - sx; this.panY += cy - sy;
      if (this.zoom === 1) { this.panX = 0; this.panY = 0; }
    }
    tap(sx, sy) {
      const [wx, wy] = this.toWorld(sx, sy);
      const s = this.scale * this.zoom;
      let best = null, bd = 16 / s;
      for (const c of this.world.citizens) { if (c.status === 'gone' || c.x === undefined) continue; const d = Math.hypot(c.x - wx, c.y - wy); if (d < bd) { bd = d; best = c; } }
      if (best) { this.onSelectCitizen && this.onSelectCitizen(best); return; }
      let bl = null, ld = 30 / s;
      for (const id in locPos) { const p = locPos[id]; const d = Math.hypot(p.x - wx, p.y - wy); if (d < ld) { ld = d; bl = id; } }
      if (bl) { this.onSelectLocation && this.onSelectLocation(bl); return; }
      for (const d of D.DISTRICTS) { const [x, y, w, h] = LAYOUT[d.id]; if (wx >= x && wx <= x + w && wy >= y && wy <= y + h) { this.onSelectDistrict && this.onSelectDistrict(d); return; } }
    }
    focusOn(c) { const [x, y] = this.targetOf(c); this.zoom = 2.5; this.panX = 0; this.panY = 0; const [sx, sy] = this.toScreen(x, y); this.panX = this.cw / 2 - sx; this.panY = this.ch / 2 - sy; }

    draw(dt) {
      const ctx = this.ctx, w = this.world;
      this.pulse += dt;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.cw, this.ch);
      const dark = isDark();
      ctx.fillStyle = dark ? '#0f1419' : '#dfe8ec';
      ctx.fillRect(0, 0, this.cw, this.ch);
      const s = this.scale * this.zoom;
      ctx.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * (this.tx * this.zoom + this.panX), this.dpr * (this.ty * this.zoom + this.panY));
      // Water below the docks
      ctx.fillStyle = dark ? '#16324a' : '#a9cde0';
      ctx.fillRect(0, 775, W, H - 775);
      for (let i = 0; i < 8; i++) { ctx.strokeStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); const y = 785 + i * 5 + Math.sin(this.pulse * 1.5 + i) * 2; ctx.moveTo(40 + i * 90, y); ctx.lineTo(90 + i * 90, y); ctx.stroke(); }
      // Districts
      const control = w.conflict ? w.conflict.control : {};
      for (const d of D.DISTRICTS) {
        const [x, y, ww, hh] = LAYOUT[d.id];
        ctx.fillStyle = hexA(d.color, dark ? 0.22 : 0.28);
        roundRect(ctx, x, y, ww, hh, 18); ctx.fill();
        ctx.strokeStyle = hexA(d.color, 0.8); ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)';
        ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textBaseline = 'top';
        ctx.fillText(d.name.toUpperCase(), x + 12, y + 8);
        if (control[d.id]) { const bloc = control[d.id]; const g = w.groups.find(g => g.bloc === bloc && !g.dissolved); if (g) { ctx.fillStyle = g.color; ctx.font = '14px system-ui'; ctx.fillText(`🏴 held by ${window.Conflict.blocName(w, bloc)}`, x + 12, y + 28); } }
      }
      // Locations
      ctx.textAlign = 'center';
      for (const id in locPos) {
        const p = locPos[id], l = w.loc(id);
        const here = (w.occupancy[id] || []).length;
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill();
        ctx.font = '22px system-ui'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000'; ctx.fillText(l.icon, p.x, p.y + 1);
        ctx.font = '11px system-ui'; ctx.fillStyle = dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)'; ctx.textBaseline = 'top';
        ctx.fillText(l.name, p.x, p.y + 30);
        if (here) { ctx.fillStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'; ctx.font = '10px system-ui'; ctx.fillText(String(here), p.x + 22, p.y - 30); }
      }
      // Citizens
      const k = 1 - Math.pow(0.001, dt);
      for (const c of w.citizens) {
        if (c.status === 'gone') continue;
        const [tx, ty] = this.targetOf(c);
        if (c.x === undefined) { c.x = tx; c.y = ty; }
        c.x += (tx - c.x) * k * 0.6; c.y += (ty - c.y) * k * 0.6;
        const g = c.group ? w.group(c.group) : null;
        const j = this.jit(c);
        const bob = Math.sin(this.pulse * 2 + j.phase) * 1.2;
        const r = 5 + c.traits.extra * 2;
        ctx.globalAlpha = c.status === 'hiding' ? 0.35 : c.status === 'jailed' ? 0.6 : 1;
        ctx.fillStyle = g ? g.color : (dark ? '#9aa4ad' : '#6b7580');
        ctx.beginPath(); ctx.arc(c.x, c.y + bob, r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.5)'; ctx.stroke();
        if (c.mood < -0.4) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(c.x, c.y + bob, r * 0.35, 0, Math.PI * 2); ctx.fill(); }
        if (c.status === 'injured') { ctx.fillStyle = '#fff'; ctx.font = '8px system-ui'; ctx.textBaseline = 'middle'; ctx.fillText('+', c.x, c.y + bob); }
        if (c.id === w.mayor.id) { ctx.font = '12px system-ui'; ctx.textBaseline = 'bottom'; ctx.fillText('🎩', c.x, c.y + bob - r); }
        else if (g && g.leader === c.id) { ctx.font = '9px system-ui'; ctx.textBaseline = 'bottom'; ctx.fillText('★', c.x, c.y + bob - r + 1); }
        if (this.selected === c.id) { ctx.strokeStyle = dark ? '#fff' : '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y + bob, r + 4 + Math.sin(this.pulse * 5) * 1.5, 0, Math.PI * 2); ctx.stroke(); }
        if (this.selectedGroup && c.group === this.selectedGroup) { ctx.strokeStyle = g.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y + bob, r + 3, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      // Night overlay
      const h = w.hour;
      const night = h < 6 ? 1 : h < 8 ? (8 - h) / 2 : h >= 21 ? Math.min(1, (h - 20) / 3) : 0;
      if (night > 0 && !dark) { ctx.fillStyle = `rgba(20,25,60,${night * 0.28})`; ctx.fillRect(0, 0, W, H); }
      if (w.weather === 'rain') { ctx.strokeStyle = dark ? 'rgba(170,200,255,0.25)' : 'rgba(60,90,160,0.3)'; ctx.lineWidth = 1; for (let i = 0; i < 60; i++) { const x = (i * 137 + this.pulse * 300) % W, y = (i * 91 + this.pulse * 900) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); ctx.stroke(); } }
      ctx.textAlign = 'left';
    }
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  function isDark() { const t = document.documentElement.getAttribute('data-theme'); if (t) return t === 'dark'; return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  window.Renderer = Renderer;
  window.LOC_POS = locPos;
})();
