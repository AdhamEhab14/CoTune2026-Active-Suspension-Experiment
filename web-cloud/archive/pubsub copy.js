import { useState, useEffect } from "react";
import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";
import { fetchAuthSession } from "@aws-amplify/auth";
import { Buffer } from "buffer";
import "../pages/pubsub.css";
import { PubSub } from "@aws-amplify/pubsub";
import { IoTClient, AttachPolicyCommand } from "@aws-sdk/client-iot";
import { URDFViewer } from "../experiments/quadrotor/URDFViewer";
import useQueueStatus from "../pages/Queue1";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Line } from "react-chartjs-2";
import Loading from "../components/loading";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Modal from "../components/Modal";
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
import LiveVideoPlayer from "../Video";
import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import "./custom-toast.css";

function App() {
  const navigate = useNavigate();
  const { isAllowed, identityId, position, timeRemaining } = useQueueStatus();
  const REGION = "eu-west-3";
  const PID_TABLE_NAME = "PIDParameters";

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
  );

  const [credentials, setCredentials] = useState(null);
  const [iotClient, setIoTClient] = useState(null);
  const [showLive, setShowLive] = useState(true);
  const [JointAngle1, setJointAngle1] = useState(0);
  const [JointAngle2, setJointAngle2] = useState(0);
  const [xposData, setXposData] = useState([]);
  const [yposData, setYposData] = useState([]);
  const [xvelData, setXvelData] = useState([]);
  const [yvelData, setYvelData] = useState([]);
  const [timestamps, setTimestamps] = useState([]);
  const urdfUrl1 = "2dofhover/urdf/2dofhover.urdf";
  const [message, setMessage] = useState(null);
  const [pidValues, setPidValues] = useState({
    p1: 0.0, i1: 0.0, d1: 0.0,
    p2: 0.0, i2: 0.0, d2: 0.0,
    p3: 0.0, i3: 0.0, d3: 0.0,
    p4: 0.0, i4: 0.0, d4: 0.0,
  });
  const [angleValues, setAngleValues] = useState({
    roll: 0.0, pitch: 0.0,
  });
  const [isButtonsDisabled, setIsButtonsDisabled] = useState(false);

  // Toast notification on page load
  useEffect(() => {
    const timer = setTimeout(() => {
      toast("⚠️ Heads up! Hitting Send Parameters alone won’t launch the experiment — don’t forget to hit Start Experiment too!", {
        autoClose: 5000,
        pauseOnHover: true,
        className: "custom-toast",
        closeButton: true,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize IoT client
  useEffect(() => {
    const initializeIoTClient = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        if (!session.credentials) throw new Error("No credentials found");
        const fetchedCredentials = session.credentials;
        const policyClient = new IoTClient({
          region: REGION,
          credentials: fetchedCredentials,
        });
        await policyClient.send(new AttachPolicyCommand({
          policyName: "IoTPolicy",
          target: session.identityId,
        }));
        setCredentials(fetchedCredentials);
        setIoTClient(new IoTDataPlaneClient({
          region: REGION,
          credentials: fetchedCredentials,
        }));
      } catch (err) {
        console.error("Error initializing IoT client:", err);
        toast.error("Failed to initialize IoT client");
      }
    };
    initializeIoTClient();
  }, []);

  // Publish wake-up command
  useEffect(() => {
    if (iotClient) handlePublish6();
  }, [iotClient]);

  // Subscribe to IoT topic
  useEffect(() => {
    if (!credentials) return;
    const pubsub = new PubSub({
      region: REGION,
      credentials,
      endpoint: "wss://a3c1jrwyyxkjx6-ats.iot.eu-west-3.amazonaws.com/mqtt",
    });
    const subscription = pubsub.subscribe({ topics: "2DOF/Data" }).subscribe({
      next: (data) => {
        setMessage(data);
        setXposData((prev) => [...prev, data.xpos]);
        setYposData((prev) => [...prev, data.ypos]);
        setXvelData((prev) => [...prev, data.xvel]);
        setYvelData((prev) => [...prev, data.yvel]);
        setJointAngle1(data.xpos);
        setJointAngle2(data.ypos);
        setTimestamps((prev) => [
          ...prev,
          (prev.length * 0.2).toFixed(1),
        ]);
      },
      error: (error) => {
        console.error("Subscription error:", error);
        toast.error("Failed to receive data");
      },
      complete: () => console.log("Subscription complete"),
    });
    return () => subscription.unsubscribe();
  }, [credentials]);

  // Input handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    setPidValues((prev) => ({
      ...prev,
      [name]: isNaN(numValue) ? 0 : numValue,
    }));
  };

  const handleAngleChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    setAngleValues((prev) => ({
      ...prev,
      [name]: isNaN(numValue) ? 0 : numValue,
    }));
  };

  // Publish functions
  const handlePublish = async (payload) => {
    if (!iotClient) {
      toast.error("IoT client not initialized");
      return;
    }
    try {
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "2DOF/Parameters",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Published:", payload);
    } catch (err) {
      console.error("Publish error:", err);
      toast.error("Failed to send parameters");
    }
  };

  const handlePublish2 = async (pidPayload) => {
    if (!iotClient || !credentials) {
      toast.error("IoT client or credentials not initialized");
      return;
    }
    try {
      const timestamp = Date.now().toString();
      await handlePublish({
        id: identityId,
        timestamp,
        work: 1,
      });
      const dbClient = new DynamoDBClient({ region: REGION, credentials });
      const pidParams = {
        TableName: PID_TABLE_NAME,
        Item: {
          identityId: { S: identityId },
          timestamp: { N: timestamp.slice(0, 13) },
          xposkp: { N: pidPayload.xposkp.toString() },
          xposki: { N: pidPayload.xposki.toString() },
          xposkd: { N: pidPayload.xposkd.toString() },
          xvelkp: { N: pidPayload.xvelkp.toString() },
          xvelki: { N: pidPayload.xvelki.toString() },
          xvelkd: { N: pidPayload.xvelkd.toString() },
          yposkp: { N: pidPayload.yposkp.toString() },
          yposki: { N: pidPayload.yposki.toString() },
          yposkd: { N: pidPayload.yposkd.toString() },
          yvelkp: { N: pidPayload.yvelkp.toString() },
          yvelki: { N: pidPayload.yvelki.toString() },
          yvelkd: { N: pidPayload.yvelkd.toString() },
          xposSet: { N: pidPayload.xposSet.toString() },
          yposSet: { N: pidPayload.yposSet.toString() },
        },
      };
      await dbClient.send(new PutItemCommand(pidParams));
      console.log("Saved PID parameters:", pidParams.Item);
    } catch (err) {
      console.error("Error in handlePublish2:", err);
      toast.error("Failed to save parameters");
    }
  };

  const handlePublish3 = async () => {
    if (!iotClient) {
      toast.error("IoT client not initialized");
      return;
    }
    try {
      const payload = { state: { desired: { stream1: "on" } } };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "$aws/things/RaspberryPiStreamer/shadow/name/StreamShadow/update",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Published:", payload);
    } catch (err) {
      console.error("Publish error:", err);
      toast.error("Failed to start stream");
    }
  };

  const handlePublish5 = async () => {
    if (!iotClient) {
      toast.error("IoT client not initialized");
      return;
    }
    try {
      const payload = { state: { desired: { stream1: "off" } } };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "$aws/things/RaspberryPiStreamer/shadow/name/StreamShadow/update",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Published:", payload);
    } catch (err) {
      console.error("Publish error:", err);
      toast.error("Failed to stop stream");
    }
  };

  const handlePublish6 = async () => {
    if (!iotClient) return;
    try {
      const payload = { status: "ON" };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "Esp32_RpiWakeup/sub",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Published:", payload);
    } catch (err) {
      console.error("Publish error:", err);
    }
  };

  const handlePublish7 = async () => {
    if (!iotClient) {
      toast.error("IoT client not initialized");
      return;
    }
    try {
      const payload = { state: { desired: { raspberry: "off" } } };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "$aws/things/RaspberryPiStreamer/shadow/name/StreamShadow/update",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Published:", payload);
    } catch (err) {
      console.error("Publish error:", err);
      toast.error("Failed to stop Raspberry Pi");
    }
  };

  // Command handlers
  const sendCommand = async () => {
    setIsButtonsDisabled(true);
    resetData();
    await handlePublish({
      xposkp: 9.0, xposki: 0.0, xposkd: 0.5,
      xvelkp: 16.0, xvelki: 5.0, xvelkd: 0.0,
      yposkp: 9.0, yposki: 0.0, yposkd: 0.5,
      yvelkp: 11.0, yvelki: 5.0, yvelkd: 0.0,
      yposSet: 0.0, xposSet: 0.0,
    });
    await handlePublish2({
      xposkp: 9.0, xposki: 0.0, xposkd: 0.5,
      xvelkp: 16.0, xvelki: 5.0, xvelkd: 0.0,
      yposkp: 9.0, yposki: 0.0, yposkd: 0.5,
      yvelkp: 11.0, yvelki: 5.0, yvelkd: 0.0,
      yposSet: 0.0, xposSet: 0.0,
    });
    setTimeout(() => setIsButtonsDisabled(false), 15000);
  };

  const sendCommand2 = async () => {
    setIsButtonsDisabled(true);
    resetData();
    const payload = {
      xposkp: parseFloat(pidValues.p1), xposki: parseFloat(pidValues.i1), xposkd: parseFloat(pidValues.d1),
      xvelkp: parseFloat(pidValues.p2), xvelki: parseFloat(pidValues.i2), xvelkd: parseFloat(pidValues.d2),
      yposkp: parseFloat(pidValues.p3), yposki: parseFloat(pidValues.i3), yposkd: parseFloat(pidValues.d3),
      yvelkp: parseFloat(pidValues.p4), yvelki: parseFloat(pidValues.i4), yvelkd: parseFloat(pidValues.d4),
      yposSet: parseFloat(angleValues.roll), xposSet: parseFloat(angleValues.pitch),
    };
    await handlePublish(payload);
    await handlePublish2(payload);
    setTimeout(() => setIsButtonsDisabled(false), 15000);
  };

  const handleClick = () => {
    if (showLive) {
      handlePublish3();
    } else {
      handlePublish5();
    }
    setShowLive(!showLive);
  };

  const resetData = () => {
    setTimestamps([]);
    setMessage(null);
    setXposData([]);
    setYposData([]);
    setXvelData([]);
    setYvelData([]);
    setJointAngle1(0);
    setJointAngle2(0);
  };

  // Chart data
  const chartData = (label, data, color) => ({
    labels: timestamps,
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

  const [viewerWidth, setViewerWidth] = useState(getViewerWidth());
  function getViewerWidth() {
    return window.innerWidth > 1200 ? 1000 : window.innerWidth > 768 ? 360 : 350;
  }
  useEffect(() => {
    const handleResize = () => setViewerWidth(getViewerWidth());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const options = {
    animation: false,
    responsive: true,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: { label: (tooltipItem) => `Value: ${tooltipItem.raw}` },
      },
    },
  };

  return (
    <div className="pageContainer">
      {isAllowed ? (
        <div className="containerQ">
          <Helmet>
            <title>Quadrotor</title>
          </Helmet>
          <div className="container2">
            <h1 className="friendly-heading">Quadrotor</h1>
            {timeRemaining !== null && (
              <div className="timer-container" style={{
                textAlign: 'center',
                margin: '10px 0',
                padding: '10px',
                backgroundColor: '#f0f0f0',
                borderRadius: '5px'
              }}>
                <h3>Time Remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</h3>
              </div>
            )}
            <div className="pid-inputs-container">
              <div className="raw1">
                <div className="pitch-inputs">
                  <h4>Pitch Set Point</h4>
                  <div className="input-row">
                    <div className="input-group">
                      <label htmlFor="pitch">Pitch (rad)</label>
                      <input
                        type="number"
                        name="pitch"
                        value={angleValues.pitch}
                        onChange={handleAngleChange}
                        className="custom-input"
                        step="0.01"
                        min="-0.6"
                        max="0.6"
                      />
                    </div>
                  </div>
                </div>
                <div className="pid-inputs">
                  <h4>Pitch Position</h4>
                  <div className="input-row">
                    {["p1", "i1", "d1"].map((name, i) => (
                      <div className="input-group" key={i}>
                        <label htmlFor={name}>K{["P", "I", "D"][i]}</label>
                        <input
                          type="number"
                          name={name}
                          value={pidValues[name]}
                          onChange={handleInputChange}
                          step="0.1"
                          min="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pid-inputs">
                  <h4>Pitch Velocity</h4>
                  <div className="input-row">
                    {["p2", "i2", "d2"].map((name, i) => (
                      <div className="input-group" key={i}>
                        <label htmlFor={name}>K{["P", "I", "D"][i]}</label>
                        <input
                          type="number"
                          name={name}
                          value={pidValues[name]}
                          onChange={handleInputChange}
                          step="0.1"
                          min="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="raw2">
                <div className="pitch-inputs">
                  <h4>Roll Set Point</h4>
                  <div className="input-row">
                    <div className="input-group">
                      <label htmlFor="roll">Roll (rad)</label>
                      <input
                        type="number"
                        name="roll"
                        value={angleValues.roll}
                        onChange={handleAngleChange}
                        className="custom-input"
                        step="0.01"
                        min="-0.6"
                        max="0.6"
                      />
                    </div>
                  </div>
                </div>
                <div className="pid-inputs">
                  <h4>Roll Position</h4>
                  <div className="input-row">
                    {["p3", "i3", "d3"].map((name, i) => (
                      <div className="input-group" key={i}>
                        <label htmlFor={name}>K{["P", "I", "D"][i]}</label>
                        <input
                          type="number"
                          name={name}
                          value={pidValues[name]}
                          onChange={handleInputChange}
                          step="0.1"
                          min="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pid-inputs">
                  <h4>Roll Velocity</h4>
                  <div className="input-row">
                    {["p4", "i4", "d4"].map((name, i) => (
                      <div className="input-group" key={i}>
                        <label htmlFor={name}>K{["P", "I", "D"][i]}</label>
                        <input
                          type="number"
                          name={name}
                          value={pidValues[name]}
                          onChange={handleInputChange}
                          step="0.1"
                          min="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <Modal />
            <div className="btn3">
              <button
                onClick={sendCommand}
                className="toggle-button1"
                disabled={isButtonsDisabled}
                style={{
                  opacity: isButtonsDisabled ? 0.5 : 1,
                  cursor: isButtonsDisabled ? "not-allowed" : "pointer",
                }}
              >
                Start with default parameters
              </button>
              <button
                onClick={sendCommand2}
                className="toggle-button2"
                disabled={isButtonsDisabled}
                style={{
                  opacity: isButtonsDisabled ? 0.5 : 1,
                  cursor: isButtonsDisabled ? "not-allowed" : "pointer",
                }}
              >
                Tune & Start
              </button>
              <button
                onClick={() => {
                  navigate("/Progresspage");
                  window.scrollTo(0, 0);
                }}
                className="toggle-button1"
              >
                Track your Progress
              </button>
            </div>
            <div className="message-box">
              <h2>Received Data:</h2>
              {message ? (
                <div>
                  <p>ID: {message.ID ?? "N/A"}</p>
                  <p>Roll: {message.xpos ?? "N/A"}</p>
                  <p>Pitch: {message.ypos ?? "N/A"}</p>
                  <p>xvel: {message.xvel ?? "N/A"}</p>
                  <p>yvel: {message.yvel ?? "N/A"}</p>
                </div>
              ) : (
                <p>No messages received yet.</p>
              )}
            </div>
            <h2>Real-Time Data Charts</h2>
            <div className="chart-container">
              <div className="chart">
                <h3>Roll</h3>
                <Line data={chartData("Roll", xposData, "rgb(75, 192, 192)")} options={options} />
              </div>
              <div className="chart">
                <h3>Pitch</h3>
                <Line data={chartData("Pitch", yposData, "rgb(153, 102, 255)")} options={options} />
              </div>
            </div>
            <div className="chart-container">
              <div className="chart">
                <h3>Roll Velocity</h3>
                <Line data={chartData("Roll Velocity", xvelData, "rgb(255, 159, 64)")} options={options} />
              </div>
              <div className="chart">
                <h3>Pitch Velocity</h3>
                <Line data={chartData("Pitch Velocity", yvelData, "rgb(255, 99, 132)")} options={options} />
              </div>
            </div>
            {/* <div className="video-stream-instance1">
              <URDFViewer
                urdfUrl={urdfUrl1}
                width={viewerWidth}
                height="625"
                joint1={JointAngle1}
                joint2={JointAngle2}
              />
            </div> */}
            <div className="video-container">
              <LiveVideoPlayer />
              {/* <button onClick={handleClick} className="toggle-button1">
                {showLive ? "Start Live" : "End Live"}
              </button> */}
            </div>
          </div>
          {/* <ToastContainer position="bottom-right" /> */}
        </div>
      ) : (
        <Loading position={position} />
      )}
    </div>
  );
}

export default App;