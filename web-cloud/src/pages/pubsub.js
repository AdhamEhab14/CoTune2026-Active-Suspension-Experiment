import { useState, useEffect } from "react";
import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";
import { fetchAuthSession } from "@aws-amplify/auth";
import { Buffer } from "buffer";
import "./pubsub.css";
import { PubSub } from "@aws-amplify/pubsub";
import { IoTClient, AttachPolicyCommand } from "@aws-sdk/client-iot";
import { URDFViewer } from "../experiments/quadrotor/URDFViewer";
import useQueueStatus from "./Queue1";
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
// import LiveVideoPlayer2 from "./Videoyoutube2"; //youtube 
import LiveVideoPlayer from "./Video"; //twitch

import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import "../styles/custom-toast.css";

function App() {
  const navigate = useNavigate();
  // Fix destructuring to include isLoading
  const { isAllowed, identityId, position, timeRemaining, isLoading } = useQueueStatus();
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
  const [activeBlock, setActiveBlock] = useState(null);



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
  const handlePidChange = (e) => {
    const { name, value } = e.target;
    let parsedValue = value === '' ? '' : parseFloat(value) || 0;
    // Clamp values as before
    if (name === 'p1' || name === 'p3') {
      if (parsedValue !== '') parsedValue = Math.min(Math.max(parsedValue, 0), 20);
    } else if (name === 'p2' || name === 'p4') {
      if (parsedValue !== '') parsedValue = Math.min(Math.max(parsedValue, 0), 25);
    } else if (name === 'i1' || name === 'i3' || name === 'i2' || name === 'i4') {
      if (parsedValue !== '') parsedValue = Math.min(Math.max(parsedValue, 0), 15);
    } else if (name === 'd1' || name === 'd3' || name === 'd2' || name === 'd4') {
      if (parsedValue !== '') parsedValue = Math.min(Math.max(parsedValue, 0), 5);
    }
    setPidValues({ ...pidValues, [name]: parsedValue });
  };

  const handleSetpointChange = (e) => {
    const { name, value } = e.target;
    let parsedValue = value === '' ? '' : parseFloat(value) || 0;
    if (parsedValue !== '') parsedValue = Math.min(Math.max(parsedValue, -0.2), 0.2);
    setAngleValues({
      ...angleValues,
      [name]: parsedValue
    });
  };

  const handleBlockClick = (blockName, e) => {
    e.stopPropagation();
    setActiveBlock(blockName === activeBlock ? null : blockName);
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
      // console.log("Published:", payload);
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
    setPidValues({p1: 9.0, i1: 0.0, d1: 0.5,
                  p2: 16.0, i2: 5.0, d2: 0.0,
                  p3: 9.0, i3: 0.0, d3: 0.5,
                  p4: 11.0, i4: 5.0, d4: 0.0,
    });
  };

  const sendCommand2 = async () => {
    setIsButtonsDisabled(true);
    resetData();
    // Replace any empty string in pidValues and angleValues with "0" before parsing
    const sanitizedPidValues = Object.fromEntries(
      Object.entries(pidValues).map(([k, v]) => [k, v === "" ? "0" : v])
    );
    const sanitizedAngleValues = Object.fromEntries(
      Object.entries(angleValues).map(([k, v]) => [k, v === "" ? "0" : v])
    );
    const payload = {
      xposkp: parseFloat(sanitizedPidValues.p1), xposki: parseFloat(sanitizedPidValues.i1), xposkd: parseFloat(sanitizedPidValues.d1),
      xvelkp: parseFloat(sanitizedPidValues.p2), xvelki: parseFloat(sanitizedPidValues.i2), xvelkd: parseFloat(sanitizedPidValues.d2),
      yposkp: parseFloat(sanitizedPidValues.p3), yposki: parseFloat(sanitizedPidValues.i3), yposkd: parseFloat(sanitizedPidValues.d3),
      yvelkp: parseFloat(sanitizedPidValues.p4), yvelki: parseFloat(sanitizedPidValues.i4), yvelkd: parseFloat(sanitizedPidValues.d4),
      yposSet: parseFloat(sanitizedAngleValues.roll), xposSet: parseFloat(sanitizedAngleValues.pitch),
    };
    await handlePublish(payload);
    await handlePublish2(payload);
    setTimeout(() => setIsButtonsDisabled(false), 20000);
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

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

    // Add this effect to handle clicks outside blocks
    useEffect(() => {
      const handleClickOutside = () => {
        setActiveBlock(null);
      };
  
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }, []);

  return (
    <div className="containerQ outer">
      {isLoading ? (
        <div className="lood">
         <h1> Loading queue status...</h1>
        </div>
      ) : position === 1 ? (
        <div className="containerQ">
          <Helmet>
            <title>Quadrotor</title>
          </Helmet>
          <div className="container2">
            <h1 className="friendly-heading">Quadrotor</h1>
            <div className="timer-container" style={{
              textAlign: 'center',
              margin: '10px 0',
              padding: '10px',
              backgroundColor: '#f0f0f0',
              borderRadius: '5px'
            }}>
              <h3>Time Remaining: {formatTime(timeRemaining)}</h3>
            </div>
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
              <div className={`block setpoint-block ${activeBlock === 'pitch-setpoint' ? 'active' : ''}`}
                  onClick={(e) => handleBlockClick('pitch-setpoint', e)}>
                <div className="block-content">
                  <span className="block-name">Pitch Setpoint</span>
                  <br />
                  <span className="block-value">Value: {angleValues.pitch || 0} rad</span>
                </div>
                <div className="input-container setpoint" onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                }}>
                  <div className="input-field">
                    <label>Setpoint:</label>
                    <input
                      type="number"
                      value={angleValues.pitch === "" ? "" : angleValues.pitch}
                      onChange={e => handleSetpointChange({ target: { name: 'pitch', value: e.target.value } })}
                      step="0.01"
                      min="-0.2"
                      max="0.2"
                      placeholder = "0"
                      onFocus={e => {
                        if (angleValues.pitch === 0) {
                          setAngleValues(prev => ({ ...prev, pitch: "" }));
                        }
                      }}
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
              
              <div className={`block pid-block ${activeBlock === 'pitch-pid' ? 'active' : ''}`}
                  onClick={(e) => handleBlockClick('pitch-pid', e)}>
                <div className="block-content">
                  <span className="block-name">Pitch Position PID</span>
                  <br />
                  <span className="block-value">
                    P: {pidValues.p1 || 0} , I: {pidValues.i1 || 0} , D: {pidValues.d1 || 0}
                  </span>
                </div>
                <div className="input-container" onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                }}>
                  <div className="input-field">
                    <label>P:</label>
                    <input
                      type="number"
                      value={pidValues.p1 === "" ? "" : pidValues.p1}
                      onChange={e => handlePidChange({ target: { name: 'p1', value: e.target.value } })}
                      step="0.5"
                      min="0"
                      max="20"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.p1 === 0) {
                          setPidValues(prev => ({ ...prev, p1: "" }));
                        }
                      }}
                    />
                  </div>
                  <div className="input-field">
                    <label>I:</label>
                    <input
                      type="number"
                      value={pidValues.i1 === "" ? "" : pidValues.i1}
                      onChange={e => handlePidChange({ target: { name: 'i1', value: e.target.value } })}
                      step="0.5"
                      min="0"
                      max="15"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.i1 === 0) {
                          setPidValues(prev => ({ ...prev, i1: "" }));
                        }
                      }}
                    />
                  </div>
                  <div className="input-field">
                    <label>D:</label>
                    <input
                      type="number"
                      value={pidValues.d1 === "" ? "" : pidValues.d1}
                      onChange={e => handlePidChange({ target: { name: 'd1', value: e.target.value } })}
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.d1 === 0) {
                          setPidValues(prev => ({ ...prev, d1: "" }));
                        }
                      }}
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
              
              <div className={`block pid-block ${activeBlock === 'pitch-velocity-pid' ? 'active' : ''}`}
                  onClick={(e) => handleBlockClick('pitch-velocity-pid', e)}>
                <div className="block-content">
                  <span className="block-name">Pitch Velocity PID</span>
                  <br />
                  <span className="block-value">
                    P: {pidValues.p2 || 0} , I: {pidValues.i2 || 0} , D: {pidValues.d2 || 0}
                  </span>
                </div>
                <div className="input-container" onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                }}>
                  <div className="input-field">
                    <label>P:</label>
                    <input
                      type="number"
                      value={pidValues.p2 === "" ? "" : pidValues.p2}
                      onChange={e => handlePidChange({ target: { name: 'p2', value: e.target.value } })}
                      step="0.5"
                      min="0"
                      max="25"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.p2 === 0) {
                          setPidValues(prev => ({ ...prev, p2: "" }));
                        }
                      }}
                    />
                  </div>
                  <div className="input-field">
                    <label>I:</label>
                    <input
                      type="number"
                      value={pidValues.i2 === "" ? "" : pidValues.i2}
                      onChange={e => handlePidChange({ target: { name: 'i2', value: e.target.value } })}
                      step="0.5"
                      min="0"
                      max="15"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.i2 === 0) {
                          setPidValues(prev => ({ ...prev, i2: "" }));
                        }
                      }}
                    />
                  </div>
                  <div className="input-field">
                    <label>D:</label>
                    <input
                      type="number"
                      value={pidValues.d2 === "" ? "" : pidValues.d2}
                      onChange={e => handlePidChange({ target: { name: 'd2', value: e.target.value } })}
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.d2 === 0) {
                          setPidValues(prev => ({ ...prev, d2: "" }));
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="connector"></div>

            </div>

            {/* Roll Control Row */}
            <div className="control-row">
              <div className={`block setpoint-block ${activeBlock === 'roll-setpoint' ? 'active' : ''}`}
                  onClick={(e) => handleBlockClick('roll-setpoint', e)}>
                <div className="block-content">
                  <span className="block-name">Roll Setpoint</span>
                  <br />
                  <span className="block-value">Value: {angleValues.roll || 0} rad</span>
                </div>
                <div className="input-container setpoint" onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                }}>
                  <div className="input-field">
                    <label>Setpoint:</label>
                    <input
                      type="number"
                      value={angleValues.roll === "" ? "" : angleValues.roll}
                      onChange={e => handleSetpointChange({ target: { name: 'roll', value: e.target.value } })}
                      step="0.01"
                      min="-0.2"
                      max="0.2"
                      placeholder = "0"
                      onFocus={e => {
                        if (angleValues.roll === 0) {
                          setAngleValues(prev => ({ ...prev, roll: "" }));
                        }
                      }}
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
              
              <div className={`block pid-block ${activeBlock === 'roll-pid' ? 'active' : ''}`}
                  onClick={(e) => handleBlockClick('roll-pid', e)}>
                <div className="block-content">
                  <span className="block-name">Roll Position PID</span>
                  <br />
                  <span className="block-value">
                    P: {pidValues.p3 || 0} , I: {pidValues.i3 || 0} , D: {pidValues.d3 || 0}
                  </span>
                </div>
                <div className="input-container" onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                }}>
                  <div className="input-field">
                    <label>P:</label>
                    <input
                      type="number"
                      value={pidValues.p3 === "" ? "" : pidValues.p3}
                      onChange={e => handlePidChange({ target: { name: 'p3', value: e.target.value } })}
                      step="0.5"
                      min="0"
                      max="20"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.p3 === 0) {
                          setPidValues(prev => ({ ...prev, p3: "" }));
                        }
                      }}
                    />
                  </div>
                  <div className="input-field">
                    <label>I:</label>
                    <input
                      type="number"
                      value={pidValues.i3 === "" ? "" : pidValues.i3}
                      onChange={e => handlePidChange({ target: { name: 'i3', value: e.target.value } })}
                      step="0.5"
                      min="0"
                      max="15"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.i3 === 0) {
                          setPidValues(prev => ({ ...prev, i3: "" }));
                        }
                      }}
                    />
                  </div>
                  <div className="input-field">
                    <label>D:</label>
                    <input
                      type="number"
                      value={pidValues.d3 === "" ? "" : pidValues.d3}
                      onChange={e => handlePidChange({ target: { name: 'd3', value: e.target.value } })}
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.d3 === 0) {
                          setPidValues(prev => ({ ...prev, d3: "" }));
                        }
                      }}
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
              
              <div className={`block pid-block ${activeBlock === 'roll-velocity-pid' ? 'active' : ''}`}
                  onClick={(e) => handleBlockClick('roll-velocity-pid', e)}>
                <div className="block-content">
                  <span className="block-name">Roll Velocity PID</span>
                  <br />
                  <span className="block-value">
                    P: {pidValues.p4 || 0} , I: {pidValues.i4 || 0} , D: {pidValues.d4 || 0}
                  </span>
                </div>
                <div className="input-container" onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                }}>
                  <div className="input-field">
                    <label>P:</label>
                    <input
                      type="number"
                      value={pidValues.p4 === "" ? "" : pidValues.p4}
                      onChange={e => handlePidChange({ target: { name: 'p4', value: e.target.value } })}
                      step="0.5"
                      min="0"
                      max="25"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.p4 === 0) {
                          setPidValues(prev => ({ ...prev, p4: "" }));
                        }
                      }}
                    />
                  </div>
                  <div className="input-field">
                    <label>I:</label>
                    <input
                      type="number"
                      value={pidValues.i4 === "" ? "" : pidValues.i4}
                      onChange={e => handlePidChange({ target: { name: 'i4', value: e.target.value } })}
                      step="0.5"
                      min="0"
                      max="15"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.i4 === 0) {
                          setPidValues(prev => ({ ...prev, i4: "" }));
                        }
                      }}
                    />
                  </div>
                  <div className="input-field">
                    <label>D:</label>
                    <input
                      type="number"
                      value={pidValues.d4 === "" ? "" : pidValues.d4}
                      onChange={e => handlePidChange({ target: { name: 'd4', value: e.target.value } })}
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder = "0"
                      onFocus={e => {
                        if (pidValues.d4 === 0) {
                          setPidValues(prev => ({ ...prev, d4: "" }));
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="connector"></div>


            </div>
          </div>

          <div className="plant-block">
            Quadrotor Plant
          </div>
        </div>
      </div> 
            <Modal />
            <div className="btn3">
              
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
                onClick={sendCommand}
                className="toggle-button1"
                disabled={isButtonsDisabled}
                style={{
                  opacity: isButtonsDisabled ? 0.5 : 1,
                  cursor: isButtonsDisabled ? "not-allowed" : "pointer",
                }}
              >
                Use our PID Values
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
                  <p>Roll: {message.ypos ?? "N/A"}</p>
                  <p>Pitch: {message.xpos ?? "N/A"}</p>
                  <p>Pitch Velocity: {message.xvel ?? "N/A"}</p>
                  <p>Roll Velocity: {message.yvel ?? "N/A"}</p>
                </div>
              ) : (
                <p>No messages received yet.</p>
              )}
            </div>
            <h2>Real-Time Data Charts</h2>
            <div className="chart-container">
              <div className="chart">
                <h3>Roll</h3>
                <Line data={chartData("Roll", yposData, "rgb(75, 192, 192)")} options={options} />
              </div>
              <div className="chart">
                <h3>Pitch</h3>
                <Line data={chartData("Pitch", xposData, "rgb(153, 102, 255)")} options={options} />
              </div>
            </div>
            <div className="chart-container">
              <div className="chart">
                <h3>Roll Velocity</h3>
                <Line data={chartData("Roll Velocity", yvelData, "rgb(255, 159, 64)")} options={options} />
              </div>
              <div className="chart">
                <h3>Pitch Velocity</h3>
                <Line data={chartData("Pitch Velocity", xvelData, "rgb(255, 99, 132)")} options={options} />
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
        </div>
      ) : position > 1 ? (
        <div>
          <Loading position={position} />
        </div>
      ) : position === 0 && (
        navigate('/Progresspage')
      )}
    </div>
  );
}

export default App;