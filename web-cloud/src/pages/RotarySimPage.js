import { useState, useEffect, useRef } from "react";
import "./RotarySimPage.css";
import { Helmet } from "react-helmet-async";
import { FurutaURDFViewer } from "../experiments/furuta/FurutaURDFViewer/FurutaURDFViewer.jsx";
import { simulate } from "../experiments/furuta/furutaPhysics.js";
import React from "react";
import { lqrJS } from "../controllers/LQR/lqr_calc.js";
import Modal from "../components/ModalSim.js";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

// ---- System physical parameters (same as physics engine) ----
const mp = 0.02,
  Lp = 0.134,
  Lr = 0.185;
const Jp = 2.9927e-5,
  Jr = 2.852e-3;
const Br = 0.003,
  Bp = 0.00005,
  g = 9.81;
const Jr_t = Jr + mp * Lr * Lr;
const Jp_t = Jp + 0.25 * mp * Lp * Lp;
const Jx = 0.5 * mp * Lp * Lr;
const detM = Jr_t * Jp_t - Jx * Jx;

// Linearized A and B about the upright equilibrium  (alpha = PI, alpha_u = 0)
// Using alpha_u as the small deviation: alpha = PI + alpha_u
// At the upright point, linearization gives (from the full EOM):
// Linearised system matrices at upright equilibrium (alpha = PI, alpha_u = 0)
// State: [theta, alpha_u, theta_dot, alpha_dot]
// At upright: cos(PI)=-1, sin(PI)=0 → M12_up = 0.5·mp·Lr·Lp·(-1) = -Jx
// F2 ≈ -Bp·alpha_dot + 0.5·mp·g·Lp·alpha_u   (gravity destabilises upward)
// B[3] = -M12_up/det = +Jx/det   (NOT -Jx as in old code — wrong sign)
const A = [
  [0, 0, 1, 0],
  [0, 0, 0, 1],
  [0, (Jx * 0.5 * mp * Lp * g) / detM, -(Jp_t * Br) / detM, -(Jx * Bp) / detM],
  [
    0,
    (Jr_t * 0.5 * mp * Lp * g) / detM,
    -(Jx * Br) / detM,
    -(Jr_t * Bp) / detM,
  ],
];
const B = [[0], [0], [Jp_t / detM], [Jx / detM]];

// ---- Chart helper config ----
const CHART_OPTIONS = (yLabel) => ({
  animation: false,
  responsive: true,
  plugins: {
    legend: {
      position: "top",
    },
  },
  scales: {
    x: {
      type: "category",
      title: { display: true, text: "Time (s)", color: "#333" },
      min: 0,
    },
    y: {
      title: { display: true, text: yLabel, color: "#333" },
      ticks: { color: "#333" },
    },
  },
});

function makeDataset(label, data, color) {
  return {
    label,
    data,
    borderColor: color,
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.1,
  };
}

// ---- Number of frames to advance per animation frame (playback speed) ----
const PLAYBACK_SKIP = 4; // advance 4 simulation steps per browser frame (20ms simulated per ~16ms real)

const RotarySim = () => {
  const urdfUrl = "rotary_pendulum_urdf/urdf/rotary_pendulum_urdf.urdf";

  // ---- LQR inputs ----
  const [QValues, setQValues] = useState({
    Q00: "10",
    Q01: "0",
    Q02: "0",
    Q03: "0",
    Q10: "0",
    Q11: "500",
    Q12: "0",
    Q13: "0",
    Q20: "0",
    Q21: "0",
    Q22: "1",
    Q23: "0",
    Q30: "0",
    Q31: "0",
    Q32: "0",
    Q33: "20",
  });
  const [RValue, setRValue] = useState("0.05");
  const [kValues, setKValues] = useState([0, 0, 0, 0]);

  function handleInputChange(e) {
    const { name, value } = e.target;
    if (name === "R") setRValue(value);
    else setQValues((prev) => ({ ...prev, [name]: value }));
  }

  // ---- Compute LQR K vector ----
  function getKMatrix() {
    const Q = [
      [
        parseFloat(QValues.Q00) || 0,
        parseFloat(QValues.Q01) || 0,
        parseFloat(QValues.Q02) || 0,
        parseFloat(QValues.Q03) || 0,
      ],
      [
        parseFloat(QValues.Q10) || 0,
        parseFloat(QValues.Q11) || 0,
        parseFloat(QValues.Q12) || 0,
        parseFloat(QValues.Q13) || 0,
      ],
      [
        parseFloat(QValues.Q20) || 0,
        parseFloat(QValues.Q21) || 0,
        parseFloat(QValues.Q22) || 0,
        parseFloat(QValues.Q23) || 0,
      ],
      [
        parseFloat(QValues.Q30) || 0,
        parseFloat(QValues.Q31) || 0,
        parseFloat(QValues.Q32) || 0,
        parseFloat(QValues.Q33) || 0,
      ],
    ];
    const R = [[parseFloat(RValue) || 0]];
    try {
      const K = lqrJS(A, B, Q, R);
      if (!K || K.length !== 1 || K[0].length !== 4 || K[0].some(isNaN))
        throw new Error("Invalid K");
      setKValues(K[0]);
      return K[0];
    } catch (err) {
      alert("LQR failed: " + err.message);
      return null;
    }
  }

  // ---- Simulation state ----
  const [simResults, setSimResults] = useState(null); // full pre-computed data
  const [isRunning, setIsRunning] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0); // current playback index
  const [controlMode, setControlMode] = useState("—"); // display current phase

  const isRunningRef = useRef(false);
  const frameRef = useRef(null);
  const stepRef = useRef(0);
  // IMPORTANT: Store simResults in a ref so animateFrame can always access the
  // latest value synchronously — React setState is async and causes stale closure bugs.
  const simResultsRef = useRef(null);

  // ---- Start / Stop ----
  function toggleSimulation() {
    if (isRunning) {
      isRunningRef.current = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      setIsRunning(false);
      return;
    }

    const K = getKMatrix();
    if (!K) return;

    // Pre-compute entire simulation (offline, synchronous)
    const results = simulate(K);

    // Store in REF synchronously — DO NOT rely on setState alone,
    // because requestAnimationFrame fires before React re-renders.
    simResultsRef.current = results;
    setSimResults(results); // also update state for chart rendering
    setCurrentFrame(0);

    isRunningRef.current = true;
    setIsRunning(true);
    setControlMode("Swing\u2011Up");

    // Cancel any previous animation then start fresh
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(animateFrame);
  }

  function animateFrame() {
    if (!isRunningRef.current) return;

    // Use the REF (not state) to avoid stale closure — the ref is set synchronously.
    const data = simResultsRef.current;
    if (!data) {
      isRunningRef.current = false;
      setIsRunning(false);
      return;
    }

    setCurrentFrame((prev) => {
      const next = prev + PLAYBACK_SKIP;
      if (next >= data.time.length) {
        // Simulation finished — freeze on last frame
        isRunningRef.current = false;
        setIsRunning(false);
        setControlMode("Done");
        return data.time.length - 1;
      }
      if (data.mode && data.mode[next]) {
        setControlMode(
          data.mode[next] === "lqr" ? "LQR Stabilization" : "Swing\u2011Up",
        );
      }
      return next;
    });

    if (isRunningRef.current) {
      frameRef.current = requestAnimationFrame(animateFrame);
    }
  }

  // Cleanup on unmount
  useEffect(
    () => () => {
      isRunningRef.current = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // ---- Build chart data up to currentFrame ----
  function buildChartData(dataKey, label, color) {
    if (!simResults)
      return { labels: [], datasets: [makeDataset(label, [], color)] };
    const slice_t = simResults.time.slice(0, currentFrame);
    const slice_d = simResults[dataKey].slice(0, currentFrame);
    // Downsample labels to avoid rendering thousands of points
    const MAX_PTS = 500;
    const skip = Math.max(1, Math.floor(slice_t.length / MAX_PTS));
    const labels = slice_t
      .filter((_, i) => i % skip === 0)
      .map((t) => t.toFixed(2));
    const data = slice_d.filter((_, i) => i % skip === 0);
    return { labels, datasets: [makeDataset(label, data, color)] };
  }

  const currentAlphaU = simResults
    ? (simResults.alpha_u[currentFrame] ?? 0)
    : 0;
  const currentTheta = simResults ? (simResults.theta[currentFrame] ?? 0) : 0;
  // joint2ForURDF: raw alpha angle (0 = hanging down, PI = upright)
  // This is alpha_u + PI, because alpha_u = alpha - PI → alpha = alpha_u + PI
  // When simulation not started, joint2 = 0 → URDF shows pendulum hanging down ✓
  const joint2ForURDF = simResults ? currentAlphaU + Math.PI : 0;

  return (
    <div>
      <div className="containerQ">
        <Helmet>
          <title>Rotary Inverted Pendulum Simulation</title>
        </Helmet>
        <h1>Rotary Inverted Pendulum</h1>
        <Modal />

        {/* ---- LQR Input Panel ---- */}
        <div className="K-inputs">
          <h2>LQR Parameters</h2>
          <div className="raw16">
            {/* Q matrix 4×4 */}
            <div className="q-matrix-container">
              <h3>Q Matrix (4×4)</h3>
              <p
                style={{
                  fontSize: "0.78em",
                  color: "var(--text-secondary)",
                  margin: "0 0 8px",
                }}
              >
                State order: θ (arm angle) | α (pendulum error) | θ̇ | α̇
              </p>
              <div className="q-matrix-grid">
                <div className="matrix-label" />
                {["θ", "α", "θ̇", "α̇"].map((l, i) => (
                  <div className="matrix-label" key={i}>
                    {l}
                  </div>
                ))}
                {[...Array(4)].map((_, row) => (
                  <React.Fragment key={row}>
                    <div className="matrix-label">
                      {["θ", "α", "θ̇", "α̇"][row]}
                    </div>
                    {[...Array(4)].map((_, col) => (
                      <div className="input-group" key={col}>
                        <input
                          type="number"
                          name={`Q${row}${col}`}
                          value={QValues[`Q${row}${col}`]}
                          onChange={handleInputChange}
                          step="0.1"
                        />
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* R and K display */}
            <div className="r-matrix-container">
              <h4>R Value (torque penalty)</h4>
              <div className="input-group">
                <input
                  type="number"
                  name="R"
                  value={RValue}
                  onChange={handleInputChange}
                  step="0.01"
                />
              </div>
            </div>
            <button
              onClick={toggleSimulation}
              className="toggle-button1"
              style={{ marginBottom: "28px" }}
            >
              {isRunning ? "Stop Simulation" : "Start Simulation"}
            </button>
          </div>
        </div>


        {/* 3D Viewer */}
        <div
          className="video-stream-instance1"
          style={{ marginBottom: "40px", display: "block", marginTop: "20px" }}
        >
          <FurutaURDFViewer
            urdfUrl={urdfUrl}
            width="100%"
            height="100%"
            joint1={currentTheta}
            joint2={joint2ForURDF}
          />
          { controlMode && (
            <div
              style={{
                marginTop: "20px",
                padding: "8px 12px",
                borderRadius: "6px",
                background: controlMode.includes("LQR") ? "#d4edda" : "#fff3cd",
                color: controlMode.includes("LQR") ? "#155724" : "#856404",
                fontWeight: "bold",
                fontSize: "0.9em",
              }}
            >
              Phase: {controlMode}
            </div>
          )}
        </div>

        {/* Charts: drawn in real time */}
        <div className="chart-container">
          <div className="chart">
            <h3>Arm Angle θ (rad)</h3>
            <Line
              data={buildChartData("theta", "θ", "#36A2EB")}
              options={CHART_OPTIONS("θ (rad)")}
            />
          </div>
          <div className="chart">
            <h3>Pendulum Error α_u (rad)</h3>
            <p
              style={{
                fontSize: "0.75em",
                color: "var(--text-secondary)",
                margin: "-8px 0 6px",
              }}
            >
              0 = upright balanced
            </p>
            <Line
              data={buildChartData("alpha_u", "α_u", "#FF6384")}
              options={CHART_OPTIONS("α_u (rad)")}
            />
          </div>
        </div>

        <div className="chart-container">
          <div className="chart">
            <h3>Arm Velocity θ̇ (rad/s)</h3>
            <Line
              data={buildChartData("theta_dot", "θ̇", "#4BC0C0")}
              options={CHART_OPTIONS("θ̇ (rad/s)")}
            />
          </div>
          <div className="chart">
            <h3>Pendulum Velocity α̇ (rad/s)</h3>
            <Line
              data={buildChartData("alpha_dot", "α̇", "#FFCE56")}
              options={CHART_OPTIONS("α̇ (rad/s)")}
            />
          </div>
        </div>

        <div className="chart-container" style={{ marginBottom: "60px" }}>
          <div className="chart">
            <h3>Control Torque (N·m)</h3>
            <p
              style={{
                fontSize: "0.75em",
                color: "var(--text-secondary)",
                margin: "-8px 0 -6px",
              }}
            >
              Swing‑up: energy pumping &nbsp;|&nbsp; LQR: state-feedback
              stabilization
            </p>
            <Line
              data={buildChartData("torque", "u (N·m)", "#9966FF")}
              options={CHART_OPTIONS("Torque (N·m)")}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RotarySim;
