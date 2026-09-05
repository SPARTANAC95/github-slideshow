// Seeded random number generator (mulberry32) plus helpers.
// Everything in the simulation flows from one seed so a city can be replayed.
(function () {
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  class RNG {
    constructor(seed) {
      this.seed = seed;
      this.a = (typeof seed === 'number' ? seed : hashString(String(seed))) | 0;
    }
    // Re-create from a saved internal state
    static fromState(seed, a) { const r = new RNG(seed); r.a = a | 0; return r; }
    float() {
      this.a = (this.a + 0x6D2B79F5) | 0;
      let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + this.float() * (b - a); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    chance(p) { return this.float() < p; }
    pick(arr) { return arr[Math.floor(this.float() * arr.length)]; }
    pickWeighted(items, weightFn) {
      let total = 0; const ws = [];
      for (const it of items) { const w = Math.max(0, weightFn(it)); ws.push(w); total += w; }
      if (total <= 0) return null;
      let r = this.float() * total;
      for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    }
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.float() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
    gauss(mean = 0, sd = 1) {
      let u = 0, v = 0;
      while (u === 0) u = this.float();
      while (v === 0) v = this.float();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    // Bell-shaped trait in [0,1]
    trait(mean = 0.5, sd = 0.2) { return clamp(this.gauss(mean, sd), 0, 1); }
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  window.RNG = RNG;
  window.clamp = clamp;
  window.lerp = lerp;
  window.hashString = hashString;
})();
