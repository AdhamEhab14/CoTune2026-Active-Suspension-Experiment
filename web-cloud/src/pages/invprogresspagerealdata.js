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
const SENSOR_TABLE = "INVSensorData";
const LQR_TABLE = "LQRparameters";

function MultiPageInv() {
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
        console.log("Credentials initialized");
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
        const data = await dbClient.send(new QueryCommand(params));

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
    if (!credentials || !id || (graphsVisibility === "hide" && calculationsVisibility === "hide")) return;

    const fetchSensorData = async () => {
      setIsLoading(true);
      setError(null);

      const dbClient = new DynamoDBClient({ region: REGION, credentials });

      const params = {
        TableName: SENSOR_TABLE,
        KeyConditionExpression: "identityId = :id",
        ExpressionAttributeValues: {
          ":id": { S: id },
        },
        ScanIndexForward: true,
      };

      try {
        const data = await dbClient.send(new QueryCommand(params));

        if (data.Items) {
          const groupedData = await groupDataByRun(data.Items, dbClient);
          // console.log(groupedData);
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

  const groupDataByRun = async (items, dbClient) => {
    const grouped = {};

    items.forEach((item) => {
      const timestamp = item.timestamp.N.toString();
      const runTimestamp = timestamp.slice(0, 13);
      const order = parseInt(timestamp.slice(-2), 10);

      const x = parseFloat(item.payload.M.xpos?.N) || 0;
      const xdot = parseFloat(item.payload.M.ypos?.N) || 0;
      const phi = parseFloat(item.payload.M.xvel?.N) || 0;
      const phidot = parseFloat(item.payload.M.yvel?.N) || 0;

      if (!grouped[runTimestamp]) {
        grouped[runTimestamp] = { x: [], xdot: [], phi: [], phidot: [] };
      }

      grouped[runTimestamp].x.push({ order, value: x });
      grouped[runTimestamp].xdot.push({ order, value: xdot });
      grouped[runTimestamp].phi.push({ order, value: phi });
      grouped[runTimestamp].phidot.push({ order, value: phidot });
    });

    const results = await Promise.all(
      Object.entries(grouped).map(async ([runTimestamp, data]) => {
        let lqrData = {};
        try {
          const lqrParams = {
            TableName: LQR_TABLE,
            KeyConditionExpression: "identityId = :id AND #ts = :ts",
            ExpressionAttributeNames: {
              "#ts": "timestamp",
            },
            ExpressionAttributeValues: {
              ":id": { S: id },
              ":ts": { N: runTimestamp },
            },
          };
          const lqrResponse = await dbClient.send(new QueryCommand(lqrParams));

          if (lqrResponse.Items && lqrResponse.Items.length > 0) {
            const item = lqrResponse.Items[0];
            lqrData = {
              Q00: parseFloat(item.Q00?.N) || 0,
              Q01: parseFloat(item.Q01?.N) || 0,
              Q02: parseFloat(item.Q02?.N) || 0,
              Q03: parseFloat(item.Q03?.N) || 0,
              Q10: parseFloat(item.Q10?.N) || 0,
              Q11: parseFloat(item.Q11?.N) || 0,
              Q12: parseFloat(item.Q12?.N) || 0,
              Q13: parseFloat(item.Q13?.N) || 0,
              Q20: parseFloat(item.Q20?.N) || 0,
              Q21: parseFloat(item.Q21?.N) || 0,
              Q22: parseFloat(item.Q22?.N) || 0,
              Q23: parseFloat(item.Q23?.N) || 0,
              Q30: parseFloat(item.Q30?.N) || 0,
              Q31: parseFloat(item.Q31?.N) || 0,
              Q32: parseFloat(item.Q32?.N) || 0,
              Q33: parseFloat(item.Q33?.N) || 0,
              R: parseFloat(item.R?.N) || 0,
              K0: parseFloat(item.K0?.N) || 0,
              K1: parseFloat(item.K1?.N) || 0,
              K2: parseFloat(item.K2?.N) || 0,
              K3: parseFloat(item.K3?.N) || 0,
            };
            console.log(`LQR data for ${runTimestamp}:`, lqrData);
          } else {
            console.warn(`No LQR data for timestamp ${runTimestamp}`);
          }
        } catch (err) {
          console.error(`Error querying LQRparameters for ${runTimestamp}:`, err);
        }

        const sortedX = data.x.sort((a, b) => a.order - b.order).map((v) => v.value);
        const sortedXdot = data.xdot.sort((a, b) => a.order - b.order).map((v) => v.value);
        const sortedPhi = data.phi.sort((a, b) => a.order - b.order).map((v) => v.value);
        const sortedPhidot = data.phidot.sort((a, b) => a.order - b.order).map((v) => v.value);

        return {
          timestamp: runTimestamp,
          data: {
            x: sortedX,
            xdot: sortedXdot,
            phi: sortedPhi,
            phidot: sortedPhidot,
          },
          lqrData,
        };
      })
    );

    return results.sort((a, b) => parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10));
  };

  const chartData = (label, data, color, setpoint = 0) => {
    return {
      labels: Array.from({ length: data.length }, (_, index) => (index * 0.2).toFixed(1)),
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
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { font: { size: 12 } },
      },
      title: {
        display: true,
        font: { size: 14 },
      },
      tooltip: {
        bodyFont: { size: 12 },
        titleFont: { size: 12 },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Time (s)",
          font: { size: 12 },
        },
        ticks: { font: { size: 10 } },
      },
      y: {
        title: {
          display: true,
          font: { size: 12 },
        },
        ticks: { font: { size: 10 } },
      },
    },
  };

  const exportToCSV = (result) => {
    const { timestamp, data, lqrData } = result;
    const { x, xdot, phi, phidot } = data;
    const timeLabels = Array.from({ length: x.length }, (_, i) => (i * 0.2).toFixed(1));

    const headers = [
      "Time (s)",
      "Cart Position (m)",
      "Cart Velocity (m/s)",
      "Angle (rad)",
      "Angular Velocity (rad/s)",
      "Q00", "Q01", "Q02", "Q03",
      "Q10", "Q11", "Q12", "Q13",
      "Q20", "Q21", "Q22", "Q23",
      "Q30", "Q31", "Q32", "Q33",
      "R",
      "K0", "K1", "K2", "K3",
    ];

    const dataRows = timeLabels.map((time, index) => [
      time,
      x[index] || 0,
      xdot[index] || 0,
      phi[index] || 0,
      phidot[index] || 0,
      index === 0 ? (lqrData?.Q00 || 0) : "",
      index === 0 ? (lqrData?.Q01 || 0) : "",
      index === 0 ? (lqrData?.Q02 || 0) : "",
      index === 0 ? (lqrData?.Q03 || 0) : "",
      index === 0 ? (lqrData?.Q10 || 0) : "",
      index === 0 ? (lqrData?.Q11 || 0) : "",
      index === 0 ? (lqrData?.Q12 || 0) : "",
      index === 0 ? (lqrData?.Q13 || 0) : "",
      index === 0 ? (lqrData?.Q20 || 0) : "",
      index === 0 ? (lqrData?.Q21 || 0) : "",
      index === 0 ? (lqrData?.Q22 || 0) : "",
      index === 0 ? (lqrData?.Q23 || 0) : "",
      index === 0 ? (lqrData?.Q30 || 0) : "",
      index === 0 ? (lqrData?.Q31 || 0) : "",
      index === 0 ? (lqrData?.Q32 || 0) : "",
      index === 0 ? (lqrData?.Q33 || 0) : "",
      index === 0 ? (lqrData?.R || 0) : "",
      index === 0 ? (lqrData?.K0 || 0) : "",
      index === 0 ? (lqrData?.K1 || 0) : "",
      index === 0 ? (lqrData?.K2 || 0) : "",
      index === 0 ? (lqrData?.K3 || 0) : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...dataRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `inv_run_${timestamp}.csv`);
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
        <h1>Inverted Pendulum Sensor Data Results</h1>
        <Accessdeniedcomp />
      </div>
    );
  }

  return (
    <div className="multi-simulation-page">

      <ToastContainer position="bottom-right" />

      <h1>Inverted Pendulum Results</h1>

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
            const { x } = result.data;
            const isIncomplete = x.length < 100;
            const hasLqrData = result.lqrData && Object.keys(result.lqrData).length > 0 && result.lqrData.Q00 !== undefined;
            return (
              <div key={result.timestamp} className="dropdown">
                

                  <Helmet>
                       <title>Pendulum Results</title>
                   </Helmet>
                    <div className="dropdown-header">
                  <h2>Run {index + 1}</h2>
                  {isIncomplete && <p>Incomplete Run</p>}
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
                        setExpandedRun(
                          expandedRun === result.timestamp ? null : result.timestamp
                        );
                      }}
                    >
                      {expandedRun === result.timestamp ? "Hide Details" : "Show Details"}
                    </button>
                  </div>
                </div>

                {expandedRun === result.timestamp && (
                  <div className="dropdown-content">
                    <div className="section-content">
                      {calculationsVisibility === "show" && (
                        <div className="params-metrics">
                          <div className="lqr-params">
                            <h3>LQR Parameters</h3>
                            <p>Run ID: {result.timestamp}</p>
                            {hasLqrData ? (
                              <>
                                <p>Q Matrix:</p>
                                <ul>
                                  <li>Q00: {result.lqrData.Q00.toFixed(2)}</li>
                                  <li>Q01: {result.lqrData.Q01.toFixed(2)}</li>
                                  <li>Q02: {result.lqrData.Q02.toFixed(2)}</li>
                                  <li>Q03: {result.lqrData.Q03.toFixed(2)}</li>
                                  <li>Q10: {result.lqrData.Q10.toFixed(2)}</li>
                                  <li>Q11: {result.lqrData.Q11.toFixed(2)}</li>
                                  <li>Q12: {result.lqrData.Q12.toFixed(2)}</li>
                                  <li>Q13: {result.lqrData.Q13.toFixed(2)}</li>
                                  <li>Q20: {result.lqrData.Q20.toFixed(2)}</li>
                                  <li>Q21: {result.lqrData.Q21.toFixed(2)}</li>
                                  <li>Q22: {result.lqrData.Q22.toFixed(2)}</li>
                                  <li>Q23: {result.lqrData.Q23.toFixed(2)}</li>
                                  <li>Q30: {result.lqrData.Q30.toFixed(2)}</li>
                                  <li>Q31: {result.lqrData.Q31.toFixed(2)}</li>
                                  <li>Q32: {result.lqrData.Q32.toFixed(2)}</li>
                                  <li>Q33: {result.lqrData.Q33.toFixed(2)}</li>
                                </ul>
                                <p>R: {result.lqrData.R.toFixed(2)}</p>
                                <p>K Matrix:</p>
                                <ul>
                                  <li>K0: {result.lqrData.K0.toFixed(4)}</li>
                                  <li>K1: {result.lqrData.K1.toFixed(4)}</li>
                                  <li>K2: {result.lqrData.K2.toFixed(4)}</li>
                                  <li>K3: {result.lqrData.K3.toFixed(4)}</li>
                                </ul>
                              </>
                            ) : (
                              <p>No LQR parameters found for this run.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {graphsVisibility === "show" && (
                        <div className="charts-container">
                          <div className="chart">
                            <h4>Cart Position</h4>
                            <div className="chart-wrapper">
                              <Line
                                data={chartData(
                                  "Cart Position (m)",
                                  result.data.x,
                                  "rgb(75, 192, 192)",
                                  0
                                )}
                                options={{
                                  ...chartOptions,
                                  plugins: {
                                    ...chartOptions.plugins,
                                    title: { display: true, text: "Cart Position" },
                                  },
                                  scales: {
                                    ...chartOptions.scales,
                                    y: {
                                      ...chartOptions.scales.y,
                                      title: { display: true, text: "Cart Position (m)" },
                                    },
                                  },
                                }}
                              />
                            </div>
                          </div>
                          <div className="chart">
                            <h4>Cart Velocity</h4>
                            <div className="chart-wrapper">
                              <Line
                                data={chartData(
                                  "Cart Velocity (m/s)",
                                  result.data.xdot,
                                  "rgb(153, 102, 255)",
                                  0
                                )}
                                options={{
                                  ...chartOptions,
                                  plugins: {
                                    ...chartOptions.plugins,
                                    title: { display: true, text: "Cart Velocity" },
                                  },
                                  scales: {
                                    ...chartOptions.scales,
                                    y: {
                                      ...chartOptions.scales.y,
                                      title: { display: true, text: "Cart Velocity (m/s)" },
                                    },
                                  },
                                }}
                              />
                            </div>
                          </div>
                          <div className="chart">
                            <h4>Angle</h4>
                            <div className="chart-wrapper">
                              <Line
                                data={chartData(
                                  "Angle (rad)",
                                  result.data.phi,
                                  "rgb(255, 159, 64)",
                                  0
                                )}
                                options={{
                                  ...chartOptions,
                                  plugins: {
                                    ...chartOptions.plugins,
                                    title: { display: true, text: "Angle" },
                                  },
                                  scales: {
                                    ...chartOptions.scales,
                                    y: {
                                      ...chartOptions.scales.y,
                                      title: { display: true, text: "Angle (rad)" },
                                    },
                                  },
                                }}
                              />
                            </div>
                          </div>
                          <div className="chart">
                            <h4>Angular Velocity</h4>
                            <div className="chart-wrapper">
                              <Line
                                data={chartData(
                                  "Angular Velocity (rad/s)",
                                  result.data.phidot,
                                  "rgb(255, 99, 132)",
                                  0
                                )}
                                options={{
                                  ...chartOptions,
                                  plugins: {
                                    ...chartOptions.plugins,
                                    title: { display: true, text: "Angular Velocity" },
                                  },
                                  scales: {
                                    ...chartOptions.scales,
                                    y: {
                                      ...chartOptions.scales.y,
                                      title: { display: true, text: "Angular Velocity (rad/s)" },
                                    },
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

export default MultiPageInv;