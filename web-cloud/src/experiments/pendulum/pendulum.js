class InvertedPendulum {
    constructor() {
        // Match DW_IP_SwingUp_Design_T structure
        this.states = {
            X_pos_DSTATE: 0,
            X_dpos_DSTATE: 0,
            theta_pos_DSTATE: 0.017453292519943295,
            theta_d_DSTATE: 0,
            UnitDelay1_DSTATE: 0.017453292519943295,
            UnitDelay2_DSTATE: 0,
            UnitDelay_DSTATE: 0
        };

        // External outputs (matching ExtY structure)
        this.outputs = {
            Outport: 0,
            Outport1: 0,
            Outport2: 0,
            Outport3: 0
        };

        this.KK = [0, 0, 0, 0];
        this.dt = 0.001;
        this.data = [];
    }

    step() {
        const s = this.states;
        const y = this.outputs;

        // Match exact C code order
        const rtb_theta_pos = s.theta_pos_DSTATE;
        
        // This is the key fix - use modulo exactly as C code does
        y.Outport1 = this.modulo(s.theta_pos_DSTATE, 6.2831853071795862);
        const rtb_x_dot = s.X_dpos_DSTATE;
        
        // First trigonometry block
        const rtb_theta_dd = Math.cos(s.theta_pos_DSTATE);
        const u = rtb_theta_dd * s.theta_d_DSTATE;
        
        // Sign computation
        let rtb_Gain2;
        if (isNaN(u)) {
            rtb_Gain2 = NaN;
        } else if (u < 0.0) {
            rtb_Gain2 = -1.0;
        } else {
            rtb_Gain2 = u > 0.0 ? 1.0 : 0.0;
        }

        // Square and swing-up control
        const u_sqr = s.theta_d_DSTATE * s.theta_d_DSTATE;
        let rtb_Product1_h = ((1.0 - rtb_theta_dd) * 0.42644 + 
                           u_sqr * 0.0066654 - 0.85288) * rtb_Gain2;

        // Saturation
        rtb_Product1_h = Math.max(-29.43, Math.min(29.43, rtb_Product1_h));
        
        // Force calculation
        const rtb_sintheta = 9.81 * rtb_Product1_h * 1.1;
        rtb_Gain2 = 1.664 * rtb_sintheta;
        rtb_Product1_h = rtb_sintheta * rtb_theta_dd;
        
        // Second trigonometry block
        const sin_theta = Math.sin(s.theta_pos_DSTATE);
        
        // Gain calculations
        const rtb_Gain7 = (7.892E-5 * s.theta_d_DSTATE + 
                        0.04347 * rtb_Product1_h + 
                        0.42644 * sin_theta) * rtb_theta_dd * 3.2609;
        
        const rtb_Gain6 = u_sqr * sin_theta * 0.04347;
        
        y.Outport3 = s.theta_d_DSTATE;

        // Unit delay trig functions
        const rtb_TrigonometricFunction2 = Math.cos(s.UnitDelay1_DSTATE);
        const rtb_sintheta_ud = Math.sin(s.UnitDelay1_DSTATE);

        // Theta acceleration
        const theta_dd = (0.0 - 7.892E-5 * s.theta_d_DSTATE -
                       (s.UnitDelay2_DSTATE * rtb_TrigonometricFunction2 + 
                        9.81 * rtb_sintheta_ud) * 0.04347) * 75.014;

        // LQR control
        let lqr_u = (0.0 - s.X_pos_DSTATE) * this.KK[0] +
                    (3.1415926535897931 - y.Outport1) * this.KK[1] +
                    (0.0 - s.X_dpos_DSTATE) * this.KK[2] +
                    (0.0 - s.theta_d_DSTATE) * this.KK[3];

        // Control selection based on angle
        if (Math.abs(3.1415926535897931 - y.Outport1) * 57.295779513082323 <= 25.0) {
            lqr_u = Math.max(-12.0, Math.min(12.0, lqr_u));
            rtb_Gain2 = (5.4249e-05 * lqr_u - 0.00012206 * s.X_dpos_DSTATE) * 5432.7;
        } else {
            rtb_Gain2 = rtb_Gain2 - rtb_Gain7 - rtb_Gain6;
        }

        // Final acceleration calculation
        s.UnitDelay2_DSTATE = ((u_sqr * rtb_sintheta_ud -
            rtb_TrigonometricFunction2 * theta_dd) * 0.04347 +
            rtb_Gain2 - 2.9907 * s.UnitDelay_DSTATE) * 0.60096;

        y.Outport2 = s.X_dpos_DSTATE;
        y.Outport = s.X_pos_DSTATE;

        // Update states in exact C order
        s.UnitDelay_DSTATE = rtb_x_dot;
        s.UnitDelay1_DSTATE = rtb_theta_pos;
        
        s.X_pos_DSTATE += 0.001 * s.X_dpos_DSTATE;
        s.theta_pos_DSTATE += 0.001 * s.theta_d_DSTATE;
        s.X_dpos_DSTATE += 0.001 * s.UnitDelay2_DSTATE;
        s.theta_d_DSTATE += 0.001 * theta_dd;

        // Store data for plotting - change angle to use raw theta_pos instead of modulo
        this.data.push({
            time: this.data.length * this.dt,
            position: s.X_pos_DSTATE,
            angle: s.theta_pos_DSTATE,    // Changed from y.Outport1 to match C behavior
            velocity: s.X_dpos_DSTATE,
            angularVelocity: s.theta_d_DSTATE
        });
    }

    modulo(x, m) {
        if (m === 0) return x === 0 ? m : x;
        if (isNaN(x) || isNaN(m) || !isFinite(x)) return NaN;
        if (x === 0) return 0;
        if (!isFinite(m)) return m < 0 !== x < 0 ? m : x;
        
        let y = x % m;
        if (y === 0 && x < 0) return 0;
        if (x < 0 !== m < 0 && y !== 0) y += m;
        return y;
    }

    reset() {
        this.states = {
            X_pos_DSTATE: 0,
            X_dpos_DSTATE: 0,
            theta_pos_DSTATE: 0.017453292519943295,
            theta_d_DSTATE: 0,
            UnitDelay1_DSTATE: 0.017453292519943295,
            UnitDelay2_DSTATE: 0,
            UnitDelay_DSTATE: 0
        };
        this.data = [];
    }

    setGains(gains) {
        this.KK = gains;
    }

    exportCSV() {
        let csv = 'Time,Position,Angle,Velocity,AngularVelocity\n';
        this.data.forEach(row => {
            csv += `${row.time},${row.position},${row.angle},${row.velocity},${row.angularVelocity}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pendulum_data.csv';
        a.click();
    }
}

function simulate(K) {
    const pendulum = new InvertedPendulum();
    const simTime = 20; // 20 seconds simulation
    const iterations = simTime / pendulum.dt; // 20/0.001 = 20000 iterations
    let i = 0;
    
    // Set gains in the correct order [K0, -K2, K1, -K3]
    pendulum.setGains([K[0], -K[2], K[1], -K[3]]);
    pendulum.reset();
    
    var SIO = {
        XPos: [],
        XVel: [],
        YPos: [],
        YVel: []
    };
    
    while (i < iterations) {
        pendulum.step();
        SIO.XPos.push(pendulum.states.X_pos_DSTATE);
        SIO.XVel.push(-pendulum.states.X_dpos_DSTATE);
        SIO.YPos.push(-pendulum.outputs.Outport1 + 3.1415926535897931);
        SIO.YVel.push(-pendulum.states.theta_d_DSTATE);
        i++;
    }
    
    // Normalize XPos and XVel if max absolute value exceeds 0.428
    const maxAbsPos = Math.max(...SIO.XPos.map(Math.abs));
    if (maxAbsPos > 0.856) {
        const scaleFactor = 0.856 / maxAbsPos;
        SIO.XPos = SIO.XPos.map(x => x * scaleFactor);
        SIO.XVel = SIO.XVel.map(x => x * scaleFactor);
    }
    
    return SIO;
}

export { simulate };