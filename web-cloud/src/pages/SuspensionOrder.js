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
import LiveVideoPlayer from "./Video";

const REGION = "eu-west-3";
const QUEUE_TABLE = "SuspensionQueueTable";
const PROFILE_TABLE = "ProfileTable";

const SuspensionOrder = () => {
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
        if (!session.credentials) throw new Error("No credentials found");
        setCredentials(session.credentials);
        setIdentityId(session.identityId);

        let role = "student";
        const idToken = session.tokens?.idToken?.toString();
        if (idToken) {
          const decoded = jwtDecode(idToken);
          const groups = decoded["cognito:groups"] || [];
          if (groups.includes("Admin")) role = "admin";
        }

        if (role !== "admin") throw new Error("Admin privileges required");
        setUserRole(role);

        const policyClient = new IoTClient({ region: REGION, credentials: session.credentials });
        await policyClient.send(new AttachPolicyCommand({ policyName: "IoTPolicy", target: session.identityId }));
        
        setIoTClient(new IoTDataPlaneClient({ region: REGION, credentials: session.credentials }));
      } catch (err) {
        console.error("Error initializing AWS:", err);
        if (isMounted.current) {
          setError(err.message);
          setTimeout(() => navigate("/"), 3000);
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    initializeAWS();
    return () => { isMounted.current = false; };
  }, [navigate]);

  useEffect(() => {
    if (credentials && userRole === "admin") {
      fetchUsers();
      const interval = setInterval(fetchUsers, 10000);
      return () => clearInterval(interval);
    }
  }, [credentials, userRole]);

  const fetchUsers = async () => {
    if (!credentials || userRole !== "admin") return;
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const scanResponse = await dbClient.send(new ScanCommand({ TableName: QUEUE_TABLE }));
      if (scanResponse.Items) {
        const queueItems = scanResponse.Items.map(item => ({
          userId: item.userId?.S || "Unknown",
          timestamp: item.timestamp?.N || "0",
        }));

        const usersWithNames = await Promise.all(queueItems.map(async item => {
          const profileResponse = await dbClient.send(new QueryCommand({
            TableName: PROFILE_TABLE,
            KeyConditionExpression: "IdentityID = :id",
            ExpressionAttributeValues: { ":id": { S: item.userId } },
          }));
          return { ...item, name: profileResponse.Items?.[0]?.name?.S || "Unknown User" };
        }));

        setUsers(usersWithNames.sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp)));
      }
    } catch (error) {
      console.error("Error fetching queue:", error);
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
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      await dbClient.send(new DeleteItemCommand({
        TableName: QUEUE_TABLE,
        Key: { userId: { S: userId }, timestamp: { N: timestamp } },
      }));
      setUsers(prev => prev.filter(u => u.userId !== userId || u.timestamp !== timestamp));
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const saveNewOrder = async () => {
    setSaving(true);
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const scanResponse = await dbClient.send(new ScanCommand({ TableName: QUEUE_TABLE }));
      for (const item of (scanResponse.Items || [])) {
        await dbClient.send(new DeleteItemCommand({
          TableName: QUEUE_TABLE,
          Key: { userId: { S: item.userId.S }, timestamp: { N: item.timestamp.N } },
        }));
      }
      for (let i = 0; i < users.length; i++) {
        await dbClient.send(new PutItemCommand({
          TableName: QUEUE_TABLE,
          Item: { userId: { S: users[i].userId }, timestamp: { N: `${Date.now() + i}` } },
        }));
      }
      setSuccess("Queue updated!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Error saving queue order:", error);
    } finally {
      setSaving(false);
    }
  };

  const publishControl = async (topic, payload) => {
    if (!iotClient) return;
    try {
      await iotClient.send(new PublishCommand({
        topic,
        qos: 0,
        payload: Buffer.from(JSON.stringify(payload)),
      }));
      setSuccess("Command sent!");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error("Publish error:", err);
    }
  };

  if (userRole !== "admin" && !loading) return <div className="pag"><h1>Access Denied</h1></div>;

  return (
    <div className="pag">
      <Helmet><title>Suspension Control</title></Helmet>
      <h1>Active Suspension Control Page</h1>
      <div className="vid-container">
        <LiveVideoPlayer />
        <h2 className="heeeeeaaaaddd">Controls (Global)</h2>
        <div className="button-group">
          <button className="control-button" onClick={() => publishControl("Esp32_RpiWakeup/sub", { status: "ON" })}>Raspberry On</button>
          <button className="control-button" onClick={() => publishControl("$aws/things/RaspberryPiStreamer/shadow/name/Stream4Shadow/update", { state: { desired: { stream4: "on" } } })}>Start Stream</button>
          <button className="control-button" onClick={() => publishControl("$aws/things/RaspberryPiStreamer/shadow/name/Stream4Shadow/update", { state: { desired: { stream4: "off" } } })}>Stop Stream</button>
        </div>
      </div>
      <div className="queue-container">
        <h2>Queue</h2>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="queueList">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="drag-area">
                <ul className="queue-list">
                  {users.map((user, index) => (
                    <Draggable key={`${user.userId}-${user.timestamp}`} draggableId={`${user.userId}-${user.timestamp}`} index={index}>
                      {(provided) => (
                        <li {...provided.draggableProps} {...provided.dragHandleProps} ref={provided.innerRef} className="queue-item">
                          <span>{user.name}</span>
                          <button className="delete-button" onClick={() => deleteUser(user.userId, user.timestamp)}>Delete</button>
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
        <button onClick={saveNewOrder} disabled={saving} className="sav-button">{saving ? "Saving..." : "Save Order"}</button>
      </div>
    </div>
  );
};

export default SuspensionOrder;
