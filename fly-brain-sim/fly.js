/*
 * Embodied fly: closes the loop between the spiking network in sim.js and a
 * simple flight body in a 3D arena.
 *
 *   world  ->  eyes (photoreceptor drive, left / right)  ->  network
 *   network -> wing motor neurons (thrust), steering motor neurons (yaw),
 *              giant fiber (take-off), landing interneurons (land)  ->  body
 *
 * The network is stepped here so that body physics and neural time stay in
 * lock-step; the renderer only reads state. No DOM, works in node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sim.js'));
  else root.FlyBody = factory(root.FlySim);
})(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';

  var RATE_TAU = 60;       // ms, smoothing of population rates
  var GROUPS = ['photoL', 'photoR', 'lcL', 'lcR', 'DNsteerL', 'DNsteerR', 'flightDN', 'wingMN', 'steerMNL', 'steerMNR', 'legMN', 'GF', 'landIN', 'haltere'];

  function FlyBody(net, opts) {
    opts = opts || {};
    this.net = net;
    this.pos = { x: 0, y: 0.35, z: 0 };
    this.yaw = 0;            // radians, 0 = facing +z
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;          // units / s along heading
    this.vy = 0;
    this.airborne = false;
    this.state = 'resting';
    this.target = opts.target || { x: 6, y: 2.5, z: 10 };
    this.autopilot = opts.autopilot !== false;
    this.groundY = 0.35;
    this.lowWingSince = -1;
    this.lastTakeoff = -1e9;
    this.lastLanding = -1e9;
    this.landingUntil = -1e9;
    this.landingsAt = [];
    this.wander = 0;
    this.rates = {};
    this.lastCounts = new Int32Array(net.groupSpikes.length);
    for (var k = 0; k < GROUPS.length; k++) this.rates[GROUPS[k]] = 0;
    this.distance = 0;
    this.bearing = 0;
    this.eyeL = 0; this.eyeR = 0;
    this.wingPhase = 0;
  }

  FlyBody.prototype.groupIdx = function (id) {
    var g = this.net.groupIndex[id];
    return g ? this.net.groups.indexOf(g) : -1;
  };

  // Update smoothed per-neuron firing rates (Hz) for the groups we read.
  FlyBody.prototype.updateRates = function (elapsedMs) {
    var net = this.net, gs = net.groupSpikes;
    var a = 1 - Math.exp(-elapsedMs / RATE_TAU);
    for (var k = 0; k < GROUPS.length; k++) {
      var gi = this.groupIdx(GROUPS[k]);
      if (gi < 0) continue;
      var n = net.groups[gi].members.length;
      var d = gs[gi] - this.lastCounts[gi];
      this.lastCounts[gi] = gs[gi];
      var inst = d / n / (elapsedMs / 1000);
      this.rates[GROUPS[k]] += (inst - this.rates[GROUPS[k]]) * a;
    }
  };

  // What the eyes see: brightness of the target from each side.
  FlyBody.prototype.sense = function () {
    var dx = this.target.x - this.pos.x, dy = this.target.y - this.pos.y, dz = this.target.z - this.pos.z;
    var horiz = Math.sqrt(dx * dx + dz * dz);
    this.distance = Math.sqrt(horiz * horiz + dy * dy);
    var fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);   // forward
    var lx = Math.cos(this.yaw), lz = -Math.sin(this.yaw);  // left
    var fwd = (dx * fx + dz * fz), left = (dx * lx + dz * lz);
    this.bearing = Math.atan2(left, fwd);                     // + = target on the left
    this.elevation = Math.atan2(dy, Math.max(0.01, horiz));
    var intensity = 1 / (1 + this.distance / 30);
    // Compound eyes cover almost the whole panorama; each eye's response peaks
    // ~60° to its own side and falls off smoothly, so left/right contrast
    // exists at every bearing except straight behind.
    var eyeAxis = 1.05;
    this.eyeL = intensity * (0.5 + 0.5 * Math.cos(this.bearing - eyeAxis));
    this.eyeR = intensity * (0.5 + 0.5 * Math.cos(this.bearing + eyeAxis));
    var net = this.net;
    net.setDrive('eyeL', net.groupIndex.photoL.members, 220 * this.eyeL);
    net.setDrive('eyeR', net.groupIndex.photoR.members, 220 * this.eyeR);
    // halteres beat only in flight; their afferents keep the flight DNs going
    // (they stop when the fly folds its wings to land)
    net.setDrive('haltere', net.groupIndex.haltere.members, this.airborne && net.t > this.landingUntil ? 90 : 0);
  };

  FlyBody.prototype.takeoff = function () {
    var net = this.net;
    net.stimulate(net.groupIndex.GF.members, 250, 80);
    this.lastTakeoff = net.t;
  };
  FlyBody.prototype.land = function () {
    var net = this.net;
    net.stimulate(net.groupIndex.landIN.members, 120, 450);
    net.stimulate(net.groupIndex.legMN.members, 100, 300);
    this.lastLanding = net.t;
    this.landingUntil = net.t + 700;
  };

  // Advance the brain by `steps` network steps and the body by the same time.
  FlyBody.prototype.tick = function (steps) {
    var net = this.net;
    var t0 = net.t;
    this.sense();
    for (var s = 0; s < steps; s++) net.step();
    var elapsed = net.t - t0;
    this.updateRates(elapsed);
    var dt = elapsed / 1000;
    var r = this.rates;

    // ----- state machine -----
    if (!this.airborne) {
      if (r.wingMN > 12 && net.t - this.lastLanding > 600) {
        this.airborne = true; this.state = 'take-off';
        this.vy = 2.5; this.lowWingSince = -1;
      } else if (this.autopilot && this.distance > 4 && net.t - this.lastTakeoff > 1800 && net.t - this.lastLanding > 1500) {
        this.takeoff();
      }
    } else {
      if (r.wingMN < 8) { if (this.lowWingSince < 0) this.lowWingSince = net.t; }
      else this.lowWingSince = -1;
      if (this.lowWingSince >= 0 && net.t - this.lowWingSince > 250) {
        this.airborne = false; this.state = 'landed';
        this.landingsAt.push({ x: this.pos.x, y: this.pos.y, z: this.pos.z, t: net.t });
        this.speed = 0;
      } else if (this.autopilot && this.distance < 2.0 && net.t - this.lastLanding > 1500 && net.t - this.lastTakeoff > 800) {
        this.land(); this.state = 'landing';
      } else if (this.state !== 'landing' || net.t - this.lastLanding > 600) {
        this.state = net.t - this.lastTakeoff < 400 ? 'take-off' : 'flying';
      }
    }

    // ----- dynamics -----
    var yawRate = 0;
    if (this.airborne) {
      var thrust = 0.08 * r.wingMN;               // units/s per Hz
      if (this.state === 'landing') thrust *= 0.15;  // wings feather, legs extend
      this.speed += (thrust - this.speed) * Math.min(1, dt * (this.state === 'landing' ? 6 : 3));
      yawRate = 0.1 * (r.steerMNL - r.steerMNR);  // rad/s per Hz difference
      this.wander += ((net.rand() - 0.5) * 2 - this.wander) * Math.min(1, dt * 2);
      yawRate += this.wander * 0.6;
      this.yaw += yawRate * dt;
      // altitude: climb toward the target's height, never below the ground
      var climb = Math.max(-2.5, Math.min(2.5, 3 * Math.sin(this.elevation)));
      if (this.state === 'landing') climb = (this.target.y - this.pos.y) * 2;
      this.vy += (climb - this.vy) * Math.min(1, dt * 4);
      this.pos.y += this.vy * dt;
      if (this.pos.y < this.groundY) { this.pos.y = this.groundY; this.vy = 0; }
      this.pitch += (Math.max(-0.5, Math.min(0.5, this.vy * 0.15)) - this.pitch) * Math.min(1, dt * 5);
      this.roll += (Math.max(-0.9, Math.min(0.9, -yawRate * 0.5)) - this.roll) * Math.min(1, dt * 5);
    } else {
      this.speed *= Math.max(0, 1 - dt * 8);
      this.pitch *= Math.max(0, 1 - dt * 5);
      this.roll *= Math.max(0, 1 - dt * 5);
      if (this.pos.y > this.groundY + 0.01 && this.state === 'landed' && this.distance > 1.6) {
        // slipped off: fall to the ground
        this.vy -= 9.8 * dt; this.pos.y += this.vy * dt;
        if (this.pos.y <= this.groundY) { this.pos.y = this.groundY; this.vy = 0; }
      }
    }
    this.pos.x += Math.sin(this.yaw) * this.speed * dt;
    this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    // keep inside the arena
    var LIM = 28;
    if (Math.abs(this.pos.x) > LIM || Math.abs(this.pos.z) > LIM) {
      this.pos.x = Math.max(-LIM, Math.min(LIM, this.pos.x));
      this.pos.z = Math.max(-LIM, Math.min(LIM, this.pos.z));
      this.yaw += Math.PI * 0.5 * dt;
    }
    this.wingPhase += dt * (this.airborne ? 200 : 0) * Math.PI * 2;
    return elapsed;
  };

  FlyBody.RATE_GROUPS = GROUPS;
  return FlyBody;
});
