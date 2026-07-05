import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./pubsub.css";
import { URDFViewer } from "../experiments/quadrotor/URDFViewer";
import { Helmet } from "react-helmet-async";
import { fetchAuthSession } from "@aws-amplify/auth";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { simulate } from "../experiments/quadrotor/simulation";
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

const REGION = "eu-west-3";

const testInput = {
  xposkp: 9.0,
  yposkp: 9.0,
  xposki: 0,
  yposki: 0,
  xposkd: 0.5,
  yposkd: 0.5,
  xvelkp: 16.0,
  yvelkp: 11.0,
  xvelki: 5.0,
  yvelki: 5.0,
  xvelkd: 0.0,
  yvelkd: 0.0,
  xposSet: 0,
  yposSet: 0,
};

function App() {
  const navigatee = useNavigate();

  const handleNavigationn = () => {
    navigatee("/SimProgresspage");
    window.scrollTo(0, 0); // Scroll to top after navigation
  };
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
  );

  const urdfUrl1 = "2dofhover/urdf/2dofhover.urdf";

  // State for PID values, initialized with testInput
  const [pidValues, setPidValues] = useState(testInput);

  // State for Roll & Pitch Setpoints, initialized with testInput
  const [angleValues, setAngleValues] = useState({
    roll: testInput.xposSet,
    pitch: testInput.yposSet,
  });

  // State for simulation data (batched)
  const [simulationData, setSimulationData] = useState({
    joint1: 0,
    joint2: 0,
    xposData: [],
    yposData: [],
    xvelData: [],
    yvelData: [],
    timestamps: [],
  });

  // State to control simulation
  const [appliedParams, setAppliedParams] = useState(null);
  const [simulationResults, setSimulationResults] = useState(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);

  // State for AWS credentials and DynamoDB
  const [credentials, setCredentials] = useState(null);
  const [identityId, setIdentityId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeBlock, setActiveBlock] = useState(null);

  // Use a ref to control the animation loop
  const isAnimating = useRef(false);
  const frameIdRef = useRef(null);

  // Initialize AWS credentials
  useEffect(() => {
    const initializeAWS = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        if (!session.credentials) {
          throw new Error("No credentials found in session");
        }
        setCredentials(session.credentials);
        setIdentityId(session.identityId);
        console.log("Credentials found");
      } catch (err) {
        console.error("Error initializing AWS:", err);
        setError("Failed to initialize AWS credentials: " + err.message);
      }
    };
    initializeAWS();
  }, []);

  // Run simulation asynchronously
  useEffect(() => {
    if (!appliedParams) return;

    const runSimulation = async () => {
      const results = await new Promise((resolve) => {
        setTimeout(() => {
          resolve(simulate(appliedParams));
        }, 0);
      });
      setSimulationResults(results);
    };

    runSimulation();
  }, [appliedParams]);

  // Animation loop
  useEffect(() => {
    if (!simulationResults) return;

    let i = 0;
    isAnimating.current = true;
    setIsSimulationRunning(true);

    const animate = () => {
      if (!isAnimating.current || i >= simulationResults.XPos.length) {
        isAnimating.current = false;
        setIsSimulationRunning(false);
        return;
      }

      setSimulationData((prev) => ({
        joint1: simulationResults.XPos[i],
        joint2: simulationResults.YPos[i],
        xposData: [...prev.xposData, simulationResults.XPos[i]],
        yposData: [...prev.yposData, simulationResults.YPos[i]],
        xvelData: [...prev.xvelData, simulationResults.XVel[i]],
        yvelData: [...prev.yvelData, simulationResults.YVel[i]],
        timestamps: [
          ...prev.timestamps,
          (prev.timestamps.length * 0.005).toFixed(1),
        ],
      }));

      i++;
      frameIdRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      isAnimating.current = false;
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      setIsSimulationRunning(false);
    };
  }, [simulationResults]);

  // Save simulation parameters to DynamoDB
  const saveSimulationParams = async (params) => {
    if (!credentials || !identityId) {
      setError("AWS credentials or IdentityID not initialized");
      return;
    }

    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const timestamp = new Date().toISOString(); // e.g., "2025-04-14T12:34:56.789Z"

    const dbParams = {
      TableName: "progress",
      Item: {
        id: { S: identityId },
        timestamp: { S: timestamp },
        xposkp: { N: params.xposkp.toString() },
        yposkp: { N: params.yposkp.toString() },
        xposki: { N: params.xposki.toString() },
        yposki: { N: params.yposki.toString() },
        xposkd: { N: params.xposkd.toString() },
        yposkd: { N: params.yposkd.toString() },
        xvelkp: { N: params.xvelkp.toString() },
        yvelkp: { N: params.yvelkp.toString() },
        xvelki: { N: params.xvelki.toString() },
        yvelki: { N: params.yvelki.toString() },
        xvelkd: { N: params.xvelkd.toString() },
        yvelkd: { N: params.yvelkd.toString() },
        xposSet: { N: params.xposSet.toString() },
        yposSet: { N: params.yposSet.toString() },
      },
    };

    try {
      await dbClient.send(new PutItemCommand(dbParams));
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle simulation (start/stop)
  const toggleSimulation = async () => {
    if (isSimulationRunning) {
      // Stop the simulation
      isAnimating.current = false;
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      setIsSimulationRunning(false);
      setAppliedParams(null);
      setSimulationResults(null);
      // Reset simulation data to clear charts
      setSimulationData({
        joint1: 0,
        joint2: 0,
        xposData: [],
        yposData: [],
        xvelData: [],
        yvelData: [],
        timestamps: [],
      });
    } else {
      // Convert any empty values to 0 before starting simulation
      const processedPidValues = Object.fromEntries(
        Object.entries(pidValues).map(([key, value]) => [
          key,
          value === "" ? 0 : value,
        ]),
      );
      const processedAngleValues = {
        roll: angleValues.roll === "" ? 0 : angleValues.roll,
        pitch: angleValues.pitch === "" ? 0 : angleValues.pitch,
      };

      const simulationParams = {
        ...processedPidValues,
        xposSet: processedAngleValues.pitch,
        yposSet: processedAngleValues.roll,
      };

      console.log("Applied Parameters:", simulationParams);

      // Save parameters to DynamoDB
      await saveSimulationParams(simulationParams);

      setAppliedParams(simulationParams);
    }
  };

  // Update handlePidChange to allow empty values
  const handlePidChange = (e) => {
    const value = e.target.value === "" ? "" : parseFloat(e.target.value) || 0;
    setPidValues({ ...pidValues, [e.target.name]: value });
  };

  // Update handleSetpointChange to allow empty values
  const handleSetpointChange = (e) => {
    const value =
      e.target.value === ""
        ? ""
        : parseFloat(Math.min(Math.max(e.target.value, -0.2), 0.2)) || 0;
    setAngleValues({
      ...angleValues,
      [e.target.name]: value, // Ensure value is within bounds
    });
  };

  // Replace the handleBlockClick function with this version
  const handleBlockClick = (blockName, e) => {
    e.stopPropagation();
    setActiveBlock(blockName === activeBlock ? null : blockName);
  };

  // Chart Data
  const chartData = (label, data, color) => ({
    labels: simulationData.timestamps,
    datasets: [{ label, data, fill: false, borderColor: color, tension: 0.1 }],
  });

  const [viewerWidth, setViewerWidth] = useState(getViewerWidth());

  function getViewerWidth() {
    if (window.innerWidth > 1200) return 1000;
    if (window.innerWidth > 768) return 360;
    return 350;
  }

  useEffect(() => {
    const handleResize = () => {
      setViewerWidth(getViewerWidth());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const options = {
    animation: false,
    responsive: true,
    plugins: {
      legend: { labels: { color: "#333" } },
    },
    scales: {
      x: {
        ticks: { color: "#333" },
        title: { color: "#333", display: true, text: "Time (s)" },
        grid: { color: "rgba(128,128,128,0.2)" },
      },
      y: {
        ticks: { color: "#333" },
        title: { color: "#333" },
        grid: { color: "rgba(128,128,128,0.2)" },
      },
    },
  };

  // Add this effect to handle clicks outside blocks
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveBlock(null);
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div>
      <div className="containerQ">
        <Helmet>
          <title>Quadrotor Simulation</title>
        </Helmet>
        <Modal />
        <div className="container2">
          <h1 className="friendly-heading">Quadrotor</h1>
          <div className="block-diagram-container">
            <div className="block-diagram">
              <div className="feedback-arrow feedback-vertical position position-top"></div>
              <div className="feedback-arrow feedback-vertical position position-bottom"></div>
              <div className="feedback-arrow feedback-horizontal position position-top"></div>
              <div className="feedback-arrow feedback-horizontal position position-bottom"></div>
              <div className="feedback-arrow-head position top"></div>
              <div className="feedback-arrow-head position bottom"></div>

              {/* Velocity feedback arrows */}
              <div className="feedback-arrow feedback-vertical velocity velocity-top"></div>
              <div className="feedback-arrow feedback-vertical velocity velocity-bottom"></div>
              <div className="feedback-arrow feedback-horizontal velocity velocity-top"></div>
              <div className="feedback-arrow feedback-horizontal velocity velocity-bottom"></div>
              <div className="feedback-arrow-head velocity top"></div>
              <div className="feedback-arrow-head velocity bottom"></div>
              <div className="control-paths">
                {/* Pitch Control Row */}
                <div className="control-row">
                  <div
                    className={`block setpoint-block ${activeBlock === "pitch-setpoint" ? "active" : ""}`}
                    onClick={(e) => handleBlockClick("pitch-setpoint", e)}
                  >
                    <div className="block-content">
                      <span className="block-name">Pitch Setpoint</span>
                      <br />
                      <span className="block-value">
                        Value: {angleValues.pitch || 0} rad
                      </span>
                    </div>
                    <div
                      className="input-container setpoint"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <div className="input-field">
                        <label>Setpoint:</label>
                        <input
                          type="number"
                          value={angleValues.pitch}
                          onChange={(e) =>
                            handleSetpointChange({
                              target: { name: "pitch", value: e.target.value },
                            })
                          }
                          step="0.01"
                          min="-0.2"
                          max="0.2"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="connector"></div>

                  <div className="summation-block">
                    <span className="summation-sign plus">+</span>
                    <span className="summation-sign minus">−</span>
                  </div>

                  <div className="connector"></div>

                  <div
                    className={`block pid-block ${activeBlock === "pitch-pid" ? "active" : ""}`}
                    onClick={(e) => handleBlockClick("pitch-pid", e)}
                  >
                    <div className="block-content">
                      <span className="block-name">Pitch Position PID</span>
                      <br />
                      <span className="block-value">
                        P: {pidValues.xposkp || 0} , I: {pidValues.xposki || 0}{" "}
                        , D: {pidValues.xposkd || 0}
                      </span>
                    </div>
                    <div
                      className="input-container"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <div className="input-field">
                        <label>P:</label>
                        <input
                          type="number"
                          value={pidValues.xposkp}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "xposkp", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                      <div className="input-field">
                        <label>I:</label>
                        <input
                          type="number"
                          value={pidValues.xposki}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "xposki", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                      <div className="input-field">
                        <label>D:</label>
                        <input
                          type="number"
                          value={pidValues.xposkd}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "xposkd", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="connector"></div>

                  <div className="summation-block">
                    <span className="summation-sign plus">+</span>
                    <span className="summation-sign minus">−</span>
                  </div>

                  <div className="connector"></div>

                  <div
                    className={`block pid-block ${activeBlock === "pitch-velocity-pid" ? "active" : ""}`}
                    onClick={(e) => handleBlockClick("pitch-velocity-pid", e)}
                  >
                    <div className="block-content">
                      <span className="block-name">Pitch Velocity PID</span>
                      <br />
                      <span className="block-value">
                        P: {pidValues.xvelkp || 0} , I: {pidValues.xvelki || 0}{" "}
                        , D: {pidValues.xvelkd || 0}
                      </span>
                    </div>
                    <div
                      className="input-container"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <div className="input-field">
                        <label>P:</label>
                        <input
                          type="number"
                          value={pidValues.xvelkp}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "xvelkp", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                      <div className="input-field">
                        <label>I:</label>
                        <input
                          type="number"
                          value={pidValues.xvelki}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "xvelki", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                      <div className="input-field">
                        <label>D:</label>
                        <input
                          type="number"
                          value={pidValues.xvelkd}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "xvelkd", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="connector"></div>
                </div>

                {/* Roll Control Row */}
                <div className="control-row">
                  <div
                    className={`block setpoint-block ${activeBlock === "roll-setpoint" ? "active" : ""}`}
                    onClick={(e) => handleBlockClick("roll-setpoint", e)}
                  >
                    <div className="block-content">
                      <span className="block-name">Roll Setpoint</span>
                      <br />
                      <span className="block-value">
                        Value: {angleValues.roll || 0} rad
                      </span>
                    </div>
                    <div
                      className="input-container setpoint"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <div className="input-field">
                        <label>Setpoint:</label>
                        <input
                          type="number"
                          value={angleValues.roll}
                          onChange={(e) =>
                            handleSetpointChange({
                              target: { name: "roll", value: e.target.value },
                            })
                          }
                          step="0.01"
                          min="-0.2"
                          max="0.2"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="connector"></div>

                  <div className="summation-block">
                    <span className="summation-sign plus">+</span>
                    <span className="summation-sign minus">−</span>
                  </div>

                  <div className="connector"></div>

                  <div
                    className={`block pid-block ${activeBlock === "roll-pid" ? "active" : ""}`}
                    onClick={(e) => handleBlockClick("roll-pid", e)}
                  >
                    <div className="block-content">
                      <span className="block-name">Roll Position PID</span>
                      <br />
                      <span className="block-value">
                        P: {pidValues.yposkp || 0} , I: {pidValues.yposki || 0}{" "}
                        , D: {pidValues.yposkd || 0}
                      </span>
                    </div>
                    <div
                      className="input-container"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <div className="input-field">
                        <label>P:</label>
                        <input
                          type="number"
                          value={pidValues.yposkp}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "yposkp", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                      <div className="input-field">
                        <label>I:</label>
                        <input
                          type="number"
                          value={pidValues.yposki}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "yposki", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                      <div className="input-field">
                        <label>D:</label>
                        <input
                          type="number"
                          value={pidValues.yposkd}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "yposkd", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="connector"></div>

                  <div className="summation-block">
                    <span className="summation-sign plus">+</span>
                    <span className="summation-sign minus">−</span>
                  </div>

                  <div className="connector"></div>

                  <div
                    className={`block pid-block ${activeBlock === "roll-velocity-pid" ? "active" : ""}`}
                    onClick={(e) => handleBlockClick("roll-velocity-pid", e)}
                  >
                    <div className="block-content">
                      <span className="block-name">Roll Velocity PID</span>
                      <br />
                      <span className="block-value">
                        P: {pidValues.yvelkp || 0} , I: {pidValues.yvelki || 0}{" "}
                        , D: {pidValues.yvelkd || 0}
                      </span>
                    </div>
                    <div
                      className="input-container"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <div className="input-field">
                        <label>P:</label>
                        <input
                          type="number"
                          value={pidValues.yvelkp}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "yvelkp", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                      <div className="input-field">
                        <label>I:</label>
                        <input
                          type="number"
                          value={pidValues.yvelki}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "yvelki", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                      <div className="input-field">
                        <label>D:</label>
                        <input
                          type="number"
                          value={pidValues.yvelkd}
                          onChange={(e) =>
                            handlePidChange({
                              target: { name: "yvelkd", value: e.target.value },
                            })
                          }
                          step="0.5"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="connector"></div>
                </div>
              </div>

              <div className="plant-block">Quadrotor Plant</div>
            </div>
          </div>
          {/* Rest of the content */}
          {isLoading && <p>Loading...</p>}
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}

          {/* Single Toggle Button */}
          <div className="button-container">
            <button
              onClick={toggleSimulation}
              className="toggle-button1"
              disabled={isLoading}
            >
              {isSimulationRunning ? "Stop Simulation" : "Start Simulation"}
            </button>

            <button onClick={handleNavigationn} className="toggle-button1">
              Track your Progress
            </button>
          </div>

          {/* Charts */}
          <div className="chart-container">
            <div className="chart">
              <h3>Roll</h3>

              <Line
                data={chartData(
                  "Roll",
                  simulationData.yposData,
                  "rgb(75, 192, 192)",
                )}
                options={options}
              />
            </div>
            <div className="chart">
              <h3>Pitch</h3>
              <Line
                data={chartData(
                  "Pitch",
                  simulationData.xposData,
                  "rgb(153, 102, 255)",
                )}
                options={options}
              />
            </div>
          </div>

          <div className="chart-container">
            <div className="chart">
              <h3>Roll Velocity</h3>
              <Line
                data={chartData(
                  "Roll Velocity",
                  simulationData.yvelData,
                  "rgb(255, 159, 64)",
                )}
                options={options}
              />
            </div>
            <div className="chart">
              <h3>Pitch Velocity</h3>
              <Line
                data={chartData(
                  "Pitch Velocity",
                  simulationData.xvelData,
                  "rgb(255, 99, 132)",
                )}
                options={options}
              />
            </div>
          </div>

          {/* URDF Viewer */}
          <div className="video-stream-instance1">
            <URDFViewer
              urdfUrl={urdfUrl1}
              width={viewerWidth}
              height="625"
              joint1={simulationData.joint1}
              joint2={simulationData.joint2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
