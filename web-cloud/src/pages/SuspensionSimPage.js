import React, { useState, useEffect, useRef } from "react";
import "./suspensionSimPage.css";
import { Helmet } from "react-helmet-async";
import { SuspensionURDFViewer } from "../experiments/suspension/SuspensionURDFViewer/SuspensionURDFViewer.jsx";
import { A, B, simulate } from "../experiments/suspension/suspensionPhysics.js";
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

// ---- Chart helper config ----
const CHART_OPTIONS = (yLabel) => ({
  animation: false,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
      labels: { color: 'var(--text-color)' }
    },
  },
  scales: {
    x: {
      type: "category",
      title: { display: true, text: "Time (s)", color: "var(--text-color)" },
      ticks: { color: "var(--text-color)", autoSkip: true, maxTicksLimit: 10 },
      grid: { color: "var(--border-color)" }
    },
    y: {
      title: { display: true, text: yLabel, color: "var(--text-color)" },
      ticks: { color: "var(--text-color)" },
      grid: { color: "var(--border-color)" }
    },
  },
});

const DEFAULT_Q = [
  [800, 0, 0, 0],
  [0, 200, 0, 0],
  [0, 0, 800, 0],
  [0, 0, 0, 20],
];
const DEFAULT_R = [[0.05]];

const SuspensionSimPage = () => {
  const [qMatrix, setQMatrix] = useState(DEFAULT_Q);
  const [rMatrix, setRMatrix] = useState(DEFAULT_R);
  const [kGains, setKGains] = useState([0, 0, 0, 0]);

  // Simulation Results
  const [simData, setSimData] = useState(null);

  // Animation state
  const [simStep, setSimStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const animationRef = useRef(null);

  // Viewer state
  const [zoom, setZoom] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Road disturbance parameters
  const [roadAmp, setRoadAmp] = useState(0.01);
  const [roadFreq, setRoadFreq] = useState(0.5);

  useEffect(() => {
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  const handleStartSimulation = () => {
    if (isRunning) {
      setIsRunning(false);
      cancelAnimationFrame(animationRef.current);
      return;
    }
    try {
      const K = lqrJS(A, B, qMatrix, rMatrix);
      const computedKg = [K[0][0], K[0][1], K[0][2], K[0][3]];
      setKGains(computedKg);

      const res = simulate(computedKg, {
        amplitude: roadAmp,
        frequency: roadFreq,
        duration: 20.0,
        controlStartTime: 10.0
      });
      setSimData(res);
      setSimStep(0);
      setIsRunning(true);
      playAnimation(res.time.length);
    } catch (error) {
      console.error("LQR Calculation or Simulation failed:", error);
      alert("Failed to compute LQR gains or run simulation.");
    }
  };

  const playAnimation = (maxSteps) => {
    cancelAnimationFrame(animationRef.current);
    let currentStep = 0;

    const loop = () => {
      // Advance by multiples to speed up visual
      currentStep += 4;
      if (currentStep >= maxSteps) {
        currentStep = maxSteps - 1;
        setSimStep(currentStep);
        setIsRunning(false);
        return;
      }
      setSimStep(currentStep);
      animationRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const handleQChange = (row, col, value) => {
    const newQ = [...qMatrix];
    newQ[row][col] = parseFloat(value) || 0;
    setQMatrix(newQ);
  };

  const handleRChange = (value) => {
    setRMatrix([[parseFloat(value) || 0]]);
  };

  const formatChartData = (label, dataArray, color) => {
    if (!simData) return { labels: [], datasets: [] };

    // Decimate for charting performance
    const step = 5;
    const labels = simData.time.filter((_, i) => i % step === 0);

    // Draw live by masking future data points with null
    const data = dataArray.filter((_, i) => i % step === 0).map((val, index) => {
      const realIndex = index * step;
      return realIndex <= simStep ? val : null;
    });

    return {
      labels,
      datasets: [
        {
          label: label,
          data: data,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
        },
      ],
    };
  };

  return (
    <div className="sim-page-wrapper">
      <Helmet><title>Active Suspension Simulation</title></Helmet>
      <h1 className="sim-page-title">Active Suspension System</h1>
      <Modal />

      {/* LEFT COLUMN */}
      <div className="sim-container">
        <div className="sim-left-panel">
          <h3>LQR Parameters</h3>

          <div className="matrix-input-section">
            <div className="matrix-container q-matrix">
              <h3>Q Matrix (State Penalty)</h3>
              <div className="q-inputs-suspension">
                <div className="q-row">
                  <label>Travel (Z_s - Z_us)</label>
                  <input type="number" step="10" value={qMatrix[0][0]} onChange={(e) => handleQChange(0, 0, e.target.value)} />
                </div>
                <div className="q-row">
                  <label>S_Vel (Z_s dot)</label>
                  <input type="number" step="10" value={qMatrix[1][1]} onChange={(e) => handleQChange(1, 1, e.target.value)} />
                </div>
                <div className="q-row">
                  <label>Deflection (Z_us - Z_r)</label>
                  <input type="number" step="10" value={qMatrix[2][2]} onChange={(e) => handleQChange(2, 2, e.target.value)} />
                </div>
                <div className="q-row">
                  <label>T_Vel (Z_us dot)</label>
                  <input type="number" step="1" value={qMatrix[3][3]} onChange={(e) => handleQChange(3, 3, e.target.value)} />
                </div>
              </div>
            </div>

            <div className="matrix-container r-matrix">
              <h3>R Matrix & Road</h3>
              <div className="r-inputs-suspension">
                <label>R (F_c)</label>
                <input type="number" step="0.01" value={rMatrix[0][0]} onChange={(e) => handleRChange(e.target.value)} />
              </div>
              <div className="road-inputs-suspension mt-3">
                <div className="q-row">
                  <label>Road Amp</label>
                  <input type="number" step="0.01" value={roadAmp} onChange={(e) => setRoadAmp(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="q-row mt-2">
                  <label>Road Freq (rad/s)</label>
                  <input type="number" step="0.1" value={roadFreq} onChange={(e) => setRoadFreq(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </div>

            <button
              className={`btn ${isRunning ? 'btn-danger' : 'btn-primary'} start-sim-btn`}
              onClick={handleStartSimulation}
            >
              {isRunning ? "Stop Simulation" : "Start Simulation"}
            </button>
        </div>

        <div className="sim-right-panel">
          <div className="viewer-header">
            <h3>3D URDF View</h3>
            <div className="viewer-tools">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>-</button>
              <span>Zoom</span>
              <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))}>+</button>
            </div>
          </div>
          <div className="viewer-container">
            <SuspensionURDFViewer
              zr={simData ? simData.zr[simStep] : 0}
              zus_zr={simData ? simData.tire_deflection[simStep] : 0}
              zs_zus={simData ? simData.suspension_travel[simStep] : 0}
              zoom={zoom}
            />
          </div>

          <div className="sim-info-footer mt-3">
            <p className="sim-description text-muted">
              <strong>t &lt; 10s</strong>: Passive (No Control)<br />
              <strong>t &ge; 10s</strong>: Active LQR Control activated based on your Q and R weights.
            </p>
            {simData && (
              <div className="sim-status mt-2">
                Time: {simData.time[simStep].toFixed(2)}s | Mode: <span className={simData.mode[simStep]}>{simData.mode[simStep].toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      {simData && (
        <div className="charts-section suspension-charts">

          <h3>System Response</h3>
          <div className="chart-card">
            <h4>Suspension Travel (Z_s - Z_us)</h4>
            <div className="chart-wrapper">
              <Line data={formatChartData('Travel (m)', simData.suspension_travel, '#007bff')} options={CHART_OPTIONS('Travel (m)')} />
            </div>
          </div>

          <div className="chart-card">
            <h4>Ride Comfort (Sprung Accel Z_s ddot)</h4>
            <div className="chart-wrapper">
              <Line data={formatChartData('Accel (m/s²)', simData.acceleration, '#28a745')} options={CHART_OPTIONS('Accel (m/s²)')} />
            </div>
          </div>

          <div className="chart-card">
            <h4>Road Handling (Tire Deflect Z_us - Z_r)</h4>
            <div className="chart-wrapper">
              <Line data={formatChartData('Deflection (m)', simData.tire_deflection, '#dc3545')} options={CHART_OPTIONS('Deflection (m)')} />
            </div>
          </div>

          <h3>Control Output</h3>
          <div className="chart-card">
            <h4>Control Force (F_c)</h4>
            <div className="chart-wrapper">
              <Line data={formatChartData('Force (N)', simData.control_force, '#ffc107')} options={CHART_OPTIONS('Force (N)')} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SuspensionSimPage;
