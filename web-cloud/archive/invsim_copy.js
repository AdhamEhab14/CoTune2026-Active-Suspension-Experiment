import { useState, useEffect, useRef } from "react";
import "../pages/inv.js";
import { Helmet } from "react-helmet-async";
import { InvURDFViewer } from "../experiments/pendulum/InvURDFViewer/InvURDFViewer.jsx";
import { simulate } from "../experiments/pendulum/pendulum.js";

function App() {
  const urdfUrl = "invurdf2/urdf/invurdf2.urdf";
  const [simulationData, setSimulationData] = useState({
    joint1: 0,
    joint2: 0,
  });
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const isAnimating = useRef(false);
  const frameIdRef = useRef(null);
  const stepRef = useRef(0);
  const [kMatrix, setKMatrix] = useState({
    k1: "-70",
    k2: "-73",
    k3: "-324",
    k4: "-74",
  });
  const [manualJoint1, setManualJoint1] = useState("0");
  const [useManualJoint1, setUseManualJoint1] = useState(false);
  const [useSliders, setUseSliders] = useState(false);
  const [sliderJoint1, setSliderJoint1] = useState(0);
  const [sliderJoint2, setSliderJoint2] = useState(0);

  function handleKInputChange(e) {
    const { name, value } = e.target;
    setKMatrix((prev) => ({
      ...prev,
      [name]: value,
    }));
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
    const k1 = parseFloat(kMatrix.k1);
    const k2 = parseFloat(kMatrix.k2);
    const k3 = parseFloat(kMatrix.k3);
    const k4 = parseFloat(kMatrix.k4);
    if (isNaN(k1) || isNaN(k2) || isNaN(k3) || isNaN(k4)) {
      alert("K matrix gains must be valid numbers.");
      return null;
    }
    return [k1, k2, k3, k4];
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
      setSimulationData({ joint1: 0, joint2: 0 });
      setUseSliders(false);
      setUseManualJoint1(false);
    } else {
      const K = getKMatrix();
      if (!K) return;
      try {
        const results = simulate(K);
        console.log("Simulation results:", {
          XPos: results.XPos.slice(0, 10),
          YPos: results.YPos.slice(0, 10),
        });
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

    let joint1 = useSliders
      ? sliderJoint1
      : useManualJoint1
      ? parseFloat(manualJoint1) || 0
      : simulationResults.XPos[stepRef.current];
    let joint2 = useSliders
      ? sliderJoint2
      : simulationResults.YPos[stepRef.current];

    const joint1Raw = joint1;
    joint1 = Math.max(-0.856, Math.min(0.856, joint1));

    if (isNaN(joint1) || isNaN(joint2)) {
      console.warn(
        `Invalid values at step ${stepRef.current}: joint1=${joint1}, joint2=${joint2}`
      );
      isAnimating.current = false;
      setIsSimulationRunning(false);
      return;
    }

    if (joint1 !== joint1Raw) {
      console.log(
        `Clamped joint1 from ${joint1Raw} to ${joint1} at step ${stepRef.current}`
      );
    }

    if (stepRef.current < 25 || (stepRef.current >= 200 && stepRef.current < 225)) {
      console.log(
        `Step ${stepRef.current}: joint1=${joint1.toFixed(3)}, joint2=${joint2.toFixed(3)}`
      );
    }

    setSimulationData({
      joint1,
      joint2,
    });

    const stepsPerFrame = Math.round((1 / 240) / 0.001);
    stepRef.current += stepsPerFrame;
    if (stepRef.current >= simulationResults.XPos.length) {
      stepRef.current = simulationResults.XPos.length - 1;
    }

    frameIdRef.current = requestAnimationFrame(animate);
  }

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
      <div className="containerI">
        <Helmet>
          <title>Inverted Pendulum Simulation</title>
        </Helmet>
        <h1>Inverted Pendulum Simulation</h1>

        <div className="matrix-inputs">
          <h3>LQR Gains (K Matrix)</h3>
          <div className="input-group">
            <label>
              K1 (x gain):
              <input
                type="number"
                name="k1"
                value={kMatrix.k1}
                onChange={handleKInputChange}
                step="any"
                required
              />
            </label>
            <label>
              K2 (x_dot gain):
              <input
                type="number"
                name="k2"
                value={kMatrix.k2}
                onChange={handleKInputChange}
                step="any"
                required
              />
            </label>
            <label>
              K3 (theta gain):
              <input
                type="number"
                name="k3"
                value={kMatrix.k3}
                onChange={handleKInputChange}
                step="any"
                required
              />
            </label>
            <label>
              K4 (theta_dot gain):
              <input
                type="number"
                name="k4"
                value={kMatrix.k4}
                onChange={handleKInputChange}
                step="any"
                required
              />
            </label>
          </div>
        </div>

        <div className="matrix-inputs">
          <h3>Test Cart Position</h3>
          <label>
            Manual joint1 (m, -0.856 to 0.856):
            <input
              type="number"
              value={manualJoint1}
              onChange={handleManualJoint1Change}
              min="-0.856"
              max="0.856"
              step="0.01"
            />
          </label>
          <label>
            Use manual joint1:
            <input
              type="checkbox"
              checked={useManualJoint1}
              onChange={(e) => {
                setUseManualJoint1(e.target.checked);
                if (e.target.checked) {
                  const manualValue = parseFloat(manualJoint1) || 0;
                  setSimulationData((prev) => ({
                    ...prev,
                    joint1: Math.max(-0.856, Math.min(0.856, manualValue)),
                  }));
                  setUseSliders(false);
                  if (isSimulationRunning) {
                    toggleSimulation();
                  }
                }
              }}
            />
          </label>
        </div>

        <div className="matrix-inputs">
          <h3>Slider Controls</h3>
          <label>
            Use sliders to control cart and pendulum:
            <input
              type="checkbox"
              checked={useSliders}
              onChange={(e) => {
                setUseSliders(e.target.checked);
                if (e.target.checked) {
                  setSimulationData({
                    joint1: sliderJoint1,
                    joint2: sliderJoint2,
                  });
                  setUseManualJoint1(false);
                  if (isSimulationRunning) {
                    toggleSimulation();
                  }
                }
              }}
            />
          </label>
          {useSliders && (
            <div className="slider-group">
              <label>
                Cart Position (m, -0.856 to 0.856):
                <input
                  type="range"
                  value={sliderJoint1}
                  onChange={handleSliderJoint1Change}
                  min="-0.856"
                  max="0.856"
                  step="0.001"
                />
                <span>{sliderJoint1.toFixed(3)} m</span>
              </label>
              <label>
                Pendulum Angle (rad, -π to π):
                <input
                  type="range"
                  value={sliderJoint2}
                  onChange={handleSliderJoint2Change}
                  min={-Math.PI}
                  max={Math.PI}
                  step="0.01"
                />
                <span>{sliderJoint2.toFixed(3)} rad</span>
              </label>
            </div>
          )}
        </div>

        <div className="App">
          <InvURDFViewer
            urdfUrl={urdfUrl}
            width="1000"
            height="400"
            joint1={simulationData.joint1}
            joint2={simulationData.joint2}
          />
          <button
            onClick={toggleSimulation}
            className="toggle-button1"
            disabled={useSliders || useManualJoint1}
          >
            {isSimulationRunning ? "Stop Simulation" : "Start Simulation"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;