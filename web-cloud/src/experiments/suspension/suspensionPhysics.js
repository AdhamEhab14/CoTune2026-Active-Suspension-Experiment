// Active Suspension Physics Engine

// 1. PHYSICAL PARAMETERS
export const Ms = 1.42;     // Sprung mass [kg]
export const Mus = 0.580;   // Unsprung mass [kg]
export const Ks = 697.0;    // Suspension stiffness [N/m]
export const Kus = 1140.0;  // Tire stiffness [N/m]
export const Bs = 5.0;      // Suspension damping [N*s/m]
export const Bus = 3.6;     // Tire damping [N*s/m]

// 2. STATE-SPACE REPRESENTATION
// States: [zs - zus, zs_dot, zus - zr, zus_dot]
export const A = [
    [0, 1, 0, -1],
    [-Ks / Ms, -Bs / Ms, 0, Bs / Ms],
    [0, 0, 0, 1],
    [Ks / Mus, Bs / Mus, -Kus / Mus, -(Bs + Bus) / Mus],
];

// Control input u = Fc (Active Force in Newtons)
export const B = [
    [0],
    [1 / Ms],
    [0],
    [-1 / Mus]
];

// Simulation wrapper
export const simulate = (Kg, params = {}) => {
    const {
        maxForce = 5000,
        amplitude = 0.05, // 5cm default
        frequency = 0.5,  // 0.5 Hz default
        duration = 20.0,
        controlStartTime = 10.0
    } = params;

    let dt = 0.01;
    let steps = Math.floor(duration / dt);

    let time = 0;
    
    // Absolute States: [zs, zs_dot, zus, zus_dot, zr]
    let state = [0, 0, 0, 0, 0];

    let results = {
        time: [],
        zs: [],
        zus: [],
        zr: [],
        suspension_travel: [],
        acceleration: [],
        tire_deflection: [],
        control_force: [],
        mode: []
    };

    // RK4 Integrator specific to Quarter-Car
    const computeDerivatives = (t, st, force) => {
        let [zs, zs_dot, zus, zus_dot, current_zr] = st;
        
        // Square wave input: sudden plateau shifts
        let target_zr = amplitude * (Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1);
        
        // Low-pass filter the square wave to provide a finite but massive 'jerk' velocity
        let tau = 0.05; // 50ms transition settling time
        let zr_dot = (target_zr - current_zr) / tau;

        // Forces
        let Fs_k = Ks * (zus - zs);
        let Fs_b = Bs * (zus_dot - zs_dot);
        let Ft_k = Kus * (current_zr - zus);
        let Ft_b = Bus * (zr_dot - zus_dot);

        let zs_ddot = (Fs_k + Fs_b + force) / Ms;
        let zus_ddot = (Ft_k + Ft_b - Fs_k - Fs_b - force) / Mus;

        return [zs_dot, zs_ddot, zus_dot, zus_ddot, zr_dot];
    };

    for (let i = 0; i < steps; i++) {
        let [zs, zs_dot, zus, zus_dot, zr] = state;
        
        let xlqr = [
            zs - zus,
            zs_dot,
            zus - zr,
            zus_dot
        ];

        let mode = time < controlStartTime ? "passive" : "active";

        // Compute Control Force
        let u = 0;
        if (mode === "active") {
            u = -(Kg[0] * xlqr[0] + Kg[1] * xlqr[1] + Kg[2] * xlqr[2] + Kg[3] * xlqr[3]);
            u = Math.max(-maxForce, Math.min(maxForce, u));
        }

        // Compute Acceleration for Chart (Ride Comfort)
        let Fs_k = Ks * (zus - zs);
        let Fs_b = Bs * (zus_dot - zs_dot);
        let current_zs_ddot = (Fs_k + Fs_b + u) / Ms;

        results.time.push(parseFloat(time.toFixed(3)));
        results.zs.push(zs);
        results.zus.push(zus);
        results.zr.push(zr);
        results.suspension_travel.push(xlqr[0]);
        results.acceleration.push(current_zs_ddot);
        results.tire_deflection.push(xlqr[2]);
        results.control_force.push(u);
        results.mode.push(mode);

        // RK4 Integration
        let k1 = computeDerivatives(time, state, u);
        
        let state_k2 = state.map((v, idx) => v + 0.5 * dt * k1[idx]);
        let k2 = computeDerivatives(time + 0.5 * dt, state_k2, u);
        
        let state_k3 = state.map((v, idx) => v + 0.5 * dt * k2[idx]);
        let k3 = computeDerivatives(time + 0.5 * dt, state_k3, u);
        
        let state_k4 = state.map((v, idx) => v + dt * k3[idx]);
        let k4 = computeDerivatives(time + dt, state_k4, u);

        state = state.map((v, idx) => v + (dt / 6.0) * (k1[idx] + 2 * k2[idx] + 2 * k3[idx] + k4[idx]));

        time += dt;
    }

    return results;
};
