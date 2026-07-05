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
const SENSOR_TABLE = "SuspensionSensorData";
const LQR_TABLE = "SuspensionLQRParameters";

function SuspensionProgress() {
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
      const runTimestamp = timestamp.slice(0, 13);
      const order = parseInt(timestamp.slice(-2), 10) || 0;

      const properties = item.payload ? item.payload.M : item;
      
      const zs = parseFloat(properties.zs?.N) || 0;
      const zus = parseFloat(properties.zus?.N) || 0;
      const zs_ddot = parseFloat(properties.zs_ddot?.N) || 0;
      const zr = parseFloat(properties.zr?.N) || 0;

      if (!grouped[runTimestamp]) {
        grouped[runTimestamp] = { zs: [], zus: [], zs_ddot: [], zr: [] };
      }

      grouped[runTimestamp].zs.push({ order, value: zs });
      grouped[runTimestamp].zus.push({ order, value: zus });
      grouped[runTimestamp].zs_ddot.push({ order, value: zs_ddot });
      grouped[runTimestamp].zr.push({ order, value: zr });
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

        const sortedZs = data.zs.sort((a, b) => a.order - b.order).map((v) => v.value);
        const sortedZus = data.zus.sort((a, b) => a.order - b.order).map((v) => v.value);
        const sortedZsDdot = data.zs_ddot.sort((a, b) => a.order - b.order).map((v) => v.value);
        const sortedZr = data.zr.sort((a, b) => a.order - b.order).map((v) => v.value);
        
        // Calculate the actual metrics we want to plot (Travel, Deflection)
        const travel = sortedZs.map((val, idx) => val - sortedZus[idx]);
        const deflection = sortedZus.map((val, idx) => val - sortedZr[idx]);

        return {
          timestamp: runTimestamp,
          data: {
            travel,
            zs_ddot: sortedZsDdot,
            deflection,
            zr: sortedZr,
            zsRaw: sortedZs,
            zusRaw: sortedZus
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
    const { travel, zs_ddot, deflection, zr, zsRaw, zusRaw } = data;
    const timeLabels = Array.from({ length: travel.length }, (_, i) => (i * 0.1).toFixed(1));

    const headers = [
      "Time (s)", "Sprung Mass Zs", "Unsprung Mass Zus", "Road Zr", "Suspension Travel (Zs-Zus)", "Ride Comfort (Zs_ddot)", "Tire Deflection (Zus-Zr)",
      "Q00", "Q11", "Q22", "Q33", "R", "K0", "K1", "K2", "K3"
    ];

    const dataRows = timeLabels.map((time, index) => [
      time, zsRaw[index] || 0, zusRaw[index] || 0, zr[index] || 0, travel[index] || 0, zs_ddot[index] || 0, deflection[index] || 0,
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
    link.setAttribute("download", `suspension_run_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (graphsVisibility === "hide" && calculationsVisibility === "hide") {
    return <div className="multi-simulation-page"><h1>Active Suspension Results</h1><Accessdeniedcomp /></div>;
  }

  return (
    <div className="multi-simulation-page">
      <ToastContainer position="bottom-right" />
      <h1>Active Suspension Results</h1>

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
                <Helmet><title>Suspension Results</title></Helmet>
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
                                <p>State Penalty Matrix Q:</p>
                                <ul>
                                  <li>Travel: {result.lqrData.Q00}</li>
                                  <li>S_Vel: {result.lqrData.Q11}</li>
                                  <li>Deflection: {result.lqrData.Q22}</li>
                                  <li>T_Vel: {result.lqrData.Q33}</li>
                                </ul>
                                <p>Control Force Penalty R: {result.lqrData.R}</p>
                                <p>K Vector: [{result.lqrData.K0.toFixed(3)}, {result.lqrData.K1.toFixed(3)}, {result.lqrData.K2.toFixed(3)}, {result.lqrData.K3.toFixed(3)}]</p>
                              </>
                            ) : <p>No LQR parameters saved for this run.</p>}
                          </div>
                        </div>
                      )}

                      {graphsVisibility === "show" && (
                        <div className="charts-container">
                          <div className="chart">
                            <h4>Suspension Travel (Zs-Zus)</h4>
                            <div className="chart-wrapper"><Line data={chartData("Travel (m)", result.data.travel, "#0d6efd")} options={chartOptions}/></div>
                          </div>
                          <div className="chart">
                            <h4>Ride Comfort (Zs_ddot)</h4>
                            <div className="chart-wrapper"><Line data={chartData("Accel (m/s²)", result.data.zs_ddot, "#dc3545")} options={chartOptions}/></div>
                          </div>
                          <div className="chart">
                            <h4>Tire Deflection (Zus-Zr)</h4>
                            <div className="chart-wrapper"><Line data={chartData("Deflection (m)", result.data.deflection, "#198754")} options={chartOptions}/></div>
                          </div>
                          <div className="chart">
                            <h4>Road Profile (Zr)</h4>
                            <div className="chart-wrapper"><Line data={chartData("Disturbance (m)", result.data.zr, "#fd7e14")} options={chartOptions}/></div>
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

export default SuspensionProgress;
