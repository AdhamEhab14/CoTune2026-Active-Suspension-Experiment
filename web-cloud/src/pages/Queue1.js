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
const TABLE_NAME = "QueueTable";
const SESSION_DURATION = 300000; // 5 minutes in milliseconds

const useQueueStatus = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState(null);
  const [identityId, setIdentityId] = useState("");
  const [users, setUsers] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [wasFirst, setWasFirst] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const isProcessing = useRef(false);

  // Initialize AWS credentials
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

  // Join queue when credentials are available
  useEffect(() => {
    if (credentials && identityId) {
      joinQueue();
    }
  }, [credentials, identityId]);

  // Poll queue status every 1 second
  useEffect(() => {
    if (!credentials || !identityId) return;
    const interval = setInterval(fetchUsers, 1000);
    return () => clearInterval(interval);
  }, [credentials, identityId]);

  // Handle session expiration and redirect
  useEffect(() => {
    if (wasFirst && timeRemaining === 0 && identityId && (users.length > 0 && users[0].userId.S === identityId)) {
      console.log("Session expired, initiating endSession for user:", identityId);
      endSession();
    }
  }, [wasFirst, timeRemaining, identityId, users]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && credentials && identityId) {
        fetchUsers();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [credentials, identityId]);

  const joinQueue = async () => {
    if (!credentials || !identityId) {
      console.log("Missing credentials or identityId, cannot join queue");
      return;
    }
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      // Check if user is already in queue
      const scanResponse = await dbClient.send(new ScanCommand({ TableName: TABLE_NAME }));
      if (scanResponse.Items?.some((user) => user.userId.S === identityId)) {
        return;
      }
      // Add user to queue with entry timestamp
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
      console.log("User added to queue:", identityId);
    } catch (error) {
      console.error("Error joining queue:", error);
      setWasFirst(false);
      setUsers([]);
      setTimeRemaining(0);
    }
  };

  const fetchUsers = async () => {
    if (!credentials || !identityId) return;
    if (isProcessing.current) return;
    
    isProcessing.current = true;
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const scanResponse = await dbClient.send(new ScanCommand({ TableName: TABLE_NAME }));
      const sortedUsers = (scanResponse.Items || []).sort(
        (a, b) => parseInt(a.timestamp.N) - parseInt(b.timestamp.N)
      );
      setUsers(sortedUsers);
      setIsLoading(false);

      // Handle queue status
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
        const remaining = SESSION_DURATION - elapsed;
        const secondsRemaining = Math.max(0, Math.floor(remaining / 1000));
        setTimeRemaining(secondsRemaining);
      } else {
        setIsAllowed(false);
        setTimeRemaining(0);
        setWasFirst(false);
        if (elapsed >= SESSION_DURATION && sessionStartTime > 0) {
          await removeUser(firstUser);
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
      setTimeRemaining(0);
      setIsLoading(false);
    } finally {
      isProcessing.current = false;
    }
  };

  const startSession = async (user) => {
    if (!credentials || !identityId) {
      console.log("Missing credentials or identityId, cannot start session");
      return;
    }
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const now = Date.now();
      const putParams = {
        TableName: TABLE_NAME,
        Item: {
          userId: { S: user.userId.S },
          timestamp: { N: user.timestamp.N },
          entryTime: { N: user.entryTime.N },
          sessionStartTime: { N: now.toString() },
        },
      };
      await dbClient.send(new PutItemCommand(putParams));
      console.log("Session started for user:", user.userId.S, "at:", now);
    } catch (error) {
      console.error("Error starting session:", error);
      console.log("Retrying session start in 1s for user:", user.userId.S);
      setTimeout(() => startSession(user), 1000);
    }
  };

  const removeUser = async (user) => {
    if (!credentials) {
      console.log("No credentials, cannot remove user");
      return;
    }
    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    try {
      const deleteParams = {
        TableName: TABLE_NAME,
        Key: {
          userId: { S: user.userId.S },
          timestamp: { N: user.timestamp.N },
        },
      };
      await dbClient.send(new DeleteItemCommand(deleteParams));
      console.log(`User ${user.userId.S} removed from queue`);
      setUsers((prev) => prev.filter((u) => u.userId.S !== user.userId.S));
    } catch (error) {
      console.error("Error removing user:", error);
    }
  };

  const endSession = async () => {
    if (!credentials || !identityId) {
      console.log("Cannot end session, invalid state:", { credentials: !!credentials, identityId });
      // Force redirect even if credentials are missing
      window.location.href = "/Progresspage";
      return;
    }
    
    try {
      console.log("Ending session for user:", identityId);
      
      // Set states first to prevent race conditions
      setWasFirst(false);
      setTimeRemaining(0);
      
      // Try to remove from queue if user exists
      if (users.length > 0 && users[0].userId.S === identityId) {
        await removeUser(users[0]).catch(console.error);
      }

      // Use both navigate and window.location as fallback
      try {
        navigate("/Progresspage", { replace: true });
      } catch (navError) {
        console.error("Navigation failed, using window.location:", navError);
        window.location.href = "/Progresspage";
      }
      
    } catch (error) {
      console.error("Error in endSession:", error);
      // Final fallback - force redirect
      window.location.href = "/Progresspage";
    }
  };

  const getPositionInQueue = () => {
    if (isLoading || !users || !identityId) return null;
    const index = users.findIndex((user) => user.userId.S === identityId);
    return index !== -1 ? index + 1 : 0;
  };

  return {
    isAllowed,
    identityId,
    position: getPositionInQueue(),
    timeRemaining,
    isLoading,
  };
};

export default useQueueStatus;