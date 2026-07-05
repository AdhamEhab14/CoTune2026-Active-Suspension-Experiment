import { useState, useEffect, useRef } from "react";
import "./invsim.css";
import { Helmet } from "react-helmet-async";
import { InvURDFViewer } from "../experiments/pendulum/InvURDFViewer/InvURDFViewer.jsx";
import { simulate } from "../experiments/pendulum/pendulum.js";
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

function App() {
  const urdfUrl = "invurdf2/urdf/invurdf2.urdf";
  const [simulationData, setSimulationData] = useState({
    joint1: 0,
    joint2: 0,
    xposData: [],
    yposData: [],
    xvelData: [],
    yvelData: [],
    timestamps: [],
  });
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const isAnimating = useRef(false);
  const frameIdRef = useRef(null);
  const stepRef = useRef(0);
  const [QValues, setQValues] = useState({
    Q00: "1000",
    Q01: "0",
    Q02: "0",
    Q03: "0",
    Q10: "0",
    Q11: "100",
    Q12: "0",
    Q13: "0",
    Q20: "0",
    Q21: "0",
    Q22: "2000",
    Q23: "0",
    Q30: "0",
    Q31: "0",
    Q32: "0",
    Q33: "500",
  });
  const [RValue, setRValue] = useState("0.2");
  const [manualJoint1, setManualJoint1] = useState("0");
  const [useManualJoint1, setUseManualJoint1] = useState(false);
  const [useSliders, setUseSliders] = useState(false);
  const [sliderJoint1, setSliderJoint1] = useState(0);
  const [sliderJoint2, setSliderJoint2] = useState(0);

  const A = [
    [0, 1, 0, 0],
    [0, -1.96465757924125, -0.913494826736738, 0.00856855198611895],
    [0, 0, 0, 1],
    [0, 6.40649210622148, 34.967917913272, -0.327997941221576],
  ];
  const B = [[0], [0.656922318935786], [0], [-2.14213799652974]];

  function handleInputChange(e) {
    const { name, value } = e.target;
    if (name === "R") {
      setRValue(value);
    } else {
      setQValues((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  }

  function handleManualJoint1Change(e) {
    setManualJoint1(e.target.value);
  }

  function handleSliderJoint1Change(e) {
    const value = parseFloat(e.target.value);
    setSliderJoint1(value);
    if (useSliders) {
      setSimulationData((prev) => ({
        ...prev,
        joint1: value,
      }));
    }
  }

  function handleSliderJoint2Change(e) {
    const value = parseFloat(e.target.value);
    setSliderJoint2(value);
    if (useSliders) {
      setSimulationData((prev) => ({
        ...prev,
        joint2: value,
      }));
    }
  }

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
    if (
      Q.flat().some(isNaN) ||
      isNaN(R[0][0]) ||
      Q.flat().some((v) => !isFinite(v)) ||
      !isFinite(R[0][0])
    ) {
      alert("Q and R values must be valid numbers.");
      return null;
    }
    try {
      const K = lqrJS(A, B, Q, R);
      if (
        !K ||
        !Array.isArray(K) ||
        K.length !== 1 ||
        K[0].length !== 4 ||
        K[0].some(isNaN)
      ) {
        throw new Error("Invalid K matrix computed.");
      }
      return K[0]; // [K0, K1, K2, K3]
    } catch (error) {
      alert("LQR computation failed: " + error.message);
      console.error(error);
      return null;
    }
  }

  function toggleSimulation() {
    if (isSimulationRunning) {
      isAnimating.current = false;
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      setIsSimulationRunning(false);
      setSimulationResults(null);
      stepRef.current = 0;
      setSimulationData({
        joint1: 0,
        joint2: 0,
        xposData: [],
        yposData: [],
        xvelData: [],
        yvelData: [],
        timestamps: [],
      });
      setUseSliders(false);
      setUseManualJoint1(false);
    } else {
      const K = getKMatrix();
      if (!K) return;
      try {
        const results = simulate(K);
        if (
          !results ||
          !Array.isArray(results.XPos) ||
          !Array.isArray(results.YPos) ||
          results.XPos.length === 0
        ) {
          throw new Error("Simulation returned invalid or empty results.");
        }

        setSimulationResults(results);
        isAnimating.current = true;
        setIsSimulationRunning(true);
        stepRef.current = 0;
        animate();
      } catch (error) {
        alert("Simulation failed: " + error.message);
        console.error(error);
      }
    }
  }

  const SIMULATION_DURATION = 20; // 20 seconds
  const SAMPLE_RATE = 100; // 100Hz sampling rate
  const TOTAL_SAMPLES = SIMULATION_DURATION * SAMPLE_RATE;

  function animate() {
    if (
      !isAnimating.current ||
      !simulationResults ||
      stepRef.current >= simulationResults.XPos.length
    ) {
      isAnimating.current = false;
      setIsSimulationRunning(false);
      return;
    }

    // Only update simulation data every 10th reading
    if (stepRef.current % 10 === 0) {
      setSimulationData((prev) => ({
        joint1: Math.max(
          -0.856,
          Math.min(0.856, simulationResults.XPos[stepRef.current]),
        ),
        joint2: simulationResults.YPos[stepRef.current],
        xposData: [...prev.xposData, simulationResults.XPos[stepRef.current]],
        yposData: [...prev.yposData, simulationResults.YPos[stepRef.current]],
        xvelData: [...prev.xvelData, simulationResults.XVel[stepRef.current]],
        yvelData: [...prev.yvelData, simulationResults.YVel[stepRef.current]],
        timestamps: [
          ...prev.timestamps,
          ((prev.timestamps.length / SAMPLE_RATE) * 10).toFixed(2),
        ],
      }));
    }

    stepRef.current += 1;

    setTimeout(() => {
      frameIdRef.current = requestAnimationFrame(animate);
    }, 0);
  }

  // Add chart data formatter
  const chartData = (label, data, color) => ({
    labels: simulationData.timestamps,
    datasets: [
      {
        label,
        data,
        fill: false,
        borderColor: color,
        tension: 0.1,
      },
    ],
  });

  const options = {
    animation: false,
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Time (seconds)",
        },
        min: 0,
        max: TOTAL_SAMPLES,
      },
    },
  };

  useEffect(() => {
    return () => {
      isAnimating.current = false;
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      setIsSimulationRunning(false);
    };
  }, []);

  return (
    <div>
      <Modal />

      <div className="containerQ">
        <Helmet>
          <title>Inverted Pendulum Simulation</title>
        </Helmet>
        <h1>Inverted Pendulum Simulation</h1>

        <div className="K-inputs">
          <h2>LQR Parameters</h2>
          <div className="raw16">
            <div className="q-matrix-container">
              <h3>Q Matrix (4x4)</h3>
              <div className="q-matrix-grid">
                {/* Top-left corner (empty) */}
                <div className="matrix-label" />

                {/* Column labels */}
                {["x", "ẋ", "ϕ", "ϕ̇"].map((label, i) => (
                  <div className="matrix-label" key={`col-${i}`}>
                    {label}
                  </div>
                ))}

                {/* Row labels + inputs */}
                {[...Array(4)].map((_, row) => (
                  <React.Fragment key={`row-${row}`}>
                    <div className="matrix-label">
                      {["x", "ẋ", "ϕ", "ϕ̇"][row]}
                    </div>
                    {[...Array(4)].map((_, col) => (
                      <div className="input-group" key={`Q${row}${col}`}>
                        <label
                          htmlFor={`Q${row}${col}`}
                          className="visually-hidden"
                        >
                          {`Q${row}${col}`}
                        </label>
                        <input
                          type="number"
                          name={`Q${row}${col}`}
                          value={QValues[`Q${row}${col}`]}
                          onChange={handleInputChange}
                          step="0.01"
                          required
                        />
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="r-matrix-container">
              <h4>R Value (1x1)</h4>
              <div className="input-group">
                {/* <label htmlFor="R">R</label> */}
                <input
                  type="number"
                  name="R"
                  value={RValue}
                  onChange={handleInputChange}
                  step="0.01"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={toggleSimulation}
          className="toggle-button1"
          disabled={useSliders || useManualJoint1}
        >
          {isSimulationRunning ? "Stop Simulation" : "Start Simulation"}
        </button>

        {/* Add Charts */}
        <div className="chart-container">
          <div className="chart">
            <h3>Cart Position</h3>
            <Line
              data={chartData(
                "Position",
                simulationData.xposData,
                "rgb(75, 192, 192)",
              )}
              options={options}
            />
          </div>
          <div className="chart">
            <h3>Cart Velocity</h3>
            <Line
              data={chartData(
                "Velocity",
                simulationData.xvelData,
                "rgb(153, 102, 255)",
              )}
              options={options}
            />
          </div>
        </div>

        <div className="chart-container">
          <div className="chart">
            <h3>Pendulum Angle</h3>
            <Line
              data={chartData(
                "Angle",
                simulationData.yposData,
                "rgb(255, 159, 64)",
              )}
              options={options}
            />
          </div>
          <div className="chart">
            <h3>Pendulum Angular Velocity</h3>
            <Line
              data={chartData(
                "Angular Velocity",
                simulationData.yvelData,
                "rgb(255, 99, 132)",
              )}
              options={options}
            />
          </div>
        </div>

        <div className="video-stream-instance1">
          <InvURDFViewer
            urdfUrl={urdfUrl}
            width={"1000"}
            height="625"
            joint1={simulationData.joint1}
            joint2={simulationData.joint2}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
