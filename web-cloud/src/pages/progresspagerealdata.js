import { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { Helmet } from "react-helmet-async";

import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "../styles/custom-toast.css";
import "react-toastify/dist/ReactToastify.css";

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
import Accessdeniedcomp from "../components/accessdeniedcomp";

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
const VISIBILITY_TABLE = "UserDataVisibility";
const PID_TABLE_NAME = "PIDParameters";

function myStepinfo(data, Setpoint) {
  let yObservations = new Array(6).fill(0);
  const time = linspace(0, 15, 76);
  const setpoint = Setpoint;
  data = data.slice();
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

  if (data.length !== 76) {
    console.warn(`Data length is ${data.length}, expected 76`);
    return yObservations;
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
    RiseTime = 15;
  } else {
    RiseTime = time[idx_rise[0]];
  }

  const mean_val = data.reduce((sum, val) => sum + val, 0) / data.length;

  if (mean_val <= data[0] + 0.03 && mean_val >= data[0] - 0.03) {
    is_rising = 0;
    is_settled = 0;
    RiseTime = 15;
    Overshoot = data[0];
    SettlingTime = 15;
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

    if (PeakIndex === 50 && num_crossings <= 1) {
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
    const upper_T = setpoint + 0.025;
    const lower_T = setpoint - 0.025;
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
      SettlingTime = 15;
    } else if (idx_settle < 61) {
      SettlingTime = time[idx_settle];
    } else {
      SettlingTime = 15;
    }

    const near_setpoint = data.filter((x) => x <= upper_T && x >= lower_T);
    settled_points = near_setpoint.length;

    if (settled_points > 26) {
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

function MultiPage() {
  const navigate = useNavigate();   

  const [credentials, setCredentials] = useState(null);
  const [id, setId] = useState("");
  const [simulationResults, setSimulationResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRun, setExpandedRun] = useState(null);
  const [graphsVisibility, setGraphsVisibility] = useState("show");
  const [calculationsVisibility, setCalculationsVisibility] = useState("show");




  
useEffect(() => {
  const timer = setTimeout(() => {
    toast(
      <div>
        💬 We'd love your honest feedback on the experiment results!
        <div style={{ marginTop: "0.8em", textAlign: "center" }}>
          <button
            onClick={() => navigate("/Feedback")}
            style={{
              padding: "0.5em 1em",
              backgroundColor: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Go to Feedback Page
          </button>
        </div>
      </div>,
      {
        autoClose: false, // ❗️Stay until user closes it
        pauseOnHover: true,
        className: "custom-toast",
        closeButton: true,
      }
    );
  }, 1000);

  return () => clearTimeout(timer);
}, []);



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

    const checkVisibility = async () => {
      setIsLoading(true);
      setError(null);

      const dbClient = new DynamoDBClient({ region: REGION, credentials });

      try {
        const params = {
          TableName: VISIBILITY_TABLE,
          KeyConditionExpression: "IdentityID = :id",
          ExpressionAttributeValues: {
            ":id": { S: id },
          },
        };
        const command = new QueryCommand(params);
        const data = await dbClient.send(command);

        const graphsVis = data.Items?.[0]?.graphsVisibility?.S || "show";
        const calcsVis = data.Items?.[0]?.calculationsVisibility?.S || "show";
        setGraphsVisibility(graphsVis);
        setCalculationsVisibility(calcsVis);
        console.log("Visibility:", { graphsVis, calcsVis });
      } catch (err) {
        console.error("Error checking visibility:", err);
        setError("Error checking data visibility: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    checkVisibility();
  }, [credentials, id]);

  useEffect(() => {
    if (!credentials || !id || (graphsVisibility !== "show" && calculationsVisibility !== "show")) return;

    const fetchSensorData = async () => {
      setIsLoading(true);
      setError(null);

      const dbClient = new DynamoDBClient({ region: REGION, credentials });

      const params = {
        TableName: "SensorData",
        KeyConditionExpression: "identityId = :id",
        ExpressionAttributeValues: {
          ":id": { S: id },
        },
        ScanIndexForward: true,
      };

      try {
        const command = new QueryCommand(params);
        const data = await dbClient.send(command);

        if (data.Items) {
          const groupedData = await groupDataByTimestamp(data.Items, dbClient);
          setSimulationResults(groupedData);
        } else {
          setError("No data found.");
        }
      } catch (err) {
        console.error("DynamoDB error:", err);
        setError("Error fetching sensor data: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSensorData();
  }, [credentials, id, graphsVisibility, calculationsVisibility]);

  const groupDataByTimestamp = async (items, dbClient) => {
    const grouped = {};

    items.forEach((item) => {
      const timestamp = item.timestamp.N.toString();
      const groupTimestamp = timestamp.slice(0, 13);

      const xpos = parseFloat(item.payload.M.xpos?.N) || 0;
      const ypos = parseFloat(item.payload.M.ypos?.N) || 0;
      const xvel = parseFloat(item.payload.M.xvel?.N) || 0;
      const yvel = parseFloat(item.payload.M.yvel?.N) || 0;

      if (!grouped[groupTimestamp]) {
        grouped[groupTimestamp] = { xpos: [], ypos: [], xvel: [], yvel: [] };
      }

      grouped[groupTimestamp].xpos.push(xpos);
      grouped[groupTimestamp].ypos.push(ypos);
      grouped[groupTimestamp].xvel.push(xvel);
      grouped[groupTimestamp].yvel.push(yvel);
    });

    const results = await Promise.all(
      Object.entries(grouped).map(async ([timestamp, data]) => {
        console.log(`Run ${timestamp}: ${data.xpos.length} points`, {
          xpos: data.xpos.slice(0, 5),
          ypos: data.ypos.slice(0, 5),
          xvel: data.xvel.slice(0, 5),
          yvel: data.yvel.slice(0, 5)
        });

        if (data.xpos.length !== 76 || data.ypos.length !== 76) {
          console.warn(
            `Timestamp ${timestamp}: Data length is ${data.xpos.length}, expected 76`
          );
          return {
            timestamp,
            data,
            metrics: null,
          };
        }

        // Query PIDParameters table
        let pidData = {};
        try {
          const pidParams = {
            TableName: PID_TABLE_NAME,
            KeyConditionExpression: "identityId = :id AND #ts = :ts",
            ExpressionAttributeNames: {
              "#ts": "timestamp",
            },
            ExpressionAttributeValues: {
              ":id": { S: id },
              ":ts": { N: timestamp },
            },
          };
          const pidCommand = new QueryCommand(pidParams);
          const pidResponse = await dbClient.send(pidCommand);
          console.log(pidResponse);

          if (pidResponse.Items && pidResponse.Items.length > 0) {
            const item = pidResponse.Items[0];
            pidData = {
              xPosPid: {
                Kp: parseFloat(item.xposkp?.N) || 0,
                Ki: parseFloat(item.xposki?.N) || 0,
                Kd: parseFloat(item.xposkd?.N) || 0,
              },
              xVelPid: {
                Kp: parseFloat(item.xvelkp?.N) || 0,
                Ki: parseFloat(item.xvelki?.N) || 0,
                Kd: parseFloat(item.xvelkd?.N) || 0,
              },
              yPosPid: {
                Kp: parseFloat(item.yposkp?.N) || 0,
                Ki: parseFloat(item.yposki?.N) || 0,
                Kd: parseFloat(item.yposkd?.N) || 0,
              },
              yVelPid: {
                Kp: parseFloat(item.yvelkp?.N) || 0,
                Ki: parseFloat(item.yvelki?.N) || 0,
                Kd: parseFloat(item.yvelkd?.N) || 0,
              },
              xposSet: parseFloat(item.xposSet?.N) || 0,
              yposSet: parseFloat(item.yposSet?.N) || 0,
            };
            console.log(`PID data for ${timestamp}:`, pidData);
          } else {
            console.warn(`No PID data found for timestamp ${timestamp}`);
          }
        } catch (err) {
          console.error(`Error querying PIDParameters for ${timestamp}:`, err);
        }

        const xPosMetrics = myStepinfo(data.xpos, pidData.xposSet);
        const yPosMetrics = myStepinfo(data.ypos, pidData.yposSet);

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

        return {
          timestamp,
          data,
          metrics: {
            xPos: {
              riseTime: xPosMetrics[3],
              settlingTime: xPosMetrics[4],
              overshoot: xPosMetrics[5],
              SSE: xPosMetrics[0],
              pid: pidData.xPosPid || { Kp: 1.0, Ki: 0.1, Kd: 0.05 },
              velPid: pidData.xVelPid || { Kp: 0, Ki: 0, Kd: 0 },
              setpoint: pidData.xposSet || 0,
            },
            yPos: {
              riseTime: yPosMetrics[3],
              settlingTime: yPosMetrics[4],
              overshoot: yPosMetrics[5],
              SSE: yPosMetrics[0],
              pid: pidData.yPosPid || { Kp: 1.2, Ki: 0.15, Kd: 0.08 },
              velPid: pidData.yVelPid || { Kp: 0, Ki: 0, Kd: 0 },
              setpoint: pidData.yposSet || 0,
            },
            totalError,
          },
        };
      })
    );

    return results.sort((a, b) => parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10));
  };

  const chartData = (label, data, color, setpoint = 0) => {
    const chart = {
      labels: Array.from({ length: data.length }, (_, index) =>
        (index * (15 / 75)).toFixed(1)
      ),
      datasets: [
        {
          label,
          data,
          fill: false,
          borderColor: color,
          tension: 0.1,
          pointRadius: 3,
        },
        {
          label: "Setpoint",
          data: Array(data.length).fill(setpoint),
          borderColor: "rgba(0, 0, 0, 0.5)",
          borderDash: [5, 5],
          pointRadius: 0,
        },
      ],
    };
    console.log(`Chart data for ${label}:`, {
      labels: chart.labels.slice(0, 5),
      data: chart.datasets[0].data.slice(0, 5)
    });
    return chart;
  };

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

  const exportToCSV = (result) => {
    const { timestamp, data, metrics } = result;
    const { xpos, ypos, xvel, yvel } = data;
    const timeLabels = Array.from({ length: xpos.length }, (_, index) =>
      (index * (15 / 75)).toFixed(1)
    );

    const headers = [
      "Time (s)",
      "Roll Position (rad)",
      "Pitch Position (rad)",
      "Roll Velocity (rad/s)",
      "Pitch Velocity (rad/s)",
      "Roll Setpoint (rad)",
      "Pitch Setpoint (rad)",
      "Roll Pos Kp",
      "Roll Pos Ki",
      "Roll Pos Kd",
      "Roll Vel Kp",
      "Roll Vel Ki",
      "Roll Vel Kd",
      "Pitch Pos Kp",
      "Pitch Pos Ki",
      "Pitch Pos Kd",
      "Pitch Vel Kp",
      "Pitch Vel Ki",
      "Pitch Vel Kd",
      "Roll Rise Time (s)",
      "Roll Settling Time (s)",
      "Roll Overshoot (rad)",
      "Roll Error",
      "Pitch Rise Time (s)",
      "Pitch Settling Time (s)",
      "Pitch Overshoot (rad)",
      "Pitch Error",
      "Total Error",
    ];

    const dataRows = timeLabels.map((time, index) => [
      time,
      ypos[index] || 0,
      xpos[index] || 0,
      yvel[index] || 0,
      xvel[index] || 0,
      metrics?.yPos.setpoint || 0,
      metrics?.xPos.setpoint || 0,
      metrics?.yPos.pid.Kp || 0,
      metrics?.yPos.pid.Ki || 0,
      metrics?.yPos.pid.Kd || 0,
      metrics?.yPos.velPid.Kp || 0,
      metrics?.yPos.velPid.Ki || 0,
      metrics?.yPos.velPid.Kd || 0,
      metrics?.xPos.pid.Kp || 0,
      metrics?.xPos.pid.Ki || 0,
      metrics?.xPos.pid.Kd || 0,
      metrics?.xPos.velPid.Kp || 0,
      metrics?.xPos.velPid.Ki || 0,
      metrics?.xPos.velPid.Kd || 0,
      index === 0 ? (metrics?.yPos.riseTime || "") : "",
      index === 0 ? (metrics?.yPos.settlingTime || "") : "",
      index === 0 ? (metrics?.yPos.overshoot || "") : "",
      index === 0 ? (metrics?.yPos.SSE || "") : "",
      index === 0 ? (metrics?.xPos.riseTime || "") : "",
      index === 0 ? (metrics?.xPos.settlingTime || "") : "",
      index === 0 ? (metrics?.xPos.overshoot || "") : "",
      index === 0 ? (metrics?.xPos.SSE || "") : "",
      index === 0 ? (metrics?.totalError || "") : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...dataRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `run_${timestamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`Exported CSV for run ${timestamp}`);
  };

  if (graphsVisibility === "hide" && calculationsVisibility === "hide") {
    return (
      <div className="multi-simulation-page">
        <h1>Quadrotor Results</h1>
        <Accessdeniedcomp />
      </div>
    );
  }

  return (
    <div className="multi-simulation-page">

      <Helmet>
        <title>Quadrotor Results</title>
      </Helmet>
      <ToastContainer position="bottom-right" />

      <h1>Quadrotor  Results</h1>

      {isLoading && (
        <p className="loading">
          <span className="spinner"></span> Loading...
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <div className="runs-container">
        {simulationResults.length === 0 ? (
          <h2 className="nodata">No data found.</h2>
        ) : (
          simulationResults.map((result, index) => {
            const { xpos } = result.data;
            const isIncomplete = xpos.length < 76;
            console.log(`Rendering run ${result.timestamp}, expanded: ${expandedRun === result.timestamp}`);
            return (
              <div key={result.timestamp} className="dropdown">
                <div className="dropdown-header">
                  <h2>Run {index + 1}</h2>
                  {isIncomplete ? (
                    <p>Incomplete Run</p>
                  ) : calculationsVisibility === "show" && result.metrics ? (
                    <p></p>
                  ) : (
                    calculationsVisibility === "show" && (
                      <p>Data length invalid, metrics unavailable</p>
                    )
                  )}
                <div className="buttonholder">
                  <button
                    className="toggle-button export-button"
                    onClick={() => exportToCSV(result)}
                  >
                    Save CSV
                  </button>
                  <button
                    className="toggle-button"
                    onClick={() => {
                      console.log(`Toggling run ${result.timestamp}`);
                      setExpandedRun(
                        expandedRun === result.timestamp ? null : result.timestamp
                      );
                    }}
                  >
                    {expandedRun === result.timestamp
                      ? "Hide Details"
                      : "Show Details"}
                  </button>
                 </div>
                </div>

                {expandedRun === result.timestamp && (
                  <div className="dropdown-content">
                    <div className="section-content">
                      {calculationsVisibility === "show" && result.metrics && (
                        <div className="params-metrics">
                          <div className="pid-params">
                            <h3>Roll PID Parameters</h3>
                            <p>Run ID: {result.timestamp}</p>
                            <p>Position Kp: {result.metrics.yPos.pid.Kp.toFixed(2)}</p>
                            <p>Position Ki: {result.metrics.yPos.pid.Ki.toFixed(2)}</p>
                            <p>Position Kd: {result.metrics.yPos.pid.Kd.toFixed(2)}</p>
                            <p>Velocity Kp: {result.metrics.yPos.velPid.Kp.toFixed(2)}</p>
                            <p>Velocity Ki: {result.metrics.yPos.velPid.Ki.toFixed(2)}</p>
                            <p>Velocity Kd: {result.metrics.yPos.velPid.Kd.toFixed(2)}</p>
                            <p>Setpoint: {result.metrics.yPos.setpoint.toFixed(2)} rad</p>
                          </div>
                          <div className="metrics">
                            <h3>Roll Performance Metrics</h3>
                            <p>Rise Time: {result.metrics.yPos.riseTime.toFixed(3)} s</p>
                            <p>Settling Time: {result.metrics.yPos.settlingTime.toFixed(3)} s</p>
                            <p>Overshoot: {result.metrics.yPos.overshoot.toFixed(3)} rad</p>
                            <p>Steady State Error: {result.metrics.yPos.SSE.toFixed(3)} rad</p>
                          </div>
                        </div>
                      )}

                      {graphsVisibility === "show" && (
                        <div className="charts-container">
                          <div className="chart">
                            <h4>Roll Position</h4>
                            <div className="chart-wrapper">
                              <Line
                                data={chartData(
                                  `Roll Position`,
                                  result.data.ypos,
                                  "rgb(75, 192, 192)",
                                  result.metrics?.yPos.setpoint || 0
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
                                  `Roll Velocity`,
                                  result.data.yvel,
                                  "rgb(255, 159, 64)"
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
                      )}

                      {calculationsVisibility === "show" && result.metrics && (
                        <div className="params-metrics">
                          <div className="pid-params">
                            <h3>Pitch PID Parameters</h3>
                            <p>Run ID: {result.timestamp}</p>
                            <p>Position Kp: {result.metrics.xPos.pid.Kp.toFixed(2)}</p>
                            <p>Position Ki: {result.metrics.xPos.pid.Ki.toFixed(2)}</p>
                            <p>Position Kd: {result.metrics.xPos.pid.Kd.toFixed(2)}</p>
                            <p>Velocity Kp: {result.metrics.xPos.velPid.Kp.toFixed(2)}</p>
                            <p>Velocity Ki: {result.metrics.xPos.velPid.Ki.toFixed(2)}</p>
                            <p>Velocity Kd: {result.metrics.xPos.velPid.Kd.toFixed(2)}</p>
                            <p>Setpoint: {result.metrics.xPos.setpoint.toFixed(2)} rad</p>
                          </div>
                          <div className="metrics">
                            <h3>Pitch Performance Metrics</h3>
                            <p>Rise Time: {result.metrics.xPos.riseTime.toFixed(3)} s</p>
                            <p>Settling Time: {result.metrics.xPos.settlingTime.toFixed(3)} s</p>
                            <p>Overshoot: {result.metrics.xPos.overshoot.toFixed(3)} rad</p>
                            <p>Steady State Error: {result.metrics.xPos.SSE.toFixed(3)} rad</p>
                          </div>
                        </div>
                      )}

                      {graphsVisibility === "show" && (
                        <div className="charts-container">
                          <div className="chart">
                            <h4>Pitch Position</h4>
                            <div className="chart-wrapper">
                              <Line
                                data={chartData(
                                  `Pitch Position`,
                                  result.data.xpos,
                                  "rgb(153, 102, 255)",
                                  result.metrics?.xPos.setpoint || 0
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
                                  `Pitch Velocity`,
                                  result.data.xvel,
                                  "rgb(255, 99, 132)"
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
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default MultiPage;