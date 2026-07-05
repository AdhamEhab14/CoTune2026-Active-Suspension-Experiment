import "./datavisibility.css";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { fetchAuthSession } from "@aws-amplify/auth";
import {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { jwtDecode } from "jwt-decode";

const REGION = "eu-west-3";
const PROFILE_TABLE = "ProfileTable";
const VISIBILITY_TABLE = "UserDataVisibility";

const DataVisibility = () => {
  const [credentials, setCredentials] = useState(null);
  const [identityId, setIdentityId] = useState("");
  const [userRole, setUserRole] = useState("student");
  const [users, setUsers] = useState([]);
  const [visibility, setVisibility] = useState({});
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const isMounted = useRef(true);
  const navigate = useNavigate();

  // Initialize AWS and check admin role
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
        console.log("Credentials refreshed");

        let role = "student";
        const idToken = session.tokens?.idToken?.toString();
        if (idToken) {
          const decoded = jwtDecode(idToken);
          const groups = decoded["cognito:groups"] || [];
          console.log("User Groups:", groups);
          if (groups.includes("Admin")) {
            role = "admin";
            console.log("User Role on web is Admin");
          }
        } else {
          console.warn("No ID token found for group decoding.");
        }

        if (role !== "admin") {
          throw new Error("Access denied: Admin privileges required");
        }

        setUserRole(role);
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

  // Fetch users and visibility every 3 minutes
  useEffect(() => {
    if (credentials && userRole === "admin") {
      fetchUsersAndVisibility();
    }
    const interval = setInterval(() => {
      if (credentials && userRole === "admin") {
        fetchUsersAndVisibility();
      }
    }, 180000);
    return () => clearInterval(interval);
  }, [credentials, userRole]);

  // Fetch users from ProfileTable and visibility from UserDataVisibility
  const fetchUsersAndVisibility = async () => {
    if (!credentials || userRole !== "admin") return;
    setLoading(true);
    setError(null);

    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      const profileResponse = await dbClient.send(
        new ScanCommand({ TableName: PROFILE_TABLE })
      );

      const fetchedUsers = profileResponse.Items
        ? profileResponse.Items.map((item) => ({
            identityId: item.IdentityID?.S || "Unknown",
            name: item.name?.S || "Unknown User",
          }))
        : [];

      const visibilityResponse = await dbClient.send(
        new ScanCommand({ TableName: VISIBILITY_TABLE })
      );

      const visibilityMap = {};
      if (visibilityResponse.Items) {
        visibilityResponse.Items.forEach((item) => {
          visibilityMap[item.IdentityID?.S] = {
            visibility: item.visibility?.S || "show",
            graphsVisibility: item.graphsVisibility?.S || "show",
            calculationsVisibility: item.calculationsVisibility?.S || "show",
            saveData: item.saveData?.S || "allow",
          };
        });
      }

      const usersWithVisibility = fetchedUsers.map((user) => ({
        ...user,
        visibility: visibilityMap[user.identityId]?.visibility || "show",
        graphsVisibility: visibilityMap[user.identityId]?.graphsVisibility || "show",
        calculationsVisibility: visibilityMap[user.identityId]?.calculationsVisibility || "show",
        saveData: visibilityMap[user.identityId]?.saveData || "allow",
      }));

      if (isMounted.current) {
        setUsers(usersWithVisibility);
        setVisibility(visibilityMap);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      if (isMounted.current) {
        setError("Failed to fetch users or visibility: " + error.message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Handle user selection
  const handleSelectUser = (identityId) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(identityId)) {
        newSet.delete(identityId);
      } else {
        newSet.add(identityId);
      }
      return newSet;
    });
  };

  // Toggle visibility for a single user
  const toggleVisibility = async (identityId, field, currentValue) => {
    if (!credentials || userRole !== "admin") return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const newValue = field === "saveData" ? (currentValue === "allow" ? "deny" : "allow") : (currentValue === "show" ? "hide" : "show");
    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      await dbClient.send(
        new UpdateItemCommand({
          TableName: VISIBILITY_TABLE,
          Key: {
            IdentityID: { S: identityId },
          },
          UpdateExpression: `SET ${field} = :v`,
          ExpressionAttributeValues: {
            ":v": { S: newValue },
          },
        })
      );

      if (isMounted.current) {
        setVisibility((prev) => ({
          ...prev,
          [identityId]: {
            ...prev[identityId],
            [field]: newValue,
          },
        }));
        setUsers((prev) =>
          prev.map((user) =>
            user.identityId === identityId
              ? { ...user, [field]: newValue }
              : user
          )
        );
        const userName = users.find((user) => user.identityId === identityId)?.name || "Unknown User";
        setSuccess(`${field} updated for ${userName} to ${newValue}`);
        setTimeout(() => setSuccess(null), 3000);
      }
      console.log(`${field} updated for ${identityId}: ${newValue}`);
    } catch (error) {
      console.error(`Error updating ${field} for ${identityId}:`, error);
      if (isMounted.current) {
        setError(`Failed to update ${field}: ${error.message}`);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Bulk toggle for selected users
  const bulkToggleSelected = async (field, newValue) => {
    if (!credentials || userRole !== "admin" || selectedUsers.size === 0) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      for (const identityId of selectedUsers) {
        await dbClient.send(
          new UpdateItemCommand({
            TableName: VISIBILITY_TABLE,
            Key: {
              IdentityID: { S: identityId },
            },
            UpdateExpression: `SET ${field} = :v`,
            ExpressionAttributeValues: {
              ":v": { S: newValue },
            },
          })
        );
      }

      if (isMounted.current) {
        setVisibility((prev) => {
          const updated = { ...prev };
          selectedUsers.forEach((id) => {
            updated[id] = {
              ...updated[id],
              [field]: newValue,
            };
          });
          return updated;
        });
        setUsers((prev) =>
          prev.map((user) =>
            selectedUsers.has(user.identityId)
              ? { ...user, [field]: newValue }
              : user
          )
        );
        setSuccess(`Selected users' ${field} set to ${newValue}`);
        setSelectedUsers(new Set());
        setTimeout(() => setSuccess(null), 3000);
      }
      console.log(`Bulk ${field} updated to ${newValue} for selected users`);
    } catch (error) {
      console.error(`Error updating bulk ${field}:`, error);
      if (isMounted.current) {
        setError(`Failed to update bulk ${field}: ${error.message}`);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Bulk toggle: Show All or Hide All (all attributes)
  const bulkToggleAll = async (newValue) => {
    if (!credentials || userRole !== "admin" || users.length === 0) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const dbClient = new DynamoDBClient({ region: REGION, credentials });

    try {
      for (const user of users) {
        await dbClient.send(
          new UpdateItemCommand({
            TableName: VISIBILITY_TABLE,
            Key: {
              IdentityID: { S: user.identityId },
            },
            UpdateExpression: "SET visibility = :v, graphsVisibility = :v, calculationsVisibility = :v, saveData = :s",
            ExpressionAttributeValues: {
              ":v": { S: newValue },
              ":s": { S: newValue === "show" ? "allow" : "deny" },
            },
          })
        );
      }

      if (isMounted.current) {
        const updatedVisibility = {};
        users.forEach((user) => {
          updatedVisibility[user.identityId] = {
            visibility: newValue,
            graphsVisibility: newValue,
            calculationsVisibility: newValue,
            saveData: newValue === "show" ? "allow" : "deny",
          };
        });
        setVisibility(updatedVisibility);
        setUsers((prev) =>
          prev.map((user) => ({
            ...user,
            visibility: newValue,
            graphsVisibility: newValue,
            calculationsVisibility: newValue,
            saveData: newValue === "show" ? "allow" : "deny",
          }))
        );
        setSuccess(`All users set to ${newValue}`);
        setSelectedUsers(new Set());
        setTimeout(() => setSuccess(null), 3000);
      }
      console.log(`Bulk visibility updated to ${newValue}`);
    } catch (error) {
      console.error("Error updating bulk visibility:", error);
      if (isMounted.current) {
        setError("Failed to update bulk visibility: " + error.message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Filter users based on search query
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.identityId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (userRole !== "admin" && !loading) {
    return (
      <div className="page">
        <h1>Access Denied</h1>
        <p>Redirecting to home...</p>
      </div>
    );
  }

  return (
    <div className="page">

      <Helmet>
        <title>Data Visibility</title>
      </Helmet>
      <h1>Data Visibility Control</h1>

      {loading && (
        <p className="loading">
          <span className="spinner"></span> Loading...
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      {/* <div className="bulk-controls">
        <button
          className="bulk-button show-all"
          onClick={() => bulkToggleAll("show")}
          disabled={loading}
        >
          Show All
        </button>
        <button
          className="bulk-button hide-all"
          onClick={() => bulkToggleAll("hide")}
          disabled={loading}
        >
          Hide All
        </button>
      </div> */}

      <div className="search-container">
        <input
          type="text"
          placeholder="Search by name"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>
      
      <div className="users-container">
        <h2 className="special">Users</h2>


        {filteredUsers.length === 0 && !loading ? (
          <p>No users found.</p>
        ) : (
          <ul className="user-list">
            {filteredUsers.map((user) => (
              <li key={user.identityId} className="user-item">
                <div className="user-selection">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.identityId)}
                    onChange={() => handleSelectUser(user.identityId)}
                    disabled={loading}
                    aria-label={`Select ${user.name}`}
                  />
                  <span>{user.name} </span>
                </div>
                <div className="visibility-controls">
                  <div className="visibility-control">
                    <label>
                      Graphs:
                      <input
                        type="checkbox"
                        checked={user.graphsVisibility === "show"}
                        onChange={() =>
                          toggleVisibility(user.identityId, "graphsVisibility", user.graphsVisibility)
                        }
                        disabled={loading}
                        aria-label={`Toggle graphs visibility for ${user.name}`}
                      />
                    </label>
                    <span className="visibility-status">
                      {user.graphsVisibility === "show" ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <div className="visibility-control">
                    <label>
                      Calculations:
                      <input
                        type="checkbox"
                        checked={user.calculationsVisibility === "show"}
                        onChange={() =>
                          toggleVisibility(user.identityId, "calculationsVisibility", user.calculationsVisibility)
                        }
                        disabled={loading}
                        aria-label={`Toggle calculations visibility for ${user.name}`}
                      />
                    </label>
                    <span className="visibility-status">
                      {user.calculationsVisibility === "show" ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <div className="visibility-control">
                    <label>
                      Save Data:
                      <input
                        type="checkbox"
                        checked={user.saveData === "allow"}
                        onChange={() =>
                          toggleVisibility(user.identityId, "saveData", user.saveData)
                        }
                        disabled={loading}
                        aria-label={`Toggle save data for ${user.name}`}
                      />
                    </label>
                    <span className="visibility-status">
                      {user.saveData === "allow" ? "Allowed" : "Denied"}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bulk-controls">
        <button
          className="bulk-button show-graphs"
          onClick={() => bulkToggleSelected("graphsVisibility", "show")}
          disabled={loading || selectedUsers.size === 0}
        >
          Show Graphs
        </button>
        <button
          className="bulk-button hide-graphs"
          onClick={() => bulkToggleSelected("graphsVisibility", "hide")}
          disabled={loading || selectedUsers.size === 0}
        >
          Hide Graphs
        </button>
        <button
          className="bulk-button show-calculations"
          onClick={() => bulkToggleSelected("calculationsVisibility", "show")}
          disabled={loading || selectedUsers.size === 0}
        >
          Show Calculations
        </button>
        <button
          className="bulk-button hide-calculations"
          onClick={() => bulkToggleSelected("calculationsVisibility", "hide")}
          disabled={loading || selectedUsers.size === 0}
        >
          Hide Calculations
        </button>
        <button
          className="bulk-button allow-save"
          onClick={() => bulkToggleSelected("saveData", "allow")}
          disabled={loading || selectedUsers.size === 0}
        >
          Allow Save Data
        </button>
        <button
          className="bulk-button deny-save"
          onClick={() => bulkToggleSelected("saveData", "deny")}
          disabled={loading || selectedUsers.size === 0}
        >
          Deny Save Data
        </button>
      </div>
    </div>
  );
};

export default DataVisibility;