import { useState, useEffect } from "react";
import { fetchAuthSession } from "@aws-amplify/auth";
import {
  DynamoDBClient,
  ScanCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";

const REGION = "eu-west-3";
const TABLE_NAME = "QueueTable";

const useQueueStatus = () => {
  const [credentials, setCredentials] = useState(null);
  const [identityId, setIdentityId] = useState("");
  const [users, setUsers] = useState([]);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    initializeAWS();
  }, []);

  useEffect(() => {
    if (credentials && identityId) {
      joinQueue();
      fetchUsers();
    }
  }, [credentials, identityId]);

  useEffect(() => {
    const interval = setInterval(() => {
      removeFirstUser(); // Remove first user every 10 sec
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const initializeAWS = async () => {
    try {
      const session = await fetchAuthSession({ forceRefresh: false });
      setCredentials(session.credentials);
      setIdentityId(session.identityId);
    } catch (err) {
      console.error("Error initializing AWS:", err);
    }
  };

  const joinQueue = async () => {
    if (!credentials || !identityId) return;

    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      const scanParams = { TableName: TABLE_NAME };
      const scanResponse = await dbClient.send(new ScanCommand(scanParams));
      const userExists = scanResponse.Items?.some(
        (user) => user.userId.S === identityId
      );

      if (userExists) {
        console.log("User already in queue.");
        return;
      }

      const timestamp = Date.now().toString();
      const putParams = {
        TableName: TABLE_NAME,
        Item: {
          userId: { S: identityId },
          timestamp: { N: timestamp },
        },
      };

      await dbClient.send(new PutItemCommand(putParams));
      console.log("User added to queue:", identityId);
      fetchUsers();
    } catch (error) {
      console.error("Error adding user:", error);
    }
  };

  const fetchUsers = async () => {
    if (!credentials) return;

    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      const scanParams = { TableName: TABLE_NAME };
      const scanResponse = await dbClient.send(new ScanCommand(scanParams));

      if (scanResponse.Items) {
        const sortedUsers = scanResponse.Items.sort(
          (a, b) => parseInt(a.timestamp.N) - parseInt(b.timestamp.N)
        );
        setUsers(sortedUsers);
        updateUserStatus(sortedUsers);
      } else {
        setUsers([]);
        setIsAllowed(false);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const updateUserStatus = (sortedUsers) => {
    if (sortedUsers.length > 0 && sortedUsers[0].userId.S === identityId) {
      setIsAllowed(true);
      setTimeout(() => {
        // removeFirstUser();
        // window.location.href = "/"; // Redirect after 10 sec
      }, 10000);
    } else {
      setIsAllowed(false);
    }
  };

  const removeFirstUser = async () => {
    if (!credentials) return;

    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      const scanParams = { TableName: TABLE_NAME };
      const scanResponse = await dbClient.send(new ScanCommand(scanParams));

      const latestUsers = scanResponse.Items?.sort(
        (a, b) => parseInt(a.timestamp.N) - parseInt(b.timestamp.N)
      );

      if (!latestUsers || latestUsers.length === 0) {
        console.log("No users left to delete.");
        return;
      }

      const firstUser = latestUsers[0];
      console.log(`Removing user: ${firstUser.userId.S}`);

      const deleteParams = {
        TableName: TABLE_NAME,
        Key: {
          userId: { S: firstUser.userId.S },
          timestamp: { N: firstUser.timestamp.N },
        },
      };

      await dbClient.send(new DeleteItemCommand(deleteParams));
      console.log(`User ${firstUser.userId.S} removed.`);

      // Wait for 10 seconds before deleting the next user
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Recursively delete the next user
      await removeFirstUser();
    } catch (error) {
      console.error("Error removing user:", error);
    }
  };

  return (
    <div>
      <p>Allowed: {isAllowed ? "Yes" : "No"}</p>
      <p>Identity ID: {identityId}</p>
    </div>
  );
};

export default useQueueStatus;
