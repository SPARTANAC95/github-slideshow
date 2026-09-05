/*
 * Fly CNS simulation core.
 *
 * A scaled-down, connectome-style spiking network modelled on the complete
 * male Drosophila central nervous system (Janelia / MRC LMB / Cambridge /
 * Google Research, Cell, 3 Sep 2026: 166,700 neurons, ~125 M synapses,
 * 11,710 cell types).
 *
 * The neuron model and parameters follow the whole-brain leaky
 * integrate-and-fire model of Shiu et al., Nature 2024 (built on the
 * FlyWire female brain): rest -52 mV, threshold -45 mV, reset -52 mV,
 * membrane tau 20 ms, refractory 2.2 ms, synaptic tau 5 ms, and a weight of
 * 0.275 mV per synapse, signed by the presynaptic neuron's transmitter.
 *
 * The wiring here is generated, not measured: region-level statistics
 * (optic lobes -> central brain -> descending neurons -> nerve cord) plus a
 * handful of published sensorimotor pathways, laid out so the demo can be
 * driven with sugar, light, touch and pheromone stimuli. A real edge list
 * exported from neuPrint can be loaded in its place.
 *
 * Works in the browser (window.FlySim) and in node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FlySim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Model constants (Shiu et al. 2024) ----------
  var V_REST = -52.0;   // mV
  var V_TH = -45.0;     // mV
  var V_RESET = -52.0;  // mV
  var TAU_M = 20.0;     // ms
  var T_REF = 2.2;      // ms
  var TAU_SYN = 5.0;    // ms
  var W_SYN = 0.275;    // mV per synapse

  var REAL = {
    neurons: 166700,
    synapses: 125e6,
    cellTypes: 11710,
    connectionsPerNeuron: 750 // ~125 M / 166.7 k
  };

  // ---------- Regions (approximate proportions of the real CNS) ----------
  var REGIONS = [
    { id: 'olL', name: 'Optic lobe (left)', frac: 0.235, cx: 0.19, cy: 0.30, rx: 0.13, ry: 0.17 },
    { id: 'cb', name: 'Central brain', frac: 0.335, cx: 0.50, cy: 0.29, rx: 0.20, ry: 0.135 },
    { id: 'olR', name: 'Optic lobe (right)', frac: 0.235, cx: 0.81, cy: 0.30, rx: 0.13, ry: 0.17 },
    { id: 'vnc', name: 'Ventral nerve cord', frac: 0.135, cx: 0.50, cy: 0.725, rx: 0.105, ry: 0.215 },
    { id: 'sens', name: 'Sensory afferents', frac: 0.06, cx: 0.50, cy: 0.50, rx: 0.5, ry: 0.5 }
  ];
  var RIDX = {};
  REGIONS.forEach(function (r, i) { RIDX[r.id] = i; });

  // Where a background neuron in region A sends its axon.
  var BG_TARGETS = {
    olL: { olL: 0.86, cb: 0.14 },
    olR: { olR: 0.86, cb: 0.14 },
    cb: { cb: 0.78, olL: 0.03, olR: 0.03, vnc: 0.16 },
    vnc: { vnc: 0.84, cb: 0.16 },
    sens: { cb: 0.6, vnc: 0.4 }
  };

  // ---------- Named populations (per 6,000 neurons) ----------
  // sign: +1 cholinergic (excitatory), -1 GABAergic / glutamatergic (inhibitory)
  var GROUPS = [
    // feeding
    { id: 'sugarGRN', label: 'Sugar taste neurons (Gr64f, foreleg)', region: 'sens', n: 40, cx: 0.36, cy: 0.585, r: 0.025, sign: 1 },
    { id: 'bitterGRN', label: 'Bitter taste neurons (Gr66a, foreleg)', region: 'sens', n: 30, cx: 0.64, cy: 0.585, r: 0.025, sign: 1 },
    { id: 'bitterIN', label: 'Bitter-driven inhibitory interneurons (SEZ)', region: 'cb', n: 40, cx: 0.56, cy: 0.385, r: 0.03, sign: -1 },
    { id: 'feedIN', label: 'Feeding interneurons (SEZ)', region: 'cb', n: 60, cx: 0.47, cy: 0.385, r: 0.035, sign: 1 },
    { id: 'MN9', label: 'Proboscis motor neurons (MN9)', region: 'cb', n: 12, cx: 0.50, cy: 0.415, r: 0.015, sign: 1 },
    // vision, left
    { id: 'photoL', label: 'Photoreceptors (left eye)', region: 'sens', n: 60, cx: 0.045, cy: 0.30, r: 0.045, sign: 1 },
    { id: 'lamL', label: 'Lamina (left)', region: 'olL', n: 80, cx: 0.10, cy: 0.30, r: 0.04, sign: 1 },
    { id: 'medL', label: 'Medulla (left)', region: 'olL', n: 160, cx: 0.18, cy: 0.30, r: 0.06, sign: 1 },
    { id: 'lobL', label: 'Lobula (left)', region: 'olL', n: 80, cx: 0.27, cy: 0.30, r: 0.04, sign: 1 },
    { id: 'lcL', label: 'Visual projection neurons (left LC)', region: 'cb', n: 40, cx: 0.35, cy: 0.29, r: 0.03, sign: 1 },
    // vision, right
    { id: 'photoR', label: 'Photoreceptors (right eye)', region: 'sens', n: 60, cx: 0.955, cy: 0.30, r: 0.045, sign: 1 },
    { id: 'lamR', label: 'Lamina (right)', region: 'olR', n: 80, cx: 0.90, cy: 0.30, r: 0.04, sign: 1 },
    { id: 'medR', label: 'Medulla (right)', region: 'olR', n: 160, cx: 0.82, cy: 0.30, r: 0.06, sign: 1 },
    { id: 'lobR', label: 'Lobula (right)', region: 'olR', n: 80, cx: 0.73, cy: 0.30, r: 0.04, sign: 1 },
    { id: 'lcR', label: 'Visual projection neurons (right LC)', region: 'cb', n: 40, cx: 0.65, cy: 0.29, r: 0.03, sign: 1 },
    { id: 'DNvis', label: 'Descending neurons (visual, e.g. DNp)', region: 'cb', n: 24, cx: 0.50, cy: 0.36, r: 0.025, sign: 1 },
    // grooming
    { id: 'touch', label: 'Antennal mechanosensory neurons (JO)', region: 'sens', n: 40, cx: 0.50, cy: 0.10, r: 0.035, sign: 1 },
    { id: 'groomIN', label: 'Grooming interneurons', region: 'cb', n: 50, cx: 0.44, cy: 0.24, r: 0.03, sign: 1 },
    { id: 'DNgroom', label: 'Descending neurons (grooming, aDN)', region: 'cb', n: 16, cx: 0.44, cy: 0.35, r: 0.02, sign: 1 },
    { id: 'legMN', label: 'Leg motor neurons (VNC)', region: 'vnc', n: 60, cx: 0.50, cy: 0.74, r: 0.05, sign: 1 },
    // courtship (male-specific, fruitless+)
    { id: 'pher', label: 'Pheromone sensors (Gr32a / Or67d)', region: 'sens', n: 30, cx: 0.30, cy: 0.16, r: 0.03, sign: 1 },
    { id: 'P1', label: 'P1 courtship neurons (fruitless+, male-specific)', region: 'cb', n: 25, cx: 0.59, cy: 0.23, r: 0.025, sign: 1 },
    { id: 'pIP10', label: 'pIP10 descending song neurons (fru+)', region: 'cb', n: 6, cx: 0.56, cy: 0.36, r: 0.012, sign: 1 },
    { id: 'wingMN', label: 'Wing motor neurons (VNC)', region: 'vnc', n: 40, cx: 0.50, cy: 0.60, r: 0.04, sign: 1 },
    // flight
    { id: 'haltere', label: 'Haltere afferents (wingbeat feedback)', region: 'sens', n: 40, cx: 0.66, cy: 0.66, r: 0.03, sign: 1 },
    { id: 'flightDN', label: 'Flight-maintaining descending neurons', region: 'cb', n: 20, cx: 0.53, cy: 0.335, r: 0.02, sign: 1 },
    { id: 'GF', label: 'Giant fiber (take-off / escape)', region: 'cb', n: 4, cx: 0.50, cy: 0.395, r: 0.008, sign: 1 },
    { id: 'DNsteerL', label: 'Steering descending neurons (DNa02, left)', region: 'cb', n: 12, cx: 0.40, cy: 0.345, r: 0.018, sign: 1 },
    { id: 'DNsteerR', label: 'Steering descending neurons (DNa02, right)', region: 'cb', n: 12, cx: 0.60, cy: 0.345, r: 0.018, sign: 1 },
    { id: 'steerMNL', label: 'Wing steering motor neurons (left)', region: 'vnc', n: 20, cx: 0.44, cy: 0.63, r: 0.025, sign: 1 },
    { id: 'steerMNR', label: 'Wing steering motor neurons (right)', region: 'vnc', n: 20, cx: 0.56, cy: 0.63, r: 0.025, sign: 1 },
    { id: 'landIN', label: 'Landing interneurons (inhibit flight)', region: 'cb', n: 20, cx: 0.47, cy: 0.33, r: 0.02, sign: -1 }
  ];

  // Feed-forward pathway wiring: [pre, post, connection prob, min syn, max syn]
  var PATHWAYS = [
    ['sugarGRN', 'feedIN', 0.35, 6, 14],
    ['feedIN', 'feedIN', 0.10, 2, 5],
    ['feedIN', 'MN9', 0.50, 8, 16],
    ['bitterGRN', 'bitterIN', 0.40, 6, 14],
    ['bitterIN', 'feedIN', 0.50, 6, 14],
    ['bitterIN', 'MN9', 0.30, 4, 10],

    ['photoL', 'lamL', 0.35, 6, 12],
    ['lamL', 'medL', 0.30, 4, 10],
    ['medL', 'lobL', 0.20, 4, 10],
    ['lobL', 'lcL', 0.35, 4, 10],
    ['lcL', 'DNvis', 0.30, 4, 10],
    ['photoR', 'lamR', 0.35, 6, 12],
    ['lamR', 'medR', 0.30, 4, 10],
    ['medR', 'lobR', 0.20, 4, 10],
    ['lobR', 'lcR', 0.35, 4, 10],
    ['lcR', 'DNvis', 0.30, 4, 10],
    ['DNvis', 'legMN', 0.40, 6, 12],

    ['touch', 'groomIN', 0.35, 6, 14],
    ['groomIN', 'DNgroom', 0.40, 6, 12],
    ['DNgroom', 'legMN', 0.50, 6, 12],

    ['pher', 'P1', 0.45, 8, 16],
    ['P1', 'P1', 0.15, 2, 6],
    ['P1', 'pIP10', 0.70, 10, 18],
    ['pIP10', 'wingMN', 0.75, 10, 18],

    ['haltere', 'flightDN', 0.50, 8, 14],
    ['flightDN', 'flightDN', 0.10, 2, 5],
    ['flightDN', 'wingMN', 0.70, 10, 16],
    ['GF', 'wingMN', 0.90, 10, 18],
    ['GF', 'legMN', 0.70, 10, 18],
    ['lcL', 'DNsteerL', 0.50, 6, 12],
    ['lcR', 'DNsteerR', 0.50, 6, 12],
    ['DNsteerL', 'steerMNL', 0.80, 10, 16],
    ['DNsteerR', 'steerMNR', 0.80, 10, 16],
    ['landIN', 'flightDN', 0.90, 12, 18],
    ['landIN', 'wingMN', 0.70, 10, 16]
  ];

  // Stimuli the UI can trigger. rate in Hz, duration in ms.
  var STIMULI = {
    sugar: { label: 'Sugar on the foreleg', groups: ['sugarGRN'], rate: 120, duration: 500 },
    bitter: { label: 'Sugar + bitter', groups: ['sugarGRN', 'bitterGRN'], rate: 120, duration: 500 },
    flashL: { label: 'Light flash, left eye', groups: ['photoL'], rate: 150, duration: 250 },
    flashR: { label: 'Light flash, right eye', groups: ['photoR'], rate: 150, duration: 250 },
    flash: { label: 'Light flash, both eyes', groups: ['photoL', 'photoR'], rate: 150, duration: 250 },
    touch: { label: 'Touch the antenna', groups: ['touch'], rate: 120, duration: 400 },
    pheromone: { label: 'Female pheromone', groups: ['pher'], rate: 100, duration: 700 },
    startle: { label: 'Startle (giant fiber)', groups: ['GF'], rate: 250, duration: 80 },
    land: { label: 'Land', groups: ['landIN', 'legMN'], rate: 120, duration: 400 }
  };

  // Motor read-outs shown as meters.
  var READOUTS = [
    { id: 'MN9', label: 'Proboscis extension', behaviour: 'feeding' },
    { id: 'legMN', label: 'Leg movement', behaviour: 'grooming / escape' },
    { id: 'wingMN', label: 'Wing extension', behaviour: 'courtship song' }
  ];

  // ---------- RNG ----------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeGauss(rand) {
    var spare = null;
    return function () {
      if (spare !== null) { var s = spare; spare = null; return s; }
      var u, v, r;
      do { u = rand() * 2 - 1; v = rand() * 2 - 1; r = u * u + v * v; } while (r >= 1 || r === 0);
      var m = Math.sqrt(-2 * Math.log(r) / r);
      spare = v * m;
      return u * m;
    };
  }

  // ---------- Network ----------
  function Network(opts) {
    opts = opts || {};
    this.N = opts.N || 6000;
    this.seed = opts.seed || 1;
    this.kBackground = opts.kBackground || 30;    // mean out-degree of background wiring
    this.inhFraction = opts.inhFraction != null ? opts.inhFraction : 0.38;
    this.weightScale = opts.weightScale || 1.0;
    this.noise = opts.noise != null ? opts.noise : 0.85; // mV / sqrt(ms)
    this.dt = opts.dt || 0.5;
    this.rand = mulberry32(this.seed);
    this.gauss = makeGauss(this.rand);
    this.build();
  }

  Network.prototype.build = function () {
    var N = this.N, rand = this.rand;
    var scale = N / 6000;

    this.x = new Float32Array(N);
    this.y = new Float32Array(N);
    this.region = new Uint8Array(N);
    this.sign = new Int8Array(N);
    this.group = new Int16Array(N).fill(-1);

    // Region allocation: contiguous blocks so a raster sorted by index is
    // sorted by region.
    var counts = REGIONS.map(function (r) { return Math.floor(r.frac * N); });
    counts[RIDX.cb] += N - counts.reduce(function (a, b) { return a + b; }, 0);
    var start = [], acc = 0;
    for (var r = 0; r < REGIONS.length; r++) { start.push(acc); acc += counts[r]; }
    this.regionStart = start;
    this.regionCount = counts;

    var cursor = start.slice();
    var i, k;

    // Named groups first (they take the first slots of their region).
    this.groups = [];
    this.groupIndex = {};
    for (k = 0; k < GROUPS.length; k++) {
      var g = GROUPS[k];
      var n = Math.max(3, Math.round(g.n * scale));
      var ri = RIDX[g.region];
      var members = [];
      for (i = 0; i < n && cursor[ri] < start[ri] + counts[ri]; i++) {
        var id = cursor[ri]++;
        members.push(id);
        var ang = rand() * Math.PI * 2, rad = Math.sqrt(rand()) * g.r;
        this.x[id] = g.cx + Math.cos(ang) * rad;
        this.y[id] = g.cy + Math.sin(ang) * rad * 0.9;
        this.region[id] = ri;
        this.sign[id] = g.sign;
        this.group[id] = k;
      }
      var gi = { id: g.id, label: g.label, region: g.region, members: members, sign: g.sign };
      this.groups.push(gi);
      this.groupIndex[g.id] = gi;
    }

    // Background neurons fill the rest of each region.
    for (r = 0; r < REGIONS.length; r++) {
      var R = REGIONS[r];
      for (i = cursor[r]; i < start[r] + counts[r]; i++) {
        this.region[i] = r;
        this.sign[i] = rand() < this.inhFraction ? -1 : 1;
        if (R.id === 'sens') {
          // spread generic sensory afferents along the body surface
          var side = rand();
          if (side < 0.4) { this.x[i] = 0.40 + rand() * 0.20; this.y[i] = 0.06 + rand() * 0.05; }
          else if (side < 0.7) { this.x[i] = 0.30 + rand() * 0.40; this.y[i] = 0.55 + rand() * 0.06; }
          else { this.x[i] = rand() < 0.5 ? 0.02 + rand() * 0.04 : 0.94 + rand() * 0.04; this.y[i] = 0.22 + rand() * 0.16; }
        } else {
          var a = rand() * Math.PI * 2, d = Math.sqrt(rand());
          this.x[i] = R.cx + Math.cos(a) * d * R.rx;
          this.y[i] = R.cy + Math.sin(a) * d * R.ry;
        }
      }
    }

    // ----- Edges -----
    var pre = [], post = [], nsyn = [];
    var self = this;
    function pickInRegion(ri) {
      return start[ri] + Math.floor(rand() * counts[ri]);
    }
    function poisson(mean) {
      var L = Math.exp(-mean), p = 1, kk = 0;
      do { kk++; p *= rand(); } while (p > L);
      return kk - 1;
    }

    // Background wiring: sparse, region-structured.
    for (i = 0; i < N; i++) {
      var rid = REGIONS[this.region[i]].id;
      var kMean = rid === 'sens' ? this.kBackground * 0.3 : this.kBackground;
      var deg = poisson(kMean);
      var targets = BG_TARGETS[rid];
      for (k = 0; k < deg; k++) {
        var u = rand(), cum = 0, tr = this.region[i];
        for (var key in targets) { cum += targets[key]; if (u < cum) { tr = RIDX[key]; break; } }
        var j = pickInRegion(tr);
        if (j === i) continue;
        pre.push(i); post.push(j);
        nsyn.push(1 + Math.floor(-Math.log(1 - rand()) * 1.4)); // mean ~2.4 synapses
      }
    }

    // Published-style pathways.
    for (k = 0; k < PATHWAYS.length; k++) {
      var pw = PATHWAYS[k];
      var A = this.groupIndex[pw[0]].members, B = this.groupIndex[pw[1]].members;
      for (var ai = 0; ai < A.length; ai++) {
        for (var bi = 0; bi < B.length; bi++) {
          if (A[ai] === B[bi]) continue;
          if (rand() < pw[2]) {
            pre.push(A[ai]); post.push(B[bi]);
            nsyn.push(pw[3] + Math.floor(rand() * (pw[4] - pw[3] + 1)));
          }
        }
      }
    }

    this.setEdges(pre, post, nsyn);
    this.reset();
  };

  // Build CSR adjacency from an edge list. weights are synapse counts (>0);
  // the sign comes from the presynaptic neuron.
  Network.prototype.setEdges = function (pre, post, nsyn) {
    var N = this.N, E = pre.length;
    var deg = new Int32Array(N + 1);
    var e;
    for (e = 0; e < E; e++) deg[pre[e] + 1]++;
    for (var i = 0; i < N; i++) deg[i + 1] += deg[i];
    var rowPtr = deg;
    var col = new Int32Array(E);
    var w = new Float32Array(E);
    var fill = new Int32Array(N);
    var totalSyn = 0;
    for (e = 0; e < E; e++) {
      var p = pre[e];
      var slot = rowPtr[p] + fill[p]++;
      col[slot] = post[e];
      w[slot] = nsyn[e] * W_SYN * this.sign[p];
      totalSyn += nsyn[e];
    }
    this.rowPtr = rowPtr;
    this.col = col;
    this.w = w;
    this.E = E;
    this.totalSynapses = totalSyn;
  };

  Network.prototype.reset = function () {
    var N = this.N;
    this.v = new Float32Array(N).fill(V_REST);
    this.g = new Float32Array(N);
    this.refr = new Float32Array(N);
    this.lastSpike = new Float32Array(N).fill(-1e9);
    this.t = 0;
    this.spikeCount = 0;
    this.stims = [];        // active stimuli: {members, rate, until}
    this.drives = {};       // persistent drives: id -> {members, rate}
    this.onSpike = null;    // callback(t, id)
    this.groupSpikes = new Int32Array(this.groups.length); // cumulative spikes per named group
    // per-region spike counters for the current step
    this.stepCounts = new Int32Array(REGIONS.length);
  };

  Network.prototype.stimulate = function (members, rateHz, durationMs) {
    this.stims.push({ members: members, rate: rateHz, until: this.t + durationMs });
  };

  // Persistent Poisson drive on a set of neurons (rate 0 removes it).
  Network.prototype.setDrive = function (id, members, rateHz) {
    if (!rateHz || rateHz <= 0) { delete this.drives[id]; return; }
    this.drives[id] = { members: members, rate: rateHz };
  };

  Network.prototype.trigger = function (stimId) {
    var s = STIMULI[stimId];
    if (!s) return;
    for (var k = 0; k < s.groups.length; k++) {
      this.stimulate(this.groupIndex[s.groups[k]].members, s.rate, s.duration);
    }
  };

  Network.prototype.step = function () {
    var N = this.N, dt = this.dt, t = this.t;
    var v = this.v, g = this.g, refr = this.refr, last = this.lastSpike;
    var rowPtr = this.rowPtr, col = this.col, w = this.w;
    var gauss = this.gauss, rand = this.rand;
    var decay = Math.exp(-dt / TAU_SYN);
    var a = dt / TAU_M;
    var sigma = this.noise * Math.sqrt(dt);
    var ws = this.weightScale;
    var counts = this.stepCounts;
    counts.fill(0);
    var i, e;

    // membrane update
    for (i = 0; i < N; i++) {
      if (refr[i] > 0) { refr[i] -= dt; v[i] = V_RESET; }
      else v[i] += a * (V_REST - v[i] + g[i]) + sigma * gauss();
      g[i] *= decay;
    }

    // external drive
    var live = [];
    for (var s = 0; s < this.stims.length; s++) {
      var st = this.stims[s];
      if (st.until <= t) continue;
      live.push(st);
      var p = st.rate * dt / 1000;
      var m = st.members;
      for (var k = 0; k < m.length; k++) if (rand() < p) v[m[k]] = V_TH + 0.01;
    }
    this.stims = live;
    for (var key in this.drives) {
      var dr = this.drives[key];
      var pd = dr.rate * dt / 1000, dm = dr.members;
      for (var q = 0; q < dm.length; q++) if (rand() < pd) v[dm[q]] = V_TH + 0.01;
    }

    // spikes + propagation
    var grp = this.group, gcount = this.groupSpikes;
    var nsp = 0;
    var onSpike = this.onSpike;
    for (i = 0; i < N; i++) {
      if (v[i] >= V_TH && refr[i] <= 0) {
        v[i] = V_RESET; refr[i] = T_REF; last[i] = t; nsp++;
        counts[this.region[i]]++;
        if (grp[i] >= 0) gcount[grp[i]]++;
        if (onSpike) onSpike(t, i);
        var end = rowPtr[i + 1];
        for (e = rowPtr[i]; e < end; e++) g[col[e]] += w[e] * ws;
      }
    }
    this.spikeCount += nsp;
    this.t = t + dt;
    return nsp;
  };

  // Load a real edge list (arrays of pre id, post id, synapse count).
  // Node ids are remapped to 0..N-1 in order of first appearance. Regions
  // may be supplied as an array of region ids per node id; otherwise every
  // neuron is placed in the central brain.
  Network.prototype.loadEdgeList = function (preIds, postIds, weights, regionOf) {
    var map = new Map(), order = [];
    function idx(id) {
      var k = map.get(id);
      if (k === undefined) { k = order.length; map.set(id, k); order.push(id); }
      return k;
    }
    var pre = new Array(preIds.length), post = new Array(preIds.length), ns = new Array(preIds.length);
    for (var e = 0; e < preIds.length; e++) {
      pre[e] = idx(preIds[e]); post[e] = idx(postIds[e]); ns[e] = Math.max(1, Math.abs(weights[e] || 1));
    }
    var N = order.length;
    this.N = N;
    this.x = new Float32Array(N); this.y = new Float32Array(N);
    this.region = new Uint8Array(N);
    this.sign = new Int8Array(N);
    this.group = new Int16Array(N).fill(-1);
    this.groups = []; this.groupIndex = {};
    var rand = this.rand;
    // region assignment
    var byRegion = REGIONS.map(function () { return []; });
    for (var i = 0; i < N; i++) {
      var rid = regionOf ? regionOf(order[i]) : null;
      var ri = rid != null && RIDX[rid] != null ? RIDX[rid] : RIDX.cb;
      byRegion[ri].push(i);
    }
    // Contiguous re-ordering by region so rasters stay region-sorted.
    var perm = new Int32Array(N), inv = new Int32Array(N), p = 0;
    this.regionStart = []; this.regionCount = [];
    for (var r = 0; r < REGIONS.length; r++) {
      this.regionStart.push(p); this.regionCount.push(byRegion[r].length);
      for (var q = 0; q < byRegion[r].length; q++) { perm[p] = byRegion[r][q]; inv[byRegion[r][q]] = p; p++; }
    }
    this.nodeIds = new Array(N);
    for (i = 0; i < N; i++) {
      var src = perm[i];
      this.nodeIds[i] = order[src];
      var rr = 0;
      for (r = 0; r < REGIONS.length; r++) if (i >= this.regionStart[r] && i < this.regionStart[r] + this.regionCount[r]) rr = r;
      var R = REGIONS[rr];
      this.region[i] = rr;
      var a = rand() * Math.PI * 2, d = Math.sqrt(rand());
      this.x[i] = R.cx + Math.cos(a) * d * R.rx;
      this.y[i] = R.cy + Math.sin(a) * d * R.ry;
      this.sign[i] = rand() < this.inhFraction ? -1 : 1;
    }
    for (e = 0; e < pre.length; e++) { pre[e] = inv[pre[e]]; post[e] = inv[post[e]]; }
    // Expose the whole population as a single stimulable group per region
    for (r = 0; r < REGIONS.length; r++) {
      if (!this.regionCount[r]) continue;
      var members = [];
      for (i = this.regionStart[r]; i < this.regionStart[r] + this.regionCount[r]; i++) members.push(i);
      var gi = { id: 'all_' + REGIONS[r].id, label: 'All ' + REGIONS[r].name.toLowerCase() + ' neurons', region: REGIONS[r].id, members: members, sign: 0 };
      this.groups.push(gi); this.groupIndex[gi.id] = gi;
    }
    this.setEdges(pre, post, ns);
    this.reset();
  };

  return {
    Network: Network,
    REGIONS: REGIONS,
    GROUPS: GROUPS,
    PATHWAYS: PATHWAYS,
    STIMULI: STIMULI,
    READOUTS: READOUTS,
    REAL: REAL,
    PARAMS: { V_REST: V_REST, V_TH: V_TH, V_RESET: V_RESET, TAU_M: TAU_M, T_REF: T_REF, TAU_SYN: TAU_SYN, W_SYN: W_SYN }
  };
});
