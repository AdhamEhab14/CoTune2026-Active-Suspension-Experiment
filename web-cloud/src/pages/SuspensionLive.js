import { useState, useEffect, useRef } from "react";
import React from 'react';
import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";
import { fetchAuthSession } from "@aws-amplify/auth";
import { Buffer } from "buffer";
import "./suspensionSimPage.css";
import { PubSub } from "@aws-amplify/pubsub";
import { IoTClient, AttachPolicyCommand } from "@aws-sdk/client-iot";
import useQueueStatus from "./Queue4";
import { Helmet } from "react-helmet-async";
import Loading from "../components/loading";
import { useNavigate } from "react-router-dom";
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
import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import LiveVideoPlayer from "./Video";
import { lqrJS } from "../controllers/LQR/lqr_calc";
import Modal from "../components/ModalExp";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Constants from Suspension Sim
const Ms = 2.45, Mus = 1.00, Ks = 900.0, Kus = 1250.0, Bs = 58.08, Bus = 14.726;

const A = [
  [0, 1, 0, -1],
  [-Ks / Ms, -Bs / Ms, 0, Bs / Ms],
  [0, 0, 0, 1],
  [Ks / Mus, Bs / Mus, -Kus / Mus, -(Bs + Bus) / Mus],
];
const B = [[0], [1 / Ms], [0], [-1 / Mus]];

// ---- Chart helper config ----
const CHART_OPTIONS = (yLabel) => ({
  animation: false,
  responsive: true,
  plugins: {
    legend: { position: "top", labels: { color: "var(--text-primary)" } },
  },
  scales: {
    x: {
      type: "category",
      title: { display: true, text: "Time (s)", color: "var(--text-primary)" },
      ticks: { color: "var(--text-primary)" }
    },
    y: {
      title: { display: true, text: yLabel, color: "var(--text-primary)" },
      ticks: { color: "var(--text-primary)" },
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

function SuspensionLive() {
  // Telemetry data from suspension/telemetry topic
  const [d1Data, setD1Data] = useState([]);
  const [d2Data, setD2Data] = useState([]);
  const [vsData, setVsData] = useState([]);
  const [vusData, setVusData] = useState([]);
  const [uData, setUData] = useState([]);
  
  const [isButtonsDisabled, setIsButtonsDisabled] = useState(false);
  const [message, setMessage] = useState(null);
  const [kValues, setKValues] = useState([0, 0, 0, 0]);
  const [timestamps, setTimestamps] = useState([]);

  // LQR parameters
  const [qMatrix, setQMatrix] = useState([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const [RValue, setRValue] = useState(0);

  // Road disturbance parameters
  const [roadAmp, setRoadAmp] = useState(0);
  const [roadFreq, setRoadFreq] = useState(0);

  const [credentials, setCredentials] = useState(null);
  const [iotClient, setIoTClient] = useState(null);
  const REGION = "eu-west-3";
  const TABLE_NAME = "SuspensionLQRParameters";

  const { isAllowed, identityId, position, timeRemaining, isLoading } = useQueueStatus();
  const navigate = useNavigate();
  const sessionStartTimeRef = useRef(null);
  const sessionRoadAmpRef = useRef(0);
  const sessionRoadFreqRef = useRef(0);

  useEffect(() => {
    const initializeIoTClient = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        const fetchedCredentials = session.credentials;
        const policyClient = new IoTClient({ region: REGION, credentials: fetchedCredentials });
        const policyCommand = new AttachPolicyCommand({ policyName: "IoTPolicy", target: session.identityId });
        await policyClient.send(policyCommand);
        setCredentials(fetchedCredentials);
        setIoTClient(new IoTDataPlaneClient({ region: REGION, credentials: fetchedCredentials }));
      } catch (err) {
        console.error("Error initializing IoT client:", err);
      }
    };
    initializeIoTClient();
  }, []);

  useEffect(() => {
    if (!credentials) return;
    const pubsub = new PubSub({
      region: REGION,
      credentials: credentials,
      endpoint: "wss://a3c1jrwyyxkjx6-ats.iot.eu-west-3.amazonaws.com/mqtt",
    });
    const subscription = pubsub.subscribe({ topics: "suspension/telemetry" }).subscribe({
      next: (data) => {
        const elapsed = sessionStartTimeRef.current
          ? ((Date.now() - sessionStartTimeRef.current) / 1000).toFixed(1)
          : "0.0";
        setMessage(data);
        setD1Data((prev) => [...prev, data.d1 || 0]);
        setD2Data((prev) => [...prev, data.d2 || 0]);
        setVsData((prev) => [...prev, data.vs || 0]);
        setVusData((prev) => [...prev, data.vus || 0]);
        setUData((prev) => [...prev, data.u || 0]);
        setTimestamps((prev) => [...prev, elapsed]);
      },
      error: (error) => console.error("Subscription error:", error),
    });
    return () => subscription.unsubscribe();
  }, [credentials]);

  // Auto-send STOP command when time runs out
  useEffect(() => {
    if (timeRemaining === 0 && iotClient && !isButtonsDisabled) {
      sendCommand("STOP");
    }
  }, [timeRemaining]);

  const handleQChange = (row, col, value) => {
    const newQ = [...qMatrix];
    newQ[row][col] = parseFloat(value) || 0;
    setQMatrix(newQ);
  };

  const handleRChange = (value) => {
    setRValue(parseFloat(value) || 0);
  };

  const computeKValues = () => {
    const R = [[RValue || 0]];
    try {
      const K = lqrJS(A, B, qMatrix, R);
      const kSwapped = [K[0][0], K[0][2], K[0][1], K[0][3]];
      setKValues(kSwapped);
      return kSwapped;
    } catch (error) {
      console.error("LQR computation error:", error);
      alert("LQR Calculation Failed: " + error.message);
      return [0, 0, 0, 0];
    }
  };

  const handleUseOurParameters = () => {
    setQMatrix([
      [100, 0, 0, 0],
      [0, 800, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    setRValue(0.05);
    setRoadAmp(15);
    setRoadFreq(25);
  };

  const saveLQRParameters = async (K, timestamp) => {
    if (!credentials) return;
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const params = {
        TableName: TABLE_NAME,
        Item: {
          identityId: { S: identityId },
          timestamp: { N: timestamp },
          Q00: { N: qMatrix[0][0].toString() },
          Q11: { N: qMatrix[1][1].toString() },
          Q22: { N: qMatrix[2][2].toString() },
          Q33: { N: qMatrix[3][3].toString() },
          R: { N: RValue.toString() },
          Amp: { N: roadAmp.toString() },
          Freq: { N: roadFreq.toString() },
          K0: { N: K[0].toString() },
          K1: { N: K[1].toString() },
          K2: { N: K[2].toString() },
          K3: { N: K[3].toString() },
        },
      };
      await dbClient.send(new PutItemCommand(params));
    } catch (error) {
      console.error("Error saving LQR parameters:", error);
    }
  };

  const sendCommand = async (action = "START") => {
    if (!iotClient) return;
    setIsButtonsDisabled(true);
    const timestamp = Date.now().toString();

    try {
      if (action === "START") {
        const K = computeKValues();
        sessionStartTimeRef.current = Date.now();
        sessionRoadAmpRef.current = roadAmp;
        sessionRoadFreqRef.current = roadFreq;
        const payload = { command: "START", K, amp: roadAmp, freq: roadFreq };
        const publishParams = {
          topic: "SUSP/Parameters",
          qos: 0,
          payload: Buffer.from(JSON.stringify(payload)),
        };
        await iotClient.send(new PublishCommand(publishParams));
        await iotClient.send(new PublishCommand({
          topic: "SUSP/Stream",
          qos: 0,
          payload: Buffer.from(JSON.stringify({ cmd: "start", id: identityId, timestamp })),
        }));
        await saveLQRParameters(K, timestamp);
        setTimeout(() => setIsButtonsDisabled(false), 5000);
      } else if (action === "STOP") {
        const payload = { command: "STOP" };
        const publishParams = {
          topic: "SUSP/Parameters",
          qos: 0,
          payload: Buffer.from(JSON.stringify(payload)),
        };
        await iotClient.send(new PublishCommand(publishParams));
        await iotClient.send(new PublishCommand({
          topic: "SUSP/Stream",
          qos: 0,
          payload: Buffer.from(JSON.stringify({ cmd: "stop", id: identityId, timestamp })),
        }));
        setTimeout(() => setIsButtonsDisabled(false), 1000);
      }
    } catch (err) {
      console.error(`Error sending ${action} command:`, err);
      setIsButtonsDisabled(false);
    }
  };

  const buildChartData = (label, dataArray, color) => {
    // Decimate for performance over 5 mins
    const step = Math.max(1, Math.floor(timestamps.length / 500));
    return {
      labels: timestamps.filter((_, i) => i % step === 0),
      datasets: [makeDataset(label, dataArray.filter((_, i) => i % step === 0), color)],
    };
  };

  const downloadCSV = () => {
    if (d1Data.length === 0) return;
    const ampM = (sessionRoadAmpRef.current / 1000).toFixed(4);
    const freqRads = sessionRoadFreqRef.current.toFixed(2);
    const header = "t_s,d1_m,d2_m,vs_mps,vus_mps,u_N,road_amp_m,road_freq_rads\n";
    const rows = d1Data.map((_, i) =>
      [
        timestamps[i] ?? (i * 1).toFixed(1),
        (d1Data[i] ?? 0).toFixed(5),
        (d2Data[i] ?? 0).toFixed(5),
        (vsData[i] ?? 0).toFixed(5),
        (vusData[i] ?? 0).toFixed(5),
        (uData[i] ?? 0).toFixed(4),
        ampM,
        freqRads,
      ].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suspension_session_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <Loading position={position} />;
  if (position > 1) return <Loading position={position} />;

  return (
    <div className="sim-page-wrapper">
      <Helmet><title>Active Suspension Live</title></Helmet>
      <h1 className="sim-page-title">Active Suspension System</h1>
      <Modal />
      
      <div className="sim-container">
        {/* LEFT COLUMN: Controls */}
        <div className="sim-left-panel">
          <h3>LQR Parameters</h3>
          
          <div style={{
            position: "fixed", top: "90px", right: "1rem", zIndex: 1100,
            background: "var(--card-bg)", border: "1px solid var(--card-border)",
            borderRadius: "8px", padding: "0.4rem 0.9rem",
            fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)",
            whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
          }}>
            ⏱ {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')} remaining
          </div>

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
              <h3>R Matrix</h3>
              <div className="r-inputs-suspension">
                <label>R (Force Penalty)</label>
                <input type="number" step="0.01" value={RValue} onChange={(e) => handleRChange(e.target.value)} />
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
              className="btn btn-warning"
              onClick={handleUseOurParameters}
              style={{ backgroundColor: "#ff9f43", color: "#fff", borderColor: "#ff9f43", minWidth: '280px' }}
            >
              Use Recommended Parameters
            </button>
            <button
              className={`btn ${isButtonsDisabled ? 'btn-secondary' : 'btn-primary'} start-sim-btn`}
              onClick={() => sendCommand("START")}
              disabled={isButtonsDisabled}
            >
              {isButtonsDisabled ? "Processing..." : "Start Live"}
            </button>
            <button
              className={`btn ${isButtonsDisabled ? 'btn-secondary' : 'btn-danger'} stop-sim-btn`}
              onClick={() => sendCommand("STOP")}
              disabled={isButtonsDisabled}
              style={{ backgroundColor: "#dc3545", borderColor: "#dc3545", marginTop: "0.5rem", width: "200px" }}
            >
              {isButtonsDisabled ? "Processing..." : "Stop Live"}
            </button>
            {d1Data.length > 0 && (
              <button
                className="btn btn-success"
                onClick={downloadCSV}
                style={{ marginTop: "0.5rem", width: "200px" }}
              >
                Download CSV ({d1Data.length} pts)
              </button>
            )}
        </div>

        {/* RIGHT COLUMN: Video Player & Live Data */}
        <div className="sim-right-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <div className="viewer-header">
            <h3>Live Hardware Feed</h3>
          </div>

          <div className="video-stream-instance1" style={{ flexGrow: 1, maxHeight: '60%', overflow: 'hidden', padding: '10px' }}>
            <LiveVideoPlayer />
          </div>
        </div>
      </div>

      <div className="message-box" style={{ padding: '15px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--card-border)', maxWidth: '75%', margin: '-2rem auto 0', alignItems: 'center' }}>
        <h3 style={{ fontSize: "1.1em", marginBottom: "10px", color: "var(--text-primary)" }}>Live Telemetry</h3>
        {message ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', color: "var(--text-primary)" }}>
            <p>d1 (Suspension Travel): {message.d1?.toFixed(3)} m</p>
            <p>d2 (Tire Deflection): {message.d2?.toFixed(3)} m</p>
            <p>vs (Sprung Velocity): {message.vs?.toFixed(3)} m/s</p>
            <p>vus (Unsprung Velocity): {message.vus?.toFixed(3)} m/s</p>
            <p>u (Control Force): {message.u?.toFixed(3)} N</p>
          </div>
        ) : <p style={{ color: "var(--text-secondary)" }}>Waiting for hardware connection...</p>}
      </div>
      <button
        className="btn btn-primary"
        onClick={() => navigate('/SuspensionProgress')}
        style={{ width: '100%', maxWidth: '200px', margin: '2rem auto 0', display: 'block' }}
      >
        Track your Progress
      </button>

      {/* CHARTS SECTION */}
      <div className="charts-section suspension-charts">

          <h3>System Displacements</h3>
          <div className="chart-card">
            <h4>d1 - Suspension Travel (m)</h4>
            <div className="chart-wrapper">
              <Line data={buildChartData("Suspension Travel", d1Data, "#007bff")} options={CHART_OPTIONS("Displacement (m)")} />
            </div>
          </div>
          <div className="chart-card">
            <h4>d2 - Tire Deflection (m)</h4>
            <div className="chart-wrapper">
              <Line data={buildChartData("Tire Deflection", d2Data, "#dc3545")} options={CHART_OPTIONS("Displacement (m)")} />
            </div>
          </div>

          <h3>System Velocities</h3>
          <div className="chart-card">
            <h4>vs - Sprung Mass Velocity (m/s)</h4>
            <div className="chart-wrapper">
              <Line data={buildChartData("Sprung Velocity", vsData, "#28a745")} options={CHART_OPTIONS("Velocity (m/s)")} />
            </div>
          </div>
          <div className="chart-card">
            <h4>vus - Unsprung Mass Velocity (m/s)</h4>
            <div className="chart-wrapper">
              <Line data={buildChartData("Unsprung Velocity", vusData, "#ffc107")} options={CHART_OPTIONS("Velocity (m/s)")} />
            </div>
          </div>

          <h3>Control Output</h3>
          <div className="chart-card">
            <h4>u - Control Force (N)</h4>
            <div className="chart-wrapper">
              <Line data={buildChartData('Control Force', uData, '#9d4edd')} options={CHART_OPTIONS('Force (N)')} />
            </div>
          </div>
      </div>
    </div>
  );
}

export default SuspensionLive;
