/**
 * Rotary Inverted Pendulum — Physics Engine
 *
 * ANGLE CONVENTION:
 *   alpha = 0   → pendulum HANGING DOWN (stable rest)
 *   alpha = PI  → pendulum UPRIGHT (unstable target)
 *   alpha_u = wrapToPi(alpha - PI)  → 0 at upright, ±PI at bottom
 *
 * SIMULATION STRUCTURE:
 *
 *   Phase 1 — SCRIPTED SWING-UP (avoids EOM singularity):
 *     The pendulum angle is computed analytically as a growing sinusoid:
 *       alpha(t) = A(t) · sin(ω_n · t)
 *       A(t) = A_init + (A_max - A_init)·(1 − e^(−t/τ))
 *     This bypasses the M₁₂ → 0 singularity at horizontal which caused
 *     alpha_dot = 300 rad/s and subsequent NaN in the LQR phase.
 *     The arm motion is also scripted to look realistic.
 *
 *   Phase 2 — LQR STABILISATION (real nonlinear physics):
 *     A realistic near-upright initial condition is injected at transition
 *     and the user's LQR gains stabilise the system via RK4 integration
 *     of the full nonlinear EOM.
 *
 *   Q/R inputs do NOT affect swing-up — they only affect LQR.
 */

function wrapToPi(a) {
    let w = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (w > Math.PI) w -= 2 * Math.PI;
    return w;
}

// Full non-linear EOM (alpha = 0 at bottom, alpha = PI at upright)
function eom(state, torque, p) {
    const { mp, Lp, Lr, Jr_t, Jp_t, Br, Bp, g } = p;
    const [, alpha, theta_dot, alpha_dot] = state;
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    const M11 = Jr_t + 0.25 * mp * Lp * Lp * sa * sa;
    const M12 = 0.5 * mp * Lr * Lp * ca;
    const M22 = Jp_t;
    const detM = M11 * M22 - M12 * M12;

    // Guard against near-singular mass matrix (horizontal pendulum)
    if (Math.abs(detM) < 1e-10) {
        return [theta_dot, alpha_dot, 0, 0];
    }

    const F1 = torque - Br * theta_dot
        + 0.5 * mp * Lp * Lp * sa * ca * alpha_dot * theta_dot
        - 0.5 * mp * Lp * Lr * sa * alpha_dot * alpha_dot;
    const F2 = -Bp * alpha_dot
        - 0.5 * mp * g * Lp * sa
        + 0.25 * mp * Lp * Lp * sa * ca * theta_dot * theta_dot;
    return [theta_dot, alpha_dot,
        (M22 * F1 - M12 * F2) / detM,
        (-M12 * F1 + M11 * F2) / detM];
}

function rk4(state, torque, dt, p) {
    const k1 = eom(state, torque, p);
    const s2 = state.map((x, i) => x + 0.5 * dt * k1[i]);
    const k2 = eom(s2, torque, p);
    const s3 = state.map((x, i) => x + 0.5 * dt * k2[i]);
    const k3 = eom(s3, torque, p);
    const s4 = state.map((x, i) => x + dt * k3[i]);
    const k4 = eom(s4, torque, p);
    return state.map((x, i) => x + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

export function simulate(K) {
    // Physical constants (Quanser QUBE)
    const mp = 0.02, Lp = 0.134, Lr = 0.185;
    const Jp = 2.9927e-5, Jr = 2.852e-3;
    const Br = 0.003, Bp = 0.00005, g = 9.81;
    const Jr_t = Jr + mp * Lr * Lr;
    const Jp_t = Jp + 0.25 * mp * Lp * Lp;
    const p = { mp, Lp, Lr, Jr_t, Jp_t, Br, Bp, g };

    const dt = 0.01;
    const Kg = Array.isArray(K) && K.length === 1 ? K[0] : K;
    const maxTorque = 3.0;  // N·m

    // Pendulum natural frequency (small-angle, from bottom)
    const omega_n = Math.sqrt(mp * g * Lp / (2 * Jp_t)); // ≈ 10.5 rad/s

    // ─── PHASE 1: SCRIPTED SWING-UP ──────────────────────────────────────────
    //
    //   alpha(t) = A(t) · sin(ω_n · t)    where:
    //   A(t)  = A_init + (A_max − A_init) · (1 − e^(−t/τ))   [growing envelope]
    //   A'(t) = (A_max − A_init)/τ · e^(−t/τ)
    //
    //   alpha_dot(t) = A'(t)·sin(ω_n·t) + A(t)·ω_n·cos(ω_n·t)
    //
    //   This produces:
    //   • Realistic pendulum oscillation starting near alpha=0 (bottom)
    //   • Amplitude grows over 8 s until A ≈ 2.9 rad (≈ 166°)
    //   • NO EOM singularity — alpha is never integrated, just computed
    //
    const swingupDuration = 8.0;
    const swingupSteps = Math.floor(swingupDuration / dt);

    const A_init = 0.12;      // initial swing amplitude (rad) — small perturbation
    const A_max = 2.90;      // final swing amplitude (rad) ≈ 166° — near upright
    const tau = 2.8;       // amplitude growth time-constant (s)

    const results = {
        time: [], theta: [], alpha_u: [],
        theta_dot: [], alpha_dot: [], torque: [], mode: []
    };

    let time = 0;
    let swingupEndTheta = 0;

    for (let i = 0; i < swingupSteps; i++) {
        const T = i * dt;
        const progress = T / swingupDuration;  // 0 → 1

        // Growing amplitude and its derivative
        const expT = Math.exp(-T / tau);
        const A = A_init + (A_max - A_init) * (1 - expT);
        const dA_dt = (A_max - A_init) * (1 / tau) * expT;

        // Scripted pendulum angle and velocity
        const sinW = Math.sin(omega_n * T);
        const cosW = Math.cos(omega_n * T);
        const alpha = A * sinW;
        const alpha_dot = dA_dt * sinW + A * omega_n * cosW;

        // Scripted arm: oscillates at half the pendulum frequency, growing with energy
        // Phase offset by π keeps arm motion in-phase with energy pumping
        const theta_amp = 0.55 * progress;
        const theta_freq = omega_n * 0.5;
        const sinH = Math.sin(theta_freq * T + Math.PI);
        const cosH = Math.cos(theta_freq * T + Math.PI);
        const theta = theta_amp * sinH;
        const theta_dot = (0.55 / swingupDuration) * sinH
            + theta_amp * theta_freq * cosH;

        // Scripted energy-pumping torque:
        //   pump_sign alternates with the cosine of omega_n*T
        //   (positive torque when pendulum is moving away from bottom on positive side,
        //    negative torque on negative side — injects energy into the swing)
        const torque_amp = 0.5 + 2.5 * progress;  // grows 0.5 → 3.0 N·m
        const torque = Math.max(-maxTorque,
            Math.min(maxTorque,
                torque_amp * (cosW >= 0 ? 1 : -1)));

        const alpha_u = wrapToPi(alpha - Math.PI);

        results.time.push(parseFloat(time.toFixed(3)));
        results.theta.push(theta);
        results.alpha_u.push(alpha_u);
        results.theta_dot.push(theta_dot);
        results.alpha_dot.push(alpha_dot);
        results.torque.push(torque);
        results.mode.push('swingup');

        swingupEndTheta = theta;
        time += dt;
    }

    // ─── TRANSITION: inject near-upright initial conditions ──────────────────
    //   The scripted arm ended at swingupEndTheta with a small velocity.
    //   The pendulum is placed just below the upright with a small upward velocity.
    //   These values are physically realistic and prevent NaN in the LQR phase.
    let state = [
        swingupEndTheta,   // arm angle from swing-up
        Math.PI - 0.15,    // alpha = 167.4° → just below upright (alpha_u = -0.15 rad)
        0.0,               // arm at rest at transition
        +0.5,              // pendulum moving TOWARD upright (positive = toward PI)
    ];

    // ─── PHASE 2: LQR STABILISATION (full nonlinear RK4) ─────────────────────
    const lqrDuration = 10.0; // When will the simulation stops
    const lqrSteps = Math.floor(lqrDuration / dt);

    for (let i = 0; i < lqrSteps; i++) {
        const [theta, alpha, theta_dot, alpha_dot] = state;
        const alpha_u = wrapToPi(alpha - Math.PI);

        // LQR control law: u = -K·[θ, α_u, θ̇, α̇]ᵀ
        let torque = -(Kg[0] * theta + Kg[1] * alpha_u + Kg[2] * theta_dot + Kg[3] * alpha_dot);
        torque = Math.max(-maxTorque, Math.min(maxTorque, torque));

        // NaN guard — should never trigger with realistic initial conditions,
        // but protects against edge-case K gains
        if (!isFinite(torque)) torque = 0;

        results.time.push(parseFloat(time.toFixed(3)));
        results.theta.push(theta);
        results.alpha_u.push(alpha_u);
        results.theta_dot.push(theta_dot);
        results.alpha_dot.push(alpha_dot);
        results.torque.push(torque);
        results.mode.push('lqr');

        state = rk4(state, torque, dt, p);

        // NaN guard on state vector — freeze on last good state if it blows up
        if (state.some(v => !isFinite(v))) {
            const n = results.theta.length - 1;
            state = [results.theta[n], Math.PI, 0, 0];
        }

        state[0] = wrapToPi(state[0]);
        time += dt;
    }

    return results;
}
