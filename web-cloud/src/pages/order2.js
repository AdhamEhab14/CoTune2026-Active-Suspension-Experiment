import "./order.css";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { fetchAuthSession } from "@aws-amplify/auth";
import {
  DynamoDBClient,
  ScanCommand,
  PutItemCommand,
  DeleteItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";
import { IoTClient, AttachPolicyCommand } from "@aws-sdk/client-iot";
import { Buffer } from "buffer";
import {jwtDecode} from "jwt-decode";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
// import LiveVideoPlayer from "./Videoinv" //correct for inverted pendulum twitch stream
// import LiveVideoPlayer1 from "./Videoyoutube";; //yOUTUBE
import LiveVideoPlayer from "./Video";

const REGION = "eu-west-3";
const QUEUE_TABLE = "QueueTable2";
const PROFILE_TABLE = "ProfileTable";

const QueueComponent = () => {
  const [credentials, setCredentials] = useState(null);
  const [identityId, setIdentityId] = useState("");
  const [userRole, setUserRole] = useState("student");
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [iotClient, setIoTClient] = useState(null);
  const isMounted = useRef(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeAWS = async () => {
      setLoading(true);
      try {
        const session = await fetchAuthSession({ forceRefresh: true });
        if (!session.credentials) {
          throw new Error("No credentials found in session");
        }
        setCredentials(session.credentials);
        setIdentityId(session.identityId);

        // Check Cognito groups
        let role = "student";
        const idToken = session.tokens?.idToken?.toString();
        if (idToken) {
          const decoded = jwtDecode(idToken);
          const groups = decoded["cognito:groups"] || [];
          if (groups.includes("Admin")) {
            role = "admin";
          }
        } else {
          console.warn("No ID token found for group decoding.");
        }

        if (role !== "admin") {
          throw new Error("Access denied: Admin privileges required");
        }

        setUserRole(role);

        // Attach IoT policy
        const policyClient = new IoTClient({
          region: REGION,
          credentials: session.credentials,
        });
        const policyInput = {
          policyName: "IoTPolicy",
          target: session.identityId,
        };
        await policyClient.send(new AttachPolicyCommand(policyInput));

        // Initialize IoT client
        setIoTClient(
          new IoTDataPlaneClient({
            region: REGION,
            credentials: session.credentials,
          })
        );
      } catch (err) {
        console.error("Error initializing AWS:", err);
        if (isMounted.current) {
          setError(err.message);
          setTimeout(() => navigate("/"), 3000);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    initializeAWS();
    const intervalId = setInterval(initializeAWS, 100000);

    return () => {
      clearInterval(intervalId);
      isMounted.current = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (credentials && identityId && userRole === "admin") {
      fetchUsers();
    }
  }, [credentials, identityId, userRole]);

  useEffect(() => {
    if (credentials && identityId && userRole === "admin") {
      const interval = setInterval(() => {
        fetchUsers();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [credentials, identityId, userRole]);

  const fetchUsers = async () => {
    if (!credentials || userRole !== "admin") return;
    setLoading(true);
    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      // Fetch queue data
      const scanResponse = await dbClient.send(
        new ScanCommand({ TableName: QUEUE_TABLE })
      );

      if (scanResponse.Items) {
        const queueItems = scanResponse.Items.map((item) => ({
          userId: item.userId?.S || "Unknown",
          timestamp: item.timestamp?.N || "0",
        }));

        // Fetch names from ProfileTable
        const usersWithNames = await Promise.all(
          queueItems.map(async (item) => {
            try {
              const profileResponse = await dbClient.send(
                new QueryCommand({
                  TableName: PROFILE_TABLE,
                  KeyConditionExpression: "IdentityID = :id",
                  ExpressionAttributeValues: {
                    ":id": { S: item.userId },
                  },
                })
              );

              const name =
                profileResponse.Items?.[0]?.name?.S || "Unknown User";
              return { ...item, name };
            } catch (error) {
              console.error(`Error fetching name for ${item.userId}:`, error);
              return { ...item, name: "Unknown User" };
            }
          })
        );

        // Sort by timestamp
        const sortedUsers = usersWithNames.sort(
          (a, b) => parseInt(a.timestamp) - parseInt(b.timestamp)
        );
        if (isMounted.current) {
          setUsers(sortedUsers);
        }
      } else {
        if (isMounted.current) {
          setUsers([]);
        }
      }
    } catch (error) {
      console.error("Error fetching queue:", error);
      if (isMounted.current) {
        setError("Failed to fetch queue: " + error.message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const reorderedUsers = [...users];
    const [movedItem] = reorderedUsers.splice(result.source.index, 1);
    reorderedUsers.splice(result.destination.index, 0, movedItem);

    setUsers(reorderedUsers);
  };

  const deleteUser = async (userId, timestamp) => {
    if (!credentials || userRole !== "admin") return;

    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      await dbClient.send(
        new DeleteItemCommand({
          TableName: QUEUE_TABLE,
          Key: {
            userId: { S: userId },
            timestamp: { N: timestamp },
          },
        })
      );

      // Update UI by removing the user
      if (isMounted.current) {
        setUsers((prev) =>
          prev.filter(
            (user) => user.userId !== userId || user.timestamp !== timestamp
          )
        );
        setSuccess(`Deleted user ${userId} from queue`);
        setTimeout(() => setSuccess(null), 3000);
      }
      console.log(`Deleted user ${userId} from queue`);
    } catch (error) {
      console.error(`Error deleting user ${userId}:`, error);
      if (isMounted.current) {
        setError("Failed to delete user: " + error.message);
      }
    }
  };

  const saveNewOrder = async () => {
    if (!credentials || users.length === 0 || userRole !== "admin") return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      // Step 1: Delete all existing items
      const scanCommand = new ScanCommand({ TableName: QUEUE_TABLE });
      const scanResponse = await dbClient.send(scanCommand);

      if (scanResponse.Items && scanResponse.Items.length > 0) {
        for (const item of scanResponse.Items) {
          const userIdAttr = item.userId;
          const timestampAttr = item.timestamp;

          if (userIdAttr && userIdAttr.S && timestampAttr && timestampAttr.N) {
            const deleteCommand = new DeleteItemCommand({
              TableName: QUEUE_TABLE,
              Key: {
                userId: { S: userIdAttr.S },
                timestamp: { N: timestampAttr.N },
              },
            });
            await dbClient.send(deleteCommand);
          }
        }
      }

      // Step 2: Insert users in new order
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (!user.userId) continue;

        const timestamp = Date.now() + i;

        const putCommand = new PutItemCommand({
          TableName: QUEUE_TABLE,
          Item: {
            userId: { S: user.userId },
            timestamp: { N: `${timestamp}` },
          },
        });

        await dbClient.send(putCommand);
      }

      if (isMounted.current) {
        setSuccess("Queue updated successfully!");
        setTimeout(() => setSuccess(null), 3000);
      }
      console.log("Queue updated successfully!");
    } catch (error) {
      console.error("Error updating QueueTable:", error);
      if (isMounted.current) {
        setError("Failed to update the queue: " + error.message);
      }
    } finally {
      if (isMounted.current) {
        setSaving(false);
      }
    }
  };

  // Control functions
  const handleRaspberryOn = async () => {
    if (!iotClient) {
      setError("IoT client not initialized");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = { status: "ON" };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const params = {
        topic: "Esp32_RpiWakeup/sub",
        qos: 0,
        payload: encodedPayload,
      };
      await iotClient.send(new PublishCommand(params));
      if (isMounted.current) {
        setSuccess("Raspberry Pi turned on");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Error turning Raspberry Pi on:", err);
      if (isMounted.current) {
        setError(`Failed to turn Raspberry Pi on: ${err.message}`);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleRaspberryOff = async () => {
    if (!iotClient) {
      setError("IoT client not initialized");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = { state: { desired: { raspberry: "off" } } };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const params = {
        topic: "$aws/things/RaspberryPiStreamer/shadow/name/StreamShadow/update",
        qos: 0,
        payload: encodedPayload,
      };
      await iotClient.send(new PublishCommand(params));
      if (isMounted.current) {
        setSuccess("Raspberry Pi turned off");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Error turning Raspberry Pi off:", err);
      if (isMounted.current) {
        setError(`Failed to turn Raspberry Pi off: ${err.message}`);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleStreamOn = async () => {
    if (!iotClient) {
      setError("IoT client not initialized");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = { state: { desired: { stream2: "on" } } };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const params = {
        topic: "$aws/things/RaspberryPiStreamer/shadow/name/Stream2Shadow/update",
        qos: 0,
        payload: encodedPayload,
      };
      await iotClient.send(new PublishCommand(params));
      if (isMounted.current) {
        setSuccess("Stream started");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Error starting stream:", err);
      if (isMounted.current) {
        setError(`Failed to start stream: ${err.message}`);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleStreamOff = async () => {
    if (!iotClient) {
      setError("IoT client not initialized");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = { state: { desired: { stream2: "off" } } };
      const encodedPayload = Buffer.from(JSON.stringify(payload));
      const params = {
        topic: "$aws/things/RaspberryPiStreamer/shadow/name/Stream2Shadow/update",
        qos: 0,
        payload: encodedPayload,
      };
      await iotClient.send(new PublishCommand(params));
      if (isMounted.current) {
        setSuccess("Stream stopped");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Error stopping stream:", err);
      if (isMounted.current) {
        setError(`Failed to stop stream: ${err.message}`);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  if (userRole !== "admin" && !loading) {
    return (
      <div className="pag">
        <h1>Access Denied</h1>
        <p>Redirecting to home...</p>
      </div>
    );
  }

  return (
    <div className="pag">
            <Helmet>
        <title>Pendulum Control</title>
      </Helmet>
      <h1>Inverted pendulum Control Page</h1>

      {/* {loading && (
        <p className="loading">
          <span className="spinner"></span> Loading...
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>} */}
      <div className="vid-container">
      <LiveVideoPlayer />


        <h2 className="heeeeeaaaaddd">Controls</h2>
        <div className="button-group">
          <button
            className="control-button"
            onClick={handleRaspberryOn}
            disabled={loading || saving}
          >
            Raspberry On
          </button>
          <button
            className="control-button"
            onClick={handleRaspberryOff}
            disabled={loading || saving}
          >
            Raspberry Off
          </button>
          <button
            className="control-button"
            onClick={handleStreamOn}
            disabled={loading || saving}
          >
            Start Stream
          </button>
          <button
            className="control-button"
            onClick={handleStreamOff}
            disabled={loading || saving}
          >
            Stop Stream
          </button>
        </div>

      </div>


   

      <div className="queue-container">
        <h2>Queue</h2>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="queueList">
              {(provided, snapshot) => (
                <div
                  className={`drag-area ${snapshot.isDraggingOver ? "dragging-over" : ""}`}
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  <ul className="queue-list">
                    {users.map((user, index) => (
                      <Draggable
                        key={`${user.userId}-${user.timestamp}`}
                        draggableId={`${user.userId}-${user.timestamp}`}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <li
                            className={`queue-item ${snapshot.isDragging ? "dragging" : ""}`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <span>
                              {user.name} -{" "}
                              {new Date(parseInt(user.timestamp)).toLocaleString()}
                            </span>
                            <button
                              className="delete-button"
                              onClick={() => deleteUser(user.userId, user.timestamp)}
                              disabled={loading || saving}
                            >
                              Delete
                            </button>
                          </li>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </ul>
                </div>
              )}
            </Droppable>
          </DragDropContext>


          <button
        onClick={saveNewOrder}
        disabled={saving || loading}
        className="sav-button"
      >
        {saving ? "Saving..." : "Save Order"}
      </button>
      </div>


    </div>
  );
};

export default QueueComponent;