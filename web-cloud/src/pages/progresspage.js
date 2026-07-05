import { useState, useEffect } from "react";
import { simulate } from "../experiments/quadrotor/simulation";
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
import { fetchAuthSession } from "@aws-amplify/auth";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import "./progresspage.css";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const REGION = "eu-west-3";

// myStepinfo function (integrated here for simplicity)
function myStepinfo(data, Setpoint) {
  let yObservations = new Array(6).fill(0);
  const time = linspace(0, 10, 2000);
  const setpoint = Setpoint;
  data = data.slice(); // Ensure data is a copy and 1D array
  let idx_rise = [];
  let PeakIndex = 0;
  let Peak = 0;
  let is_rising = 0;
  let is_settled = 0;
  let RiseTime = 0;
  let Overshoot = 0;
  let SettlingTime = 0;
  let num_crossings = 0;
  let settled_points = 0;
  let SteadyStateError = 0;

  function linspace(start, end, n) {
    const arr = new Array(n);
    const step = (end - start) / (n - 1);
    for (let i = 0; i < n; i++) {
      arr[i] = start + step * i;
    }
    return arr;
  }

  function find(arr, condition, direction = "first") {
    if (direction === "first") {
      for (let i = 0; i < arr.length; i++) {
        if (condition(arr[i], i)) return [i];
      }
    }
    return [];
  }

  if (data[0] > setpoint) {
    Peak = Math.min(...data);
    PeakIndex = data.indexOf(Peak);
    Peak = Math.abs(Peak);
    idx_rise = find(data, (x) => x <= setpoint + 0.03, "first");
  } else if (data[0] < setpoint) {
    Peak = Math.max(...data);
    PeakIndex = data.indexOf(Peak);
    idx_rise = find(data, (x) => x >= setpoint - 0.03, "first");
  } else if (data[0] === setpoint) {
    Peak = Math.max(...data.map((x) => Math.abs(x)));
    PeakIndex =
      data.indexOf(Peak) !== -1 ? data.indexOf(Peak) : data.indexOf(-Peak);
    idx_rise = [0];
  }

  if (idx_rise.length === 0) {
    RiseTime = 20;
  } else {
    RiseTime = time[idx_rise[0]];
  }

  const mean_val = data.reduce((sum, val) => sum + val, 0) / data.length;

  if (mean_val <= data[0] + 0.03 && mean_val >= data[0] - 0.03) {
    is_rising = 0;
    is_settled = 0;
    RiseTime = 20;
    Overshoot = data[0];
    SettlingTime = 20;
  } else {
    is_rising = 1;
  }

  if (is_rising === 1) {
    const crossings = [];
    for (let i = 0; i < data.length - 1; i++) {
      if ((data[i] - setpoint) * (data[i + 1] - setpoint) < 0) {
        crossings.push(i);
      }
    }
    num_crossings = crossings.length;

    if (PeakIndex === 1999 && num_crossings <= 1) {
      if (Peak > setpoint) {
        Overshoot = Math.abs(Peak - setpoint);
      } else if (Peak <= setpoint + 0.03 && Peak >= setpoint - 0.03) {
        Overshoot = 0;
      } else if (Peak < setpoint - 0.025) {
        Overshoot = Math.abs(Peak - setpoint);
      }
    } else {
      Overshoot = Math.abs(Peak - setpoint);
    }
  }

  if (is_rising === 1) {
    const upper_T = setpoint + 0.015;
    const lower_T = setpoint - 0.015;
    let idx_settle = 0;
    let in_T = 0;
    let flag = -1;

    for (let i = 0; i < data.length; i++) {
      if (
        (in_T === 0 || in_T === 2) &&
        data[i] >= lower_T &&
        data[i] <= upper_T
      ) {
        idx_settle = i;
        in_T = 1;
      }
      if (in_T === 1 && (data[i] >= upper_T || data[i] <= lower_T)) {
        in_T = 2;
      }
      if (
        (flag === -1 && data[i] > setpoint) ||
        (flag === 1 && data[i] < setpoint)
      ) {
        flag *= -1;
      }
    }

    if (idx_settle === 0) {
      SettlingTime = 20;
    } else if (idx_settle < 1500) {
      SettlingTime = time[idx_settle];
    } else {
      SettlingTime = 20;
    }

    const near_setpoint = data.filter((x) => x <= upper_T && x >= lower_T);
    settled_points = near_setpoint.length;

    if (settled_points > 1000) {
      is_settled = 1;
    } else {
      is_settled = 0;
    }
  }

  SteadyStateError = Math.abs(data[data.length - 1] - setpoint);

  yObservations[0] = SteadyStateError;
  yObservations[1] = is_settled;
  yObservations[2] = settled_points;
  yObservations[3] = RiseTime;
  yObservations[4] = SettlingTime;
  yObservations[5] = Overshoot;

  return yObservations;
}

function MultiSimulationPage() {
  const defaultInputSet = {
    xposkp: 11.0,
    yposkp: 10.0,
    xposki: 0.5,
    yposki: 0.5,
    xposkd: 0.0,
    yposkd: 0.0,
    xvelkp: 15.0,
    yvelkp: 13.0,
    xvelki: 1.0,
    yvelki: 1.0,
    xvelkd: 0.0,
    yvelkd: 0.0,
    xposSet: 0.0,
    yposSet: 0.0,
  };

  const [credentials, setCredentials] = useState(null);
  const [id, setId] = useState("");
  const [inputSets, setInputSets] = useState([]);
  const [simulationResults, setSimulationResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedRun, setExpandedRun] = useState(null);

  useEffect(() => {
    const initializeAWS = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        if (!session.credentials) {
          throw new Error("No credentials found in session");
        }
        setCredentials(session.credentials);
        setId(session.identityId);
        console.log("Credentials found");
      } catch (err) {
        console.error("Error initializing AWS:", err);
        setError("Failed to initialize AWS credentials: " + err.message);
      }
    };
    initializeAWS();
  }, []);

  useEffect(() => {
    if (!credentials || !id) return;

    const fetchParameters = async () => {
      const dbClient = new DynamoDBClient({ region: REGION, credentials });
      setIsLoading(true);
      setError(null);

      const params = {
        TableName: "progress",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: {
          ":id": { S: id },
        },
        ScanIndexForward: false,
      };

      try {
        const response = await dbClient.send(new QueryCommand(params));
        let fetchedSets = [];
        if (response.Items && response.Items.length > 0) {
          fetchedSets = response.Items.map((item, index) => ({
            ...defaultInputSet,
            xposkp: parseFloat(item.xposkp?.N || defaultInputSet.xposkp),
            yposkp: parseFloat(item.yposkp?.N || defaultInputSet.yposkp),
            xposki: parseFloat(item.xposki?.N || defaultInputSet.xposki),
            yposki: parseFloat(item.yposki?.N || defaultInputSet.yposki),
            xposkd: parseFloat(item.xposkd?.N || defaultInputSet.xposkd),
            yposkd: parseFloat(item.yposkd?.N || defaultInputSet.yposkd),
            xvelkp: parseFloat(item.xvelkp?.N || defaultInputSet.xvelkp),
            yvelkp: parseFloat(item.yvelkp?.N || defaultInputSet.yvelkp),
            xvelki: parseFloat(item.xvelki?.N || defaultInputSet.xvelki),
            yvelki: parseFloat(item.yvelki?.N || defaultInputSet.yvelki),
            xvelkd: parseFloat(item.xvelkd?.N || defaultInputSet.xvelkd),
            yvelkd: parseFloat(item.yvelkd?.N || defaultInputSet.yvelkd),
            xposSet: parseFloat(item.xposSet?.N || defaultInputSet.xposSet),
            yposSet: parseFloat(item.yposSet?.N || defaultInputSet.yposSet),
            runNumber: index + 1,
            label: `Run ${index + 1}`,
            timestamp: item.timestamp.S,
          }));
          setSuccess(`Loaded ${response.Items.length} runs from DynamoDB`);
        } else {
          fetchedSets = [];
          setSuccess("No simulation data found in DynamoDB");
        }
        setInputSets(fetchedSets);
      } catch (err) {
        console.error("Error fetching parameters:", err);
        setError(
          `Failed to fetch runs: ${err.message} (${err.code || "Unknown"})`
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchParameters();
  }, [credentials, id]);

  useEffect(() => {
    if (!inputSets.length || isLoading) return;

    const runSimulations = async () => {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const results = [];
        for (const inputSet of inputSets) {
          const result = await simulate({
            xposkp: inputSet.xposkp,
            yposkp: inputSet.yposkp,
            xposki: inputSet.xposki,
            yposki: inputSet.yposki,
            xposkd: inputSet.xposkd,
            yposkd: inputSet.yposkd,
            xvelkp: inputSet.xvelkp,
            yvelkp: inputSet.yvelkp,
            xvelki: inputSet.xvelki,
            yvelki: inputSet.yvelki,
            xvelkd: inputSet.xvelkd,
            yvelkd: inputSet.yvelkd,
            xposSet: inputSet.xposSet,
            yposSet: inputSet.yposSet,
          });

          // Calculate step response metrics using myStepinfo
          const xPosMetrics = myStepinfo(result.XPos, inputSet.xposSet);
          const yPosMetrics = myStepinfo(result.YPos, inputSet.yposSet);

          // Define error as a weighted sum of RiseTime, SettlingTime, and Overshoot
          const weights = { rise: 0.3, settle: 0.5, overshoot: 0.2 };
          const xPosError =
            weights.rise * xPosMetrics[3] +
            weights.settle * xPosMetrics[4] +
            weights.overshoot * xPosMetrics[5];
          const yPosError =
            weights.rise * yPosMetrics[3] +
            weights.settle * yPosMetrics[4] +
            weights.overshoot * yPosMetrics[5];
          const totalError = (xPosError + yPosError) / 2;

          results.push({
            runNumber: inputSet.runNumber,
            label: inputSet.label,
            data: result,
            timestamps: Array.from({ length: result.XPos.length }, (_, i) =>
              (i * 0.005).toFixed(3)
            ),
            metrics: {
              xPos: {
                SSE: xPosMetrics[0],
                isSettled: xPosMetrics[1],
                settledPoints: xPosMetrics[2],
                riseTime: xPosMetrics[3],
                settlingTime: xPosMetrics[4],
                overshoot: xPosMetrics[5],
                error: xPosError,
              },
              yPos: {
                SSE: yPosMetrics[0],
                isSettled: yPosMetrics[1],
                settledPoints: yPosMetrics[2],
                riseTime: yPosMetrics[3],
                settlingTime: yPosMetrics[4],
                overshoot: yPosMetrics[5],
                error: yPosError,
              },
              totalError,
            },
          });
        }
        setSimulationResults(results);
        setSuccess("Simulations completed!");
      } catch (error) {
        console.error("Simulations failed:", error);
        setError(`Simulations failed: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    runSimulations();
  }, [inputSets, isLoading]);

  const toggleRun = (runNumber) => {
    setExpandedRun(expandedRun === runNumber ? null : runNumber);
  };

  const chartData = (label, data, color, setpoint) => ({
    labels: simulationResults.length > 0 ? simulationResults[0].timestamps : [],
    datasets: [
      {
        label,
        data,
        fill: false,
        borderColor: color,
        tension: 0.1,
      },
      {
        label: "Setpoint",
        data: Array(
          simulationResults.length > 0
            ? simulationResults[0].timestamps.length
            : 0
        ).fill(setpoint),
        borderColor: "rgba(0, 0, 0, 0.5)",
        borderDash: [5, 5],
        pointRadius: 0,
      },
    ],
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { font: { size: 12 } } },
      title: { display: true, text: "", font: { size: 14 } },
      tooltip: { bodyFont: { size: 12 }, titleFont: { size: 12 } },
    },
    scales: {
      x: { 
        title: { display: true, text: "Time (s)", font: { size: 12 } },
        ticks: { font: { size: 10 } }
      },
      y: { 
        title: { display: true, text: "Value (rad)", font: { size: 12 } },
        ticks: { font: { size: 10 } }
      },
    },
  };

  return (
    <div className="multi-simulation-page">
      <h1>Quadrotor Simulation Results</h1>

      {isLoading && (
        <p className="loading">
          <span className="spinner"></span> Loading...
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      {inputSets.length === 0 && !isLoading ? (
        <h2 className="nodata">No simulation data found.</h2>
      ) : (
        <div className="runs-container">
          {simulationResults.map((result) => {
            const inputSet = inputSets.find(
              (set) => set.runNumber === result.runNumber
            );
            return (
              <div key={result.runNumber} className="dropdown">
                <div className="dropdown-header">
                  <h2>Run {result.runNumber}</h2>
                  {/* <p>Error: {(result.metrics.xPos.error + result.metrics.yPos.error).toFixed(3)}</p> */}
                  <p></p>
                  <button
                    className="toggle-button"
                    onClick={() => toggleRun(result.runNumber)}
                  >
                    {expandedRun === result.runNumber
                      ? "Hide Details"
                      : "Show Details"}
                  </button>
                </div>
                {expandedRun === result.runNumber && (
                  <div className="dropdown-content">
                    <div className="section-content">
                      {/* Roll PID and Metrics */}
                      <div className="params-metrics">
                        <div className="pid-params">
                          <h3>Roll PID Parameters</h3>
                          <p>Position: Kp={inputSet.yposkp.toFixed(2)}, Ki={inputSet.yposki.toFixed(2)}, Kd={inputSet.yposkd.toFixed(2)}</p>
                          <p>Velocity: Kp={inputSet.yvelkp.toFixed(2)}, Ki={inputSet.yvelki.toFixed(2)}, Kd={inputSet.yvelkd.toFixed(2)}</p>
                          <p>Setpoint: {inputSet.yposSet.toFixed(2)} rad</p>
                        </div>
                        <div className="metrics">
                          <h3>Roll Performance Metrics</h3>
                          <p>Rise Time: {result.metrics.yPos.riseTime.toFixed(3)} s</p>
                          <p>Settling Time: {result.metrics.yPos.settlingTime.toFixed(3)} s</p>
                          <p>Overshoot: {result.metrics.yPos.overshoot.toFixed(3)} rad</p>
                          <p>Steady State Error: {result.metrics.yPos.SSE.toFixed(3)} rad</p>
                        </div>
                      </div>

                      {/* Roll Charts */}
                      <div className="charts-container">
                        <div className="chart">
                          <h4>Roll Position</h4>
                          <div className="chart-wrapper">
                            <Line
                              data={chartData(
                                "Roll Position",
                                result.data.YPos,
                                "rgb(75, 192, 192)",
                                inputSet.yposSet
                              )}
                              options={{
                                ...chartOptions,
                                plugins: {
                                  ...chartOptions.plugins,
                                  title: { display: true, text: "Roll Position" },
                                },
                              }}
                            />
                          </div>
                        </div>
                        <div className="chart">
                          <h4>Roll Velocity</h4>
                          <div className="chart-wrapper">
                            <Line
                              data={chartData(
                                "Roll Velocity",
                                result.data.YVel,
                                "rgb(255, 159, 64)",
                                inputSet.yposSet
                              )}
                              options={{
                                ...chartOptions,
                                plugins: {
                                  ...chartOptions.plugins,
                                  title: { display: true, text: "Roll Velocity" },
                                },
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Pitch PID and Metrics */}
                      <div className="params-metrics">
                        <div className="pid-params">
                          <h3>Pitch PID Parameters</h3>
                          <p>Position: Kp={inputSet.xposkp.toFixed(2)}, Ki={inputSet.xposki.toFixed(2)}, Kd={inputSet.xposkd.toFixed(2)}</p>
                          <p>Velocity: Kp={inputSet.xvelkp.toFixed(2)}, Ki={inputSet.xvelki.toFixed(2)}, Kd={inputSet.xvelkd.toFixed(2)}</p>
                          <p>Setpoint: {inputSet.xposSet.toFixed(2)} rad</p>
                        </div>
                        <div className="metrics">
                          <h3>Pitch Performance Metrics</h3>
                          <p>Rise Time: {result.metrics.xPos.riseTime.toFixed(3)} s</p>
                          <p>Settling Time: {result.metrics.xPos.settlingTime.toFixed(3)} s</p>
                          <p>Overshoot: {result.metrics.xPos.overshoot.toFixed(3)} rad</p>
                          <p>Steady State Error: {result.metrics.xPos.SSE.toFixed(3)} rad</p>
                        </div>
                      </div>

                      {/* Pitch Charts */}
                      <div className="charts-container">
                        <div className="chart">
                          <h4>Pitch Position</h4>
                          <div className="chart-wrapper">
                            <Line
                              data={chartData(
                                "Pitch Position",
                                result.data.XPos,
                                "rgb(153, 102, 255)",
                                inputSet.xposSet
                              )}
                              options={{
                                ...chartOptions,
                                plugins: {
                                  ...chartOptions.plugins,
                                  title: { display: true, text: "Pitch Position" },
                                },
                              }}
                            />
                          </div>
                        </div>
                        <div className="chart">
                          <h4>Pitch Velocity</h4>
                          <div className="chart-wrapper">
                            <Line
                              data={chartData(
                                "Pitch Velocity",
                                result.data.XVel,
                                "rgb(255, 99, 132)",
                                inputSet.xposSet
                              )}
                              options={{
                                ...chartOptions,
                                plugins: {
                                  ...chartOptions.plugins,
                                  title: { display: true, text: "Pitch Velocity" },
                                },
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MultiSimulationPage;