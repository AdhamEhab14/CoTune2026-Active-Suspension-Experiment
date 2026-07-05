import { useState, useEffect,useRef } from "react";
import React from 'react';
import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";
import { fetchAuthSession } from "@aws-amplify/auth";
import { Buffer } from "buffer";
import "./inv.css";
import { PubSub } from "@aws-amplify/pubsub";
import { IoTClient, AttachPolicyCommand } from "@aws-sdk/client-iot";
import Queue2 from "./Queue2";
import { Helmet } from "react-helmet-async";
import Loading from "../components/loading";
import { useLocation, useNavigate } from "react-router-dom";

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
  ScanCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
// import LiveVideoPlayer1 from "./Videoyoutube";
// import LiveVideoPlayer from "./Videoinv" //Correct Twitch for Inverted Pendulum
import LiveVideoPlayer from "./Video";

import { lqrJS } from "../controllers/LQR/lqr_calc";
import Modal from "../components/Modal2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [x, setXposData] = useState([]);
  const [isButtonsDisabled, setIsButtonsDisabled] = useState(false);
  const [xdot, setYposData] = useState([]);
  const [phi, setXvelData] = useState([]);
  const [phidot, setYvelData] = useState([]);
  const [timestamps, setTimestamps] = useState([]);
  const [isThree, setIsThree] = useState(true);

  const [message, setMessage] = useState(null);
  const [QValues, setQValues] = useState({
    Q00: 0, Q01: 0, Q02: 0, Q03: 0,
    Q10: 0, Q11: 0, Q12: 0, Q13: 0,
    Q20: 0, Q21: 0, Q22: 0, Q23: 0,
    Q30: 0, Q31: 0, Q32: 0, Q33: 0,
  });
  const [RValue, setRValue] = useState(0);

  const [credentials, setCredentials] = useState(null);
  const [iotClient, setIoTClient] = useState(null);
  const REGION = "eu-west-3";
  const TABLE_NAME = "QueueTable2";
  const LQR_TABLE_NAME = "LQRparameters";

  const { isAllowed, identityId, position, timeRemaining, isLoading } = Queue2();


const wasActive = useRef(false);

  useEffect(() => {
    // If time was ever > 0, remember it
    if (timeRemaining > 0) {
      wasActive.current = true;
    }

    // Only redirect when time hits 0 and it was > 0 before
    if (timeRemaining < 90 && wasActive.current) {

      window.location.href = "/InvProgresspage";
    }
  }, [timeRemaining]);



  const A = [
    [0, 1, 0, 0],
    [0, -1.96465757924125, -0.913494826736738, 0.00856855198611895],
    [0, 0, 0, 1],
    [0, 6.40649210622148, 34.9679179132720, -0.327997941221576]
  ];
  const B = [
    [0],
    [0.656922318935786],
    [0],
    [-2.14213799652974]
  ];

  useEffect(() => {
    const initializeIoTClient = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        const fetchedCredentials = session.credentials;
        const policyClient = new IoTClient({
          region: REGION,
          credentials: fetchedCredentials,
        });
        const policyInput = {
          policyName: "IoTPolicy",
          target: session.identityId,
        };
        const policyCommand = new AttachPolicyCommand(policyInput);
        await policyClient.send(policyCommand);
        setCredentials(fetchedCredentials);
        setIoTClient(
          new IoTDataPlaneClient({
            region: REGION,
            credentials: fetchedCredentials,
          })
        );
      } catch (err) {
        console.error("Error initializing IoT client:", err);
      }
    };
    initializeIoTClient();
  }, []);

  useEffect(() => {
    if (credentials) {
      handlePublish6();
    }
  }, [credentials]);

  useEffect(() => {
    if (message !== null) {
      setTimestamps((prevTimestamps) => [
        ...prevTimestamps,
        (prevTimestamps.length * 0.2).toFixed(1),
      ]);
    }
  }, [message]);

  const resetData = () => {
    setTimestamps([]);
    setMessage(null);
    setXposData([]);
    setYposData([]);
    setXvelData([]);
    setYvelData([]);
  };

  useEffect(() => {
    if (!credentials) return;
    const pubsub = new PubSub({
      region: REGION,
      credentials: credentials,
      endpoint: "wss://a3c1jrwyyxkjx6-ats.iot.eu-west-3.amazonaws.com/mqtt",
    });
    const subscription = pubsub.subscribe({ topics: "INV/Data" }).subscribe({
      next: (data) => {
        console.log("Message received:", data);
        setMessage(data);
        setXposData((prevData) => [...prevData, data.x]);
        setYposData((prevData) => [...prevData, data.xdot]);
        setXvelData((prevData) => [...prevData, data.phi]);
        setYvelData((prevData) => [...prevData, data.phidot]);
      },
      error: (error) => console.error("Subscription error:", error),
      complete: () => console.log("Subscription complete"),
    });
    return () => subscription.unsubscribe();
  }, [credentials]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "R") {
      if (value === "") {
        setRValue("");
      } else {
        setRValue(parseFloat(value) || 0);
      }
    } else {
      setQValues((prevValues) => ({
        ...prevValues,
        [name]: value === "" ? "" : parseFloat(value) || 0,
      }));
    }
  };

  const computeKValues = () => {
    const Q = [
      [QValues.Q00, QValues.Q01, QValues.Q02, QValues.Q03],
      [QValues.Q10, QValues.Q11, QValues.Q12, QValues.Q13],
      [QValues.Q20, QValues.Q21, QValues.Q22, QValues.Q23],
      [QValues.Q30, QValues.Q31, QValues.Q32, QValues.Q33],
    ];
    const R = [[RValue]];
    try {
      const K = lqrJS(A, B, Q, R);
      return K[0]; // K is 1x4, return [K0, K1, K2, K3]
    } catch (error) {
      console.error("LQR computation error:", error);
      return [0, 0, 0, 0]; // Fallback
    }
  };

  const formatTime = (seconds) => {
    seconds = Math.max(seconds-90, 0); // Ensure seconds is not negative
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${Math.max(minutes)}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  const saveDefaultLQRParameters = async (K, timestamp) => {
    if (!credentials) {
      console.error("Credentials not initialized.");
      return;
    }
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const params = {
        TableName: LQR_TABLE_NAME,
        Item: {
          identityId: { S: identityId },
          timestamp: { N: timestamp },
          Q00: { N: "1000.0" },
          Q01: { N: "0.0" },
          Q02: { N: "0.0" },
          Q03: { N: "0.0" },
          Q10: { N: "0.0" },
          Q11: { N: "100.0" },
          Q12: { N: "0.0" },
          Q13: { N: "0.0" },
          Q20: { N: "0.0" },
          Q21: { N: "0.0" },
          Q22: { N: "500.0" },
          Q23: { N: "0.0" },
          Q30: { N: "0.0" },
          Q31: { N: "0.0" },
          Q32: { N: "0.0" },
          Q33: { N: "500.0" },
          R: { N: "0.2" },
          K0: { N: K[0].toString() },
          K1: { N: K[1].toString() },
          K2: { N: K[2].toString() },
          K3: { N: K[3].toString() },
        },
      };
      await dbClient.send(new PutItemCommand(params));
      console.log(`Saved default LQR parameters for timestamp ${timestamp}`);
    } catch (error) {
      console.error("Error saving default LQR parameters:", error);
    }
  };

  const saveLQRParameters = async (K, timestamp) => {
    if (!credentials) {
      console.error("Credentials not initialized.");
      return;
    }
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const params = {
        TableName: LQR_TABLE_NAME,
        Item: {
          identityId: { S: identityId },
          timestamp: { N: timestamp },
          Q00: { N: QValues.Q00.toString() },
          Q01: { N: QValues.Q01.toString() },
          Q02: { N: QValues.Q02.toString() },
          Q03: { N: QValues.Q03.toString() },
          Q10: { N: QValues.Q10.toString() },
          Q11: { N: QValues.Q11.toString() },
          Q12: { N: QValues.Q12.toString() },
          Q13: { N: QValues.Q13.toString() },
          Q20: { N: QValues.Q20.toString() },
          Q21: { N: QValues.Q21.toString() },
          Q22: { N: QValues.Q22.toString() },
          Q23: { N: QValues.Q23.toString() },
          Q30: { N: QValues.Q30.toString() },
          Q31: { N: QValues.Q31.toString() },
          Q32: { N: QValues.Q32.toString() },
          Q33: { N: QValues.Q33.toString() },
          R: { N: RValue.toString() },
          K0: { N: K[0].toString() },
          K1: { N: K[1].toString() },
          K2: { N: K[2].toString() },
          K3: { N: K[3].toString() },
        },
      };
      await dbClient.send(new PutItemCommand(params));
      console.log(`Saved LQR parameters for timestamp ${timestamp}`);
    } catch (error) {
      console.error("Error saving LQR parameters:", error);
    }
  };

  const handlePublish = async () => {
    if (!iotClient) {
      console.error("IoT client not initialized.");
      return;
    }
    try {
      const K = [-70.7106781186549, -73.3420521864726, -324.339657623334, -74.5667547587896];
      const timestamp = Date.now().toString();
      const payload = {
        id: identityId,
        timestamp,
        message: K,
        work: 1,
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "INV/Parameters",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Command sent successfully:", payload);
      await saveDefaultLQRParameters(K, timestamp);
    } catch (err) {
      console.error("Error sending command:", err);
    }
  };

  const handlePublish2 = async () => {
    if (!iotClient) {
      console.error("IoT client not initialized.");
      return;
    }
    try {
      const payload = {
        message: [0, 0, 0, 0],
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "INV/Parameters",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Command sent successfully:", payload);
    } catch (err) {
      console.error("Error sending command:", err);
    }
  };

  const handlePublish3 = async () => {
    if (!iotClient) {
      console.error("IoT client not initialized.");
      return;
    }
    try {
      const payload = {
        state: {
          desired: {
            stream2: "on",
          },
        },
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "$aws/things/RaspberryPiStreamer/shadow/name/Stream2Shadow/update",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Command sent successfully:", payload);
    } catch (err) {
      console.error("Error sending command:", err);
    }
  };

  const handlePublish4 = async () => {
    if (!iotClient) {
      console.error("IoT client not initialized.");
      return;
    }
    try {
      const K = computeKValues();
      const timestamp = Date.now().toString();
      const payload = {
        id: identityId,
        timestamp,
        message: K.map((val) => parseFloat(val)),
        work: 1,
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "INV/Parameters",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Command sent successfully:", payload);
      await saveLQRParameters(K, timestamp);
    } catch (err) {
      console.error("Error sending command:", err);
    }
  };

  const handlePublish5 = async () => {
    if (!iotClient) {
      console.error("IoT client not initialized.");
      return;
    }
    try {
      const payload = {
        state: {
          desired: {
            stream2: "off",
          },
        },
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "$aws/things/RaspberryPiStreamer/shadow/name/Stream2Shadow/update",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Command sent successfully:", payload);
    } catch (err) {
      console.error("Error sending command:", err);
    }
  };

  const handlePublish6 = async () => {
    if (!iotClient) {
      console.error("IoT client not initialized.");
      return;
    }
    try {
      const payload = {
        status: "ON",
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "Esp32_RpiWakeup/sub",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
    } catch (err) {
      console.error("Error sending command:", err);
    }
  };

  const handlePublish7 = async () => {
    if (!iotClient) {
      console.error("IoT client not initialized.");
      return;
    }
    try {
      const payload = {
        state: {
          desired: {
            raspberry: "off",
          },
        },
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const publishParams = {
        topic: "$aws/things/RaspberryPiStreamer/shadow/name/StreamShadow/update",
        qos: 0,
        payload: encodedPayload,
      };
      const publishCommand = new PublishCommand(publishParams);
      await iotClient.send(publishCommand);
      console.log("Command sent successfully:", payload);
    } catch (err) {
      console.error("Error sending command:", err);
    }
  };

  const navigatee = useNavigate();
  
  const handleNavigation = () => {
    navigatee('/InvProgresspage');
    window.scrollTo(0, 0);
  };


    const setlqrval = async () => {
    setQValues({
    Q00: 1000, Q01: 0, Q02: 0, Q03: 0,
    Q10: 0, Q11: 100, Q12: 0, Q13: 0,
    Q20: 0, Q21: 0, Q22: 2000, Q23: 0,
    Q30: 0, Q31: 0, Q32: 0, Q33: 500,
    });
    setRValue(0.2);
  };
  const sendCommand = () => {
    resetData();
    handlePublish();
  };

  const sendCommand2 = () => {
    handlePublish2();
  };

  const sendCommand3 = () => {
    handlePublish3();
  };

  const sendCommand4 = () => {
    setIsButtonsDisabled(true);
    resetData();
    handlePublish4();
    setTimeout(() => setIsButtonsDisabled(false), 90000);

  };

  const sendCommand5 = () => {
    handlePublish5();
  };

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

  const options = {
    animation: false,
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      tooltip: {
        callbacks: {
          label: (tooltipItem) => `Value: ${tooltipItem.raw}`,
        },
      },
    },
  };

  // const isButtonDisabled = isAllowed && timeRemaining <= 150;

  return (
    <div className="containerQ">
      {isLoading ? (
        <div className="lood">
         <h1> Loading queue status...</h1>
         </div>
      ) : position === 1 ? (
        <div className="containerI">
          <Helmet>
            <title>Inverted Pendulum</title>
          </Helmet>
          <h1>Inverted Pendulum</h1>
          <Modal></Modal>
          
          {/* Time remaining display */}
          <div className="time-remaining">
              <h3>Time Remaining: {formatTime(timeRemaining)}</h3>
          </div>

          <div className="K-inputs">
            <h2>LQR Parameters</h2>
        <div className="raw16">
{/* ///////////////////////////////////////////////// */}
      <div className="q-matrix-container">
        <h3>Q Matrix (4x4)</h3>
        <div className="q-matrix-grid">
          {/* Top-left empty cell */}
          <div className="matrix-label" />

          {/* Column headers */}
          {['x', 'ẋ', 'ϕ', 'ϕ̇'].map((label, index) => (
            <div className="matrix-label" key={`col-label-${index}`}>
              {label}
            </div>
          ))}

          {/* Matrix rows with row headers and inputs */}
          {[...Array(4)].map((_, row) => (
            <React.Fragment key={`row-${row}`}>
              <div className="matrix-label">{['x', 'ẋ', 'ϕ', 'ϕ̇'][row]}</div>
              {[...Array(4)].map((_, col) => (
                <div className="input-group" key={`Q${row}${col}`}>
                  <label htmlFor={`Q${row}${col}`} className="visually-hidden">
                    {`Q${row}${col}`}
                  </label>
                  <input
                    type="number"
                    name={`Q${row}${col}`}
                    value={QValues[`Q${row}${col}`] === "" ? "" : QValues[`Q${row}${col}`]}
                    onChange={handleInputChange}
                    placeholder={`Q${row}${col}`}
                    step="0.01"
                    onFocus={e => {
                      if (QValues[`Q${row}${col}`] === 0) {
                        setQValues(prev => ({
                          ...prev,
                          [`Q${row}${col}`]: ""
                        }));
                      }
                    }}
                  />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
        </div>
{/* /////////////////////////////////////////// */}


            <div className="r-matrix-container">
                          <h3>R Value (1x1)</h3>

              <div className="input-group">
                {/* <label htmlFor="R">R</label> */}
                <input
                  type="number"
                  name="R"
                  value={RValue === "" ? "" : RValue}
                  onChange={handleInputChange}
                  placeholder="R"
                  step="0.01"
                  onFocus={e => {
                    if (RValue === 0) {
                      setRValue("");
                    }
                  }}
                />
              </div>
            </div>
          </div>
          </div>

          <button
            onClick={sendCommand4}
            className={`toggle-button1 ${isButtonsDisabled ? 'disabled-button' : ''}`}
            disabled={isButtonsDisabled}
          >
            Tune & Start
          </button>
                    <button
            onClick={setlqrval}
            className={`toggle-button1 ${isButtonsDisabled ? 'disabled-button' : ''}`}
            disabled={isButtonsDisabled}
          >
            Use our LQR Values
          </button>
          <button onClick={handleNavigation} className="toggle-button1">
            Track your Progress
          </button>

          <div className="message-box">
            <h2>Received Data:</h2>
            {message ? (
              <div>
                <p>Cart Position: {message.x != null ? message.x : "N/A"}</p>
                <p>Cart Velocity: {message.xdot != null ? message.xdot : "N/A"}</p>
                <p>Angle: {message.phi != null ? message.phi : "N/A"}</p>
                <p>Angular Velocity: {message.phidot != null ? message.phidot : "N/A"}</p>
                <p>ID: {message.ID != null ? message.ID : "N/A"}</p>
              </div>
            ) : (
              <p>No messages received yet.</p>
            )}
          </div>
          <h2>Real-Time Data Charts</h2>
          <div className="chart-container">
            <div className="chart">
              <h3>Cart Position</h3>
              <Line
                data={chartData("Cart Position (m)", x, "rgb(75, 192, 192)")}
                options={options}
              />
            </div>
            <div className="chart">
              <h3>Cart Velocity</h3>
              <Line
                data={chartData("Cart Velocity (m/s)", xdot, "rgb(153, 102, 255)")}
                options={options}
              />
            </div>
          </div>
          <div className="chart-container">
            <div className="chart">
              <h3>Angle</h3>
              <Line
                data={chartData("Angle (rad)", phi, "rgb(255, 159, 64)")}
                options={options}
              />
            </div>
            <div className="chart">
              <h3>Angular Velocity</h3>
              <Line
                data={chartData("Angular Velocity (rad/s)", phidot, "rgb(255, 99, 132)")}
                options={options}
              />
            </div>
          </div>
          <div className="App">
            <LiveVideoPlayer />
            {/* <button onClick={() => setIsThree(!isThree)} className="toggle-button1">
              {isThree ? "Start Live" : "End Live"}
            </button> */}
          </div>
        </div>
      ) : position > 1 ? (
        <div>
          <Loading position={position} />
        </div>
      ) : position === 0 && (
        navigatee('/InvProgresspage')
      )}
    </div>
  );
}

export default App;