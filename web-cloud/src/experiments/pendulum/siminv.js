// siminv.js - Inverted Pendulum Simulation
  // URDF convention: θ = 0° (down), θ = π or -π (up, 180° or -180°)
  // Date: April 28, 2025

  // Model constants (aligned with MATLAB)
  const G = 9.81;                // Gravity (m/s^2)
  const M_PENDULUM = 0.2;        // Pendulum mass (kg)
  const M_CART = 1.0;            // Cart mass (kg)
  const L_PENDULUM = 0.245;      // Pendulum half-length (m)
  const B_EQ_CART = 30.0;        // Cart damping coefficient (N.s/m)
  const D_PEND = 0.004;          // Pendulum damping coefficient (N.m.s/rad)
  const K_T = 0.0225;            // Motor torque constant (N.m/A)
  const R_PINION = 0.005;        // Pinion radius (m)
  const DELAY_TIME = 0.02;       // Transport delay (s)
  const STEP_SIZE = 0.001;       // Simulation step size (s)
  const XDDOT_SAT_MAX = 30.0;    // Control saturation limit (m/s^2)
  const XDDOT_GAIN = 1.0;        // Control gain (set to 1, as motor scaling is handled)
  const THETA_DOT_MAX = 10.0;    // Max angular velocity (rad/s)
  const X_MAX = 0.428;           // Cart position limit (m)

  // Calculate buffer size for transport delay
  const DELAY_BUFFER_SIZE = Math.ceil(DELAY_TIME / STEP_SIZE) + 2;

  function DW_InvertedPendulum() {
    this.UnitDelay4_DSTATE = 0.0; // Cart position (x, m)
    this.UnitDelay3_DSTATE = 0.0; // Cart velocity (x_dot, m/s)
    this.UnitDelay2_DSTATE = 0.0; // Pendulum angle (theta, radians)
    this.UnitDelay1_DSTATE = 0.0; // Pendulum angular velocity (theta_dot, rad/s)

    // Transport delay buffers for x, x_dot, theta, theta_dot
    this.TransportDelay_Buffer = new Array(DELAY_BUFFER_SIZE).fill(0.0);
    this.TransportDelay_Time = new Array(DELAY_BUFFER_SIZE).fill(0.0);
    this.TransportDelay_Head = 0;
    this.TransportDelay_Tail = 0;

    this.TransportDelay1_Buffer = new Array(DELAY_BUFFER_SIZE).fill(0.0);
    this.TransportDelay1_Time = new Array(DELAY_BUFFER_SIZE).fill(0.0);
    this.TransportDelay1_Head = 0;
    this.TransportDelay1_Tail = 0;

    this.TransportDelay2_Buffer = new Array(DELAY_BUFFER_SIZE).fill(0.0);
    this.TransportDelay2_Time = new Array(DELAY_BUFFER_SIZE).fill(0.0);
    this.TransportDelay2_Head = 0;
    this.TransportDelay2_Tail = 0;

    this.TransportDelay3_Buffer = new Array(DELAY_BUFFER_SIZE).fill(0.0);
    this.TransportDelay3_Time = new Array(DELAY_BUFFER_SIZE).fill(0.0);
    this.TransportDelay3_Head = 0;
    this.TransportDelay3_Tail = 0;
  }

  function ExtY_InvertedPendulum() {
    this.Sum21 = 0.0; // Delayed cart position (x, m)
    this.Sum1 = 0.0;  // Delayed cart velocity (x_dot, m/s)
    this.Sum3 = 0.0;  // Delayed pendulum angle (theta, radians)
    this.Sum2 = 0.0;  // Delayed pendulum angular velocity (theta_dot, rad/s)
  }

  let InvertedPendulum_DW = new DW_InvertedPendulum();
  let InvertedPendulum_Y = new ExtY_InvertedPendulum();
  let currentTime = 0.0;

  // Normalize angle to [-π, π]
  function normalizeAngle(theta) {
    return ((theta + Math.PI) % (2 * Math.PI)) - Math.PI;
  }

  // Dynamics function for RK4 - adjusted for URDF convention (0°=down, π=up)
  function computeDynamics(x, x_dot, theta, theta_dot, u) {
    // Convert to standard convention (0°=up) for dynamics calculations
    const theta_std = Math.PI - theta; // theta_std = 0 when upright
    const sinTheta = Math.sin(theta_std);
    const cosTheta = Math.cos(theta_std);

    const totalMass = M_CART + M_PENDULUM;
    const denom = totalMass * L_PENDULUM - M_PENDULUM * L_PENDULUM * cosTheta * cosTheta;

    // Prevent division by near-zero
    if (Math.abs(denom) < 1e-6) {
      console.warn(`Near-zero denominator in computeDynamics: denom=${denom}`);
      return { x_ddot: 0, theta_ddot: 0 };
    }

    // Scale u to force (MATLAB: u is torque-based, converted via K_t / R_pinion)
    const force = u * K_T / R_PINION;

    // Cart acceleration with damping
    const x_ddot = (force + M_PENDULUM * L_PENDULUM * theta_dot * theta_dot * sinTheta - B_EQ_CART * x_dot) / totalMass;

    // Pendulum angular acceleration with damping
    const theta_ddot = (G * sinTheta * totalMass - force * cosTheta - 
                       M_PENDULUM * L_PENDULUM * theta_dot * theta_dot * sinTheta * cosTheta - 
                       D_PEND * theta_dot) / denom;

    // Debug log for dynamics
    if (currentTime < 0.2 || currentTime > 24.8) {
      console.log(`Dynamics t=${currentTime.toFixed(3)}: x_ddot=${x_ddot.toFixed(3)}, theta_ddot=${theta_ddot.toFixed(3)}, force=${force.toFixed(3)}`);
    }

    return { 
      x_ddot: isFinite(x_ddot) ? x_ddot : 0, 
      theta_ddot: isFinite(theta_ddot) ? -theta_ddot : 0 // Negate to maintain URDF convention
    };
  }

  // Runge-Kutta 4th order integration step
  function rk4Step(x, x_dot, theta, theta_dot, u, h) {
    // k1
    const k1_x_dot = x_dot;
    const k1_theta_dot = theta_dot;
    let { x_ddot: k1_x_ddot, theta_ddot: k1_theta_ddot } = computeDynamics(x, x_dot, theta, theta_dot, u);

    // k2
    const x2 = x + 0.5 * h * k1_x_dot;
    const x_dot2 = x_dot + 0.5 * h * k1_x_ddot;
    const theta2 = theta + 0.5 * h * k1_theta_dot;
    const theta_dot2 = Math.max(-THETA_DOT_MAX, Math.min(THETA_DOT_MAX, theta_dot + 0.5 * h * k1_theta_ddot));
    let { x_ddot: k2_x_ddot, theta_ddot: k2_theta_ddot } = computeDynamics(x2, x_dot2, theta2, theta_dot2, u);

    // k3
    const x3 = x + 0.5 * h * k1_x_dot;
    const x_dot3 = x_dot + 0.5 * h * k2_x_ddot;
    const theta3 = theta + 0.5 * h * k1_theta_dot;
    const theta_dot3 = Math.max(-THETA_DOT_MAX, Math.min(THETA_DOT_MAX, theta_dot + 0.5 * h * k2_theta_ddot));
    let { x_ddot: k3_x_ddot, theta_ddot: k3_theta_ddot } = computeDynamics(x3, x_dot3, theta3, theta_dot3, u);

    // k4
    const x4 = x + h * k1_x_dot;
    const x_dot4 = x_dot + h * k3_x_ddot;
    const theta4 = theta + h * k1_theta_dot;
    const theta_dot4 = Math.max(-THETA_DOT_MAX, Math.min(THETA_DOT_MAX, theta_dot + h * k3_theta_ddot));
    let { x_ddot: k4_x_ddot, theta_ddot: k4_theta_ddot } = computeDynamics(x4, x_dot4, theta4, theta_dot4, u);

    // Combine
    const x_new = x + (h / 6) * (k1_x_dot + 2 * (x_dot + 0.5 * h * k1_x_ddot) + 2 * (x_dot + 0.5 * h * k2_x_ddot) + (x_dot + h * k3_x_ddot));
    const x_dot_new = x_dot + (h / 6) * (k1_x_ddot + 2 * k2_x_ddot + 2 * k3_x_ddot + k4_x_ddot);
    const theta_new = theta + (h / 6) * (k1_theta_dot + 2 * theta_dot2 + 2 * theta_dot3 + theta_dot4);
    const theta_dot_new = Math.max(-THETA_DOT_MAX, Math.min(THETA_DOT_MAX, 
      theta_dot + (h / 6) * (k1_theta_ddot + 2 * k2_theta_ddot + 2 * k3_theta_ddot + k4_theta_ddot)));

    return {
      x: isFinite(x_new) ? Math.max(-X_MAX, Math.min(X_MAX, x_new)) : x,
      x_dot: isFinite(x_dot_new) ? x_dot_new : x_dot,
      theta: isFinite(theta_new) ? normalizeAngle(theta_new) : theta,
      theta_dot: isFinite(theta_dot_new) ? theta_dot_new : theta_dot
    };
  }

  // Transport delay interpolation
  function transportDelayInterpolate(buffer, timeBuffer, head, tail, currentTime, delay) {
    const targetTime = currentTime - delay;
    let i = head;
    while (i !== tail && timeBuffer[(i - 1 + DELAY_BUFFER_SIZE) % DELAY_BUFFER_SIZE] > targetTime) {
      i = (i - 1 + DELAY_BUFFER_SIZE) % DELAY_BUFFER_SIZE;
    }
    if (i === tail || timeBuffer[i] <= targetTime) return buffer[i];
    const t0 = timeBuffer[(i - 1 + DELAY_BUFFER_SIZE) % DELAY_BUFFER_SIZE];
    const t1 = timeBuffer[i];
    const v0 = buffer[(i - 1 + DELAY_BUFFER_SIZE) % DELAY_BUFFER_SIZE];
    const v1 = buffer[i];
    return v0 + (v1 - v0) * (targetTime - t0) / (t1 - t0);
  }

  // Initialize simulation
  function InvertedPendulum_initialize(initialState) {
    initialState = initialState || { x: 0, x_dot: 0, theta: Math.PI, theta_dot: 0 }; // Match MATLAB Phi_0 = 3.14
    InvertedPendulum_DW.UnitDelay4_DSTATE = initialState.x;
    InvertedPendulum_DW.UnitDelay3_DSTATE = initialState.x_dot;
    InvertedPendulum_DW.UnitDelay2_DSTATE = normalizeAngle(initialState.theta);
    InvertedPendulum_DW.UnitDelay1_DSTATE = initialState.theta_dot;

    function initBuffer(buffer, timeBuffer, defaultValue) {
      buffer.fill(defaultValue);
      timeBuffer.fill(0.0);
      for (let i = 0; i < DELAY_BUFFER_SIZE; i++) {
        timeBuffer[i] = currentTime - (DELAY_BUFFER_SIZE - 1 - i) * STEP_SIZE;
      }
    }

    initBuffer(InvertedPendulum_DW.TransportDelay_Buffer, InvertedPendulum_DW.TransportDelay_Time, initialState.x);
    initBuffer(InvertedPendulum_DW.TransportDelay1_Buffer, InvertedPendulum_DW.TransportDelay1_Time, initialState.x_dot);
    initBuffer(InvertedPendulum_DW.TransportDelay2_Buffer, InvertedPendulum_DW.TransportDelay2_Time, initialState.theta);
    initBuffer(InvertedPendulum_DW.TransportDelay3_Buffer, InvertedPendulum_DW.TransportDelay3_Time, initialState.theta_dot);

    InvertedPendulum_DW.TransportDelay_Head = 0;
    InvertedPendulum_DW.TransportDelay_Tail = 0;
    InvertedPendulum_DW.TransportDelay1_Head = 0;
    InvertedPendulum_DW.TransportDelay1_Tail = 0;
    InvertedPendulum_DW.TransportDelay2_Head = 0;
    InvertedPendulum_DW.TransportDelay2_Tail = 0;
    InvertedPendulum_DW.TransportDelay3_Head = 0;
    InvertedPendulum_DW.TransportDelay3_Tail = 0;

    currentTime = 0.0;
  }

  // Simulation step
  function InvertedPendulum_step(K, onStepCallback) {
    let x = InvertedPendulum_DW.UnitDelay4_DSTATE;
    let x_dot = InvertedPendulum_DW.UnitDelay3_DSTATE;
    let theta = InvertedPendulum_DW.UnitDelay2_DSTATE;
    let theta_dot = InvertedPendulum_DW.UnitDelay1_DSTATE;

    // Compute delayed states
    InvertedPendulum_Y.Sum21 = transportDelayInterpolate(
      InvertedPendulum_DW.TransportDelay_Buffer,
      InvertedPendulum_DW.TransportDelay_Time,
      InvertedPendulum_DW.TransportDelay_Head,
      InvertedPendulum_DW.TransportDelay_Tail,
      currentTime,
      DELAY_TIME
    );
    InvertedPendulum_Y.Sum1 = transportDelayInterpolate(
      InvertedPendulum_DW.TransportDelay1_Buffer,
      InvertedPendulum_DW.TransportDelay1_Time,
      InvertedPendulum_DW.TransportDelay1_Head,
      InvertedPendulum_DW.TransportDelay1_Tail,
      currentTime,
      DELAY_TIME
    );
    InvertedPendulum_Y.Sum3 = transportDelayInterpolate(
      InvertedPendulum_DW.TransportDelay2_Buffer,
      InvertedPendulum_DW.TransportDelay2_Time,
      InvertedPendulum_DW.TransportDelay2_Head,
      InvertedPendulum_DW.TransportDelay2_Tail,
      currentTime,
      DELAY_TIME
    );
    InvertedPendulum_Y.Sum2 = transportDelayInterpolate(
      InvertedPendulum_DW.TransportDelay3_Buffer,
      InvertedPendulum_DW.TransportDelay3_Time,
      InvertedPendulum_DW.TransportDelay3_Head,
      InvertedPendulum_DW.TransportDelay3_Tail,
      currentTime,
      DELAY_TIME
    );

    // LQR control: u = -K * [x, x_dot, theta-π, theta_dot]
    // K is scaled by K_t / R_pinion in App.js to match MATLAB's K_Ea
    let u = -(K[0] * x + K[1] * x_dot + K[2] * normalizeAngle(theta - Math.PI) + K[3] * theta_dot);

    // Swing-up control (adapted from MATLAB)
    const phi_swingUp_desired = 5 * Math.PI / 180; // 5 deg in radians
    const miu = 50;
    const theta_std = Math.PI - theta; // Convert to MATLAB convention (0=up)
    if (Math.abs(theta_std) > Math.PI / 4) { // Apply swing-up far from upright
      u += miu * theta_dot * Math.cos(theta_std); // MATLAB-inspired swing-up
    }

    // Apply saturation
    u = isFinite(u) ? Math.min(Math.max(u, -XDDOT_SAT_MAX), XDDOT_SAT_MAX) * XDDOT_GAIN : 0;

    // Debug logging
    if (currentTime < 0.2 || currentTime > 24.8) {
      console.log(`Step t=${currentTime.toFixed(3)}: x=${x.toFixed(3)}, x_dot=${x_dot.toFixed(3)}, theta=${theta.toFixed(3)}, theta_dot=${theta_dot.toFixed(3)}, u=${u.toFixed(3)}`);
    }

    // RK4 integration
    const nextStates = rk4Step(x, x_dot, theta, theta_dot, u, STEP_SIZE);

    // Update states
    InvertedPendulum_DW.UnitDelay4_DSTATE = nextStates.x;
    InvertedPendulum_DW.UnitDelay3_DSTATE = nextStates.x_dot;
    InvertedPendulum_DW.UnitDelay2_DSTATE = nextStates.theta;
    InvertedPendulum_DW.UnitDelay1_DSTATE = nextStates.theta_dot;

    // Update delay buffers
    function updateBuffer(buffer, timeBuffer, head, tail, value) {
      buffer[head] = value;
      timeBuffer[head] = currentTime;
      const newHead = (head + 1) % DELAY_BUFFER_SIZE;
      let newTail = tail;
      if (newHead === tail) {
        newTail = (tail + 1) % DELAY_BUFFER_SIZE;
      }
      return { head: newHead, tail: newTail };
    }

    let result = updateBuffer(
      InvertedPendulum_DW.TransportDelay_Buffer,
      InvertedPendulum_DW.TransportDelay_Time,
      InvertedPendulum_DW.TransportDelay_Head,
      InvertedPendulum_DW.TransportDelay_Tail,
      x
    );
    InvertedPendulum_DW.TransportDelay_Head = result.head;
    InvertedPendulum_DW.TransportDelay_Tail = result.tail;

    result = updateBuffer(
      InvertedPendulum_DW.TransportDelay1_Buffer,
      InvertedPendulum_DW.TransportDelay1_Time,
      InvertedPendulum_DW.TransportDelay1_Head,
      InvertedPendulum_DW.TransportDelay1_Tail,
      x_dot
    );
    InvertedPendulum_DW.TransportDelay1_Head = result.head;
    InvertedPendulum_DW.TransportDelay1_Tail = result.tail;

    result = updateBuffer(
      InvertedPendulum_DW.TransportDelay2_Buffer,
      InvertedPendulum_DW.TransportDelay2_Time,
      InvertedPendulum_DW.TransportDelay2_Head,
      InvertedPendulum_DW.TransportDelay2_Tail,
      theta
    );
    InvertedPendulum_DW.TransportDelay2_Head = result.head;
    InvertedPendulum_DW.TransportDelay2_Tail = result.tail;

    result = updateBuffer(
      InvertedPendulum_DW.TransportDelay3_Buffer,
      InvertedPendulum_DW.TransportDelay3_Time,
      InvertedPendulum_DW.TransportDelay3_Head,
      InvertedPendulum_DW.TransportDelay3_Tail,
      theta_dot
    );
    InvertedPendulum_DW.TransportDelay3_Head = result.head;
    InvertedPendulum_DW.TransportDelay3_Tail = result.tail;

    currentTime += STEP_SIZE;

    // Call callback if provided
    if (onStepCallback) {
      onStepCallback({
        time: currentTime,
        x: InvertedPendulum_Y.Sum21,
        xDot: InvertedPendulum_Y.Sum1,
        theta: normalizeAngle(InvertedPendulum_Y.Sum3),
        thetaDot: InvertedPendulum_Y.Sum2,
        controlForce: u
      });
    }
  }

  // Simulate the system
  function simulate(K, duration, onStep, initialState) {
    if (!Array.isArray(K) || K.length !== 4 || K.some(val => !isFinite(val))) {
      throw new Error("Invalid K matrix: must be a 4-element array of finite numbers");
    }

    duration = duration || 25.0; // Match MATLAB simtime
    initialState = initialState || { x: 0, theta: Math.PI }; // Match MATLAB Phi_0

    InvertedPendulum_initialize({
      x: initialState.x,
      x_dot: 0,
      theta: initialState.theta,
      theta_dot: 0
    });

    const iterations = Math.ceil(duration / STEP_SIZE);
    const results = {
      time: [],
      x: [],
      xDot: [],
      theta: [],
      thetaDot: [],
      controlForce: []
    };

    for (let i = 0; i < iterations; i++) {
      InvertedPendulum_step(K, function(state) {
        results.time.push(state.time);
        results.x.push(state.x);
        results.xDot.push(state.xDot);
        results.theta.push(state.theta);
        results.thetaDot.push(state.thetaDot);
        results.controlForce.push(state.controlForce);

        if (onStep) onStep(state);
      });

      // Early termination if unstable
      if (!isFinite(InvertedPendulum_DW.UnitDelay4_DSTATE) ||
          !isFinite(InvertedPendulum_DW.UnitDelay3_DSTATE) ||
          !isFinite(InvertedPendulum_DW.UnitDelay2_DSTATE) ||
          !isFinite(InvertedPendulum_DW.UnitDelay1_DSTATE)) {
        console.error("Simulation terminated: non-finite state detected");
        break;
      }
    }

    return results;
  }

  export { simulate, InvertedPendulum_initialize, STEP_SIZE };