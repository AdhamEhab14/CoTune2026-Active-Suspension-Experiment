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
const SENSOR_TABLE = "RotarySensorData";
const LQR_TABLE = "RotaryLQRParameters";

function RotaryProgress() {
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
            style={{ padding: "0.5em 1em", backgroundColor: "#007bff", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            Go to Feedback Page
          </button>
        </div>
      </div>,
      { autoClose: false, pauseOnHover: true, className: "custom-toast", closeButton: true }
    );
  }, 1000);
  return () => clearTimeout(timer);
}, [navigate]);

  useEffect(() => {
    const initializeAWS = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        if (!session.credentials) throw new Error("No credentials found in session");
        setCredentials(session.credentials);
        setId(session.identityId);
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
          ExpressionAttributeValues: { ":id": { S: id } },
        };
        const data = await dbClient.send(new QueryCommand(params));
        setGraphsVisibility(data.Items?.[0]?.graphsVisibility?.S || "show");
        setCalculationsVisibility(data.Items?.[0]?.calculationsVisibility?.S || "show");
      } catch (err) {
        console.error("Error checking visibility:", err);
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
        ExpressionAttributeValues: { ":id": { S: id } },
        ScanIndexForward: true,
      };
      try {
        const data = await dbClient.send(new QueryCommand(params));
        if (data.Items) {
          const groupedData = await groupDataByRun(data.Items, dbClient);
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
      const runTimestamp = timestamp.slice(0, 13); // group by millisecond roughly
      const order = parseInt(timestamp.slice(-2), 10) || 0; // fallback if no order formatting

      // AWS IoT Rule structure usually dumps payload in 'payload' dictionary or top-level.
      // Based on prior implementations, let's look for payload.M or direct properties.
      const properties = item.payload ? item.payload.M : item;
      
      const theta = parseFloat(properties.theta?.N) || 0;
      const alpha = parseFloat(properties.alpha?.N) || 0;
      const theta_dot = parseFloat(properties.theta_dot?.N) || 0;
      const alpha_dot = parseFloat(properties.alpha_dot?.N) || 0;

      if (!grouped[runTimestamp]) {
        grouped[runTimestamp] = { theta: [], alpha: [], theta_dot: [], alpha_dot: [] };
      }

      grouped[runTimestamp].theta.push({ order, value: theta });
      grouped[runTimestamp].alpha.push({ order, value: alpha });
      grouped[runTimestamp].theta_dot.push({ order, value: theta_dot });
      grouped[runTimestamp].alpha_dot.push({ order, value: alpha_dot });
    });

    const results = await Promise.all(
      Object.entries(grouped).map(async ([runTimestamp, data]) => {
        let lqrData = {};
        try {
          const lqrParams = {
            TableName: LQR_TABLE,
            KeyConditionExpression: "identityId = :id AND #ts = :ts",
            ExpressionAttributeNames: { "#ts": "timestamp" },
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
              Q11: parseFloat(item.Q11?.N) || 0,
              Q22: parseFloat(item.Q22?.N) || 0,
              Q33: parseFloat(item.Q33?.N) || 0,
              R: parseFloat(item.R?.N) || 0,
              K0: parseFloat(item.K0?.N) || 0,
              K1: parseFloat(item.K1?.N) || 0,
              K2: parseFloat(item.K2?.N) || 0,
              K3: parseFloat(item.K3?.N) || 0,
            };
          }
        } catch (err) {
          console.error(`Error querying LQRparameters for ${runTimestamp}:`, err);
        }

        const sortedTheta = data.theta.sort((a, b) => a.order - b.order).map((v) => v.value);
        const sortedAlpha = data.alpha.sort((a, b) => a.order - b.order).map((v) => v.value);
        const sortedThetaDot = data.theta_dot.sort((a, b) => a.order - b.order).map((v) => v.value);
        const sortedAlphaDot = data.alpha_dot.sort((a, b) => a.order - b.order).map((v) => v.value);

        return {
          timestamp: runTimestamp,
          data: {
            theta: sortedTheta,
            alpha: sortedAlpha,
            theta_dot: sortedThetaDot,
            alpha_dot: sortedAlphaDot,
          },
          lqrData,
        };
      })
    );
    return results.sort((a, b) => parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10));
  };

  const chartData = (label, data, color, setpoint = 0) => {
    return {
      labels: Array.from({ length: data.length }, (_, index) => (index * 0.1).toFixed(1)),
      datasets: [
        { label, data, fill: false, borderColor: color, tension: 0.1, pointRadius: 0 },
        { label: "Setpoint", data: Array(data.length).fill(setpoint), borderColor: "rgba(0, 0, 0, 0.5)", borderDash: [5, 5], pointRadius: 0 },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top", labels: { font: { size: 12 } } } },
    scales: {
      x: { title: { display: true, text: "Time (s)" } },
      y: { title: { display: true } },
    },
  };

  const exportToCSV = (result) => {
    const { timestamp, data, lqrData } = result;
    const { theta, alpha, theta_dot, alpha_dot } = data;
    const timeLabels = Array.from({ length: theta.length }, (_, i) => (i * 0.1).toFixed(1));

    const headers = [
      "Time (s)", "Arm Angle (rad)", "Pendulum Angle (rad)", "Arm Velocity (rad/s)", "Pendulum Velocity (rad/s)",
      "Q00", "Q11", "Q22", "Q33", "R", "K0", "K1", "K2", "K3"
    ];

    const dataRows = timeLabels.map((time, index) => [
      time, theta[index] || 0, alpha[index] || 0, theta_dot[index] || 0, alpha_dot[index] || 0,
      index === 0 ? (lqrData?.Q00 || 0) : "",
      index === 0 ? (lqrData?.Q11 || 0) : "",
      index === 0 ? (lqrData?.Q22 || 0) : "",
      index === 0 ? (lqrData?.Q33 || 0) : "",
      index === 0 ? (lqrData?.R || 0) : "",
      index === 0 ? (lqrData?.K0 || 0) : "",
      index === 0 ? (lqrData?.K1 || 0) : "",
      index === 0 ? (lqrData?.K2 || 0) : "",
      index === 0 ? (lqrData?.K3 || 0) : "",
    ]);

    const csvContent = [headers.join(","), ...dataRows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `rotary_run_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (graphsVisibility === "hide" && calculationsVisibility === "hide") {
    return <div className="multi-simulation-page"><h1>Rotary Pendulum Results</h1><Accessdeniedcomp /></div>;
  }

  return (
    <div className="multi-simulation-page">
      <ToastContainer position="bottom-right" />
      <h1>Rotary Inverted Pendulum Results</h1>

      {isLoading && <p className="loading"><span className="spinner"></span> Loading...</p>}
      {error && <p className="error">{error}</p>}

      <div className="runs-container">
        {simulationResults.length === 0 ? (
          <h2 className="nodata">No data found.</h2>
        ) : (
          simulationResults.map((result, index) => {
            const hasLqrData = result.lqrData && Object.keys(result.lqrData).length > 0;
            return (
              <div key={result.timestamp} className="dropdown">
                <Helmet><title>Rotary Results</title></Helmet>
                <div className="dropdown-header">
                  <h2>Run {index + 1}</h2>
                  <div className="buttonholder">
                    <button className="toggle-button export-button" onClick={() => exportToCSV(result)}>Save CSV</button>
                    <button className="toggle-button" onClick={() => setExpandedRun(expandedRun === result.timestamp ? null : result.timestamp)}>
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
                                <p>Diagonal Q Matrix: Q00: {result.lqrData.Q00}, Q11: {result.lqrData.Q11}, Q22: {result.lqrData.Q22}, Q33: {result.lqrData.Q33}</p>
                                <p>R: {result.lqrData.R}</p>
                                <p>K Vector: [{result.lqrData.K0.toFixed(3)}, {result.lqrData.K1.toFixed(3)}, {result.lqrData.K2.toFixed(3)}, {result.lqrData.K3.toFixed(3)}]</p>
                              </>
                            ) : <p>No LQR parameters saved for this run.</p>}
                          </div>
                        </div>
                      )}

                      {graphsVisibility === "show" && (
                        <div className="charts-container">
                          <div className="chart">
                            <h4>Arm Angle (θ)</h4>
                            <div className="chart-wrapper"><Line data={chartData("Arm Angle θ (rad)", result.data.theta, "#36A2EB")} options={chartOptions}/></div>
                          </div>
                          <div className="chart">
                            <h4>Pendulum Angle (α)</h4>
                            <div className="chart-wrapper"><Line data={chartData("Pendulum Angle α (rad)", result.data.alpha, "#FF6384")} options={chartOptions}/></div>
                          </div>
                          <div className="chart">
                            <h4>Arm Velocity</h4>
                            <div className="chart-wrapper"><Line data={chartData("Arm Velocity θ̇ (rad/s)", result.data.theta_dot, "#4BC0C0")} options={chartOptions}/></div>
                          </div>
                          <div className="chart">
                            <h4>Pendulum Velocity</h4>
                            <div className="chart-wrapper"><Line data={chartData("Pendulum Velocity α̇ (rad/s)", result.data.alpha_dot, "#FFCE56")} options={chartOptions}/></div>
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

export default RotaryProgress;
