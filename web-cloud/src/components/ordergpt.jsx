import { useState, useEffect, useCallback } from "react";
import { fetchAuthSession } from "@aws-amplify/auth";
import {
  DynamoDBClient,
  ScanCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

const REGION = "eu-west-3";
const TABLE_NAME = "QueueTable";
const NEW_TABLE_NAME = "QueueTable";

const QueueComponent = () => {
  const [credentials, setCredentials] = useState(null);
  const [identityId, setIdentityId] = useState("");
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const initializeAWS = async () => {
    try {
      const session = await fetchAuthSession({ forceRefresh: false });
      setCredentials(session.credentials);
      setIdentityId(session.identityId);
    } catch (err) {
      console.error("Error initializing AWS:", err);
    }
  };

  const fetchUsers = useCallback(async () => {
    if (!credentials) return;
    setLoading(true);
    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      const scanResponse = await dbClient.send(
        new ScanCommand({ TableName: TABLE_NAME })
      );

      if (scanResponse.Items) {
        const sortedUsers = scanResponse.Items.map((item) => ({
          userId: item.userId?.S || "Unknown",
          timestamp: item.timestamp?.N || "0",
        })).sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

        setUsers(sortedUsers);
        console.log("Users in queue:", sortedUsers);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users from DynamoDB:", error);
    } finally {
      setLoading(false);
    }
  }, [credentials]);

  useEffect(() => {
    initializeAWS();
  }, []);

  useEffect(() => {
    if (credentials && identityId) {
      fetchUsers();
    }
  }, [credentials, identityId, fetchUsers]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (credentials && identityId) {
        fetchUsers();
      }
    }, 100000);
    return () => clearInterval(interval);
  }, [credentials, identityId, fetchUsers]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const reorderedUsers = [...users];
    const [movedItem] = reorderedUsers.splice(result.source.index, 1);
    reorderedUsers.splice(result.destination.index, 0, movedItem);

    setUsers(reorderedUsers);
  };

  const saveNewOrder = async () => {
    if (!credentials || users.length === 0) return;
    setSaving(true);

    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      const scanCommand = new ScanCommand({ TableName: NEW_TABLE_NAME });
      const scanResponse = await dbClient.send(scanCommand);

      if (scanResponse.Items && scanResponse.Items.length > 0) {
        for (const item of scanResponse.Items) {
          const userIdAttr = item.userId;
          const timestampAttr = item.timestamp;

          if (userIdAttr?.S && timestampAttr?.N) {
            const deleteCommand = new DeleteItemCommand({
              TableName: NEW_TABLE_NAME,
              Key: {
                userId: { S: userIdAttr.S },
                timestamp: { N: timestampAttr.N },
              },
            });
            await dbClient.send(deleteCommand);
          }
        }
      }

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (!user.userId) continue;

        const timestamp = Date.now() + i;

        const putCommand = new PutItemCommand({
          TableName: NEW_TABLE_NAME,
          Item: {
            userId: { S: user.userId },
            timestamp: { N: `${timestamp}` },
          },
        });

        await dbClient.send(putCommand);
      }

      console.log("Queue updated successfully!");
    } catch (error) {
      console.error("Error updating QueueTable:", error);
      alert("❌ Failed to update the queue. See console for details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Queue Users</h2>

      {loading ? (
        <p>Loading users...</p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="queueList">
            {(provided) => (
              <ul {...provided.droppableProps} ref={provided.innerRef}>
                {users.map((user, index) => (
                  <Draggable
                    key={`${user.userId}-${user.timestamp}`}
                    draggableId={`${user.userId}-${user.timestamp}`}
                    index={index}
                  >
                    {(provided) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          padding: "10px",
                          margin: "5px 0",
                          backgroundColor: "#f4f4f4",
                          borderRadius: "5px",
                          cursor: "grab",
                          userSelect: "none",
                          touchAction: "none",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          ...provided.draggableProps.style,
                        }}
                      >
                        {user.userId} -{" "}
                        {new Date(parseInt(user.timestamp)).toLocaleString()}
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <button
        onClick={saveNewOrder}
        disabled={saving}
        style={{
          marginTop: "10px",
          padding: "10px",
          backgroundColor: saving ? "gray" : "#007bff",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving..." : "Save Order"}
      </button>
    </div>
  );
};

export default QueueComponent;
