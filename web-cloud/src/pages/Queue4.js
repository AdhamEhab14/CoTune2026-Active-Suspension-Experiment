import { useState, useEffect, useRef } from "react";
import { fetchAuthSession } from "@aws-amplify/auth";
import {
  DynamoDBClient,
  ScanCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { useNavigate } from "react-router-dom";

const REGION = "eu-west-3";
const TABLE_NAME = "SuspensionQueueTable";
const SESSION_DURATION = 300000; // 5 minutes

const useQueueStatus = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState(null);
  const [identityId, setIdentityId] = useState("");
  const [users, setUsers] = useState([]);
  const [isAllowed, setIsAllowed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [wasFirst, setWasFirst] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isProcessing = useRef(false);

  useEffect(() => {
    const initializeAWS = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        if (!session.credentials) throw new Error("No credentials found");
        setCredentials(session.credentials);
        setIdentityId(session.identityId);
      } catch (err) {
        console.error("Error initializing AWS:", err);
      }
    };
    initializeAWS();
  }, []);

  useEffect(() => {
    if (credentials && identityId) {
      joinQueue();
    }
  }, [credentials, identityId]);

  useEffect(() => {
    if (!credentials || !identityId) return;
    const interval = setInterval(fetchUsers, 1000);
    return () => clearInterval(interval);
  }, [credentials, identityId]);

  useEffect(() => {
    if (wasFirst && timeRemaining === 0 && identityId && (users.length > 0 && users[0].userId.S === identityId)) {
      endSession();
    }
  }, [wasFirst, timeRemaining, identityId, users]);

  const joinQueue = async () => {
    if (!credentials || !identityId) return;
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const scanResponse = await dbClient.send(new ScanCommand({ TableName: TABLE_NAME }));
      if (scanResponse.Items?.some((user) => user.userId.S === identityId)) return;
      
      const now = Date.now();
      const putParams = {
        TableName: TABLE_NAME,
        Item: {
          userId: { S: identityId },
          timestamp: { N: now.toString() },
          entryTime: { N: now.toString() },
        },
      };
      await dbClient.send(new PutItemCommand(putParams));
    } catch (error) {
      console.error("Error joining queue:", error);
    }
  };

  const fetchUsers = async () => {
    if (!credentials || !identityId || isProcessing.current) return;
    isProcessing.current = true;
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const scanResponse = await dbClient.send(new ScanCommand({ TableName: TABLE_NAME }));
      const sortedUsers = (scanResponse.Items || []).sort(
        (a, b) => parseInt(a.timestamp.N) - parseInt(b.timestamp.N)
      );
      setUsers(sortedUsers);
      setIsLoading(false);
      
      const userPosition = sortedUsers.findIndex((u) => u.userId.S === identityId) + 1;
      if (userPosition === 1) {
        setIsAllowed(true);
      } else {
        setIsAllowed(false);
        setTimeRemaining(0);
      }
      
      if (sortedUsers.length === 0) {
        setIsAllowed(true);
        setTimeRemaining(0);
        setWasFirst(false);
        return;
      }

      const firstUser = sortedUsers[0];
      const isCurrentUserFirst = firstUser.userId.S === identityId;
      const sessionStartTime = parseInt(firstUser.sessionStartTime?.N || "0");
      const now = Date.now();

      if (isCurrentUserFirst && sessionStartTime === 0) {
        await startSession(firstUser);
        return;
      }

      const elapsed = sessionStartTime > 0 ? now - sessionStartTime : 0;

      if (isCurrentUserFirst) {
        setIsAllowed(true);
        setWasFirst(true);
        const secondsRemaining = Math.max(0, Math.floor((SESSION_DURATION - elapsed) / 1000));
        setTimeRemaining(secondsRemaining);
      } else {
        if (elapsed >= SESSION_DURATION && sessionStartTime > 0) {
          await removeUser(firstUser);
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      isProcessing.current = false;
    }
  };

  const startSession = async (user) => {
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const now = Date.now();
      await dbClient.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          userId: { S: user.userId.S },
          timestamp: { N: user.timestamp.N },
          entryTime: { N: user.entryTime.N },
          sessionStartTime: { N: now.toString() },
        },
      }));
    } catch (error) {
      console.error("Error starting session:", error);
    }
  };

  const removeUser = async (user) => {
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      await dbClient.send(new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: { userId: { S: user.userId.S }, timestamp: { N: user.timestamp.N } },
      }));
    } catch (error) {
      console.error("Error removing user:", error);
    }
  };

  const endSession = async () => {
    try {
      if (users.length > 0 && users[0].userId.S === identityId) {
        await removeUser(users[0]);
      }
      navigate("/SuspensionProgress");
    } catch (error) {
      console.error("Error in endSession:", error);
      window.location.href = "/SuspensionProgress";
    }
  };

  return {
    isAllowed,
    identityId,
    position: users.findIndex((u) => u.userId.S === identityId) + 1,
    timeRemaining,
    isLoading,
  };
};

export default useQueueStatus;
