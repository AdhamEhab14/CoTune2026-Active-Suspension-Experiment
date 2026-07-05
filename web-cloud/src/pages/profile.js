import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { fetchAuthSession } from "@aws-amplify/auth";
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { jwtDecode } from "jwt-decode";
import "./Profile.css";
import { useCognitoGroup } from "../auth/hooks/getRole";

const REGION = "eu-west-3";

function Profile() {
  const [credentials, setCredentials] = useState(null);
  const [identityId, setIdentityId] = useState("");
  const { userRole: cognitoRole, loading: roleLoading, error: roleError } = useCognitoGroup();
  const [formData, setFormData] = useState({
    IdentityID: "",
    nationalId: "",
    name: "",
    id: "",
    gpa: "",
    age: "",
    gender: "",
    photo: "",
    phoneNumber: "",
    userRole: cognitoRole,
    secretKey: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [roleUpdateMessage, setRoleUpdateMessage] = useState(null);
  const [username, setUsername] = useState(null);
  const [codestatus, setCodeStatus] = useState(null);

  useEffect(() => {
    const initializeAWS = async () => {
      try {
        const session = await fetchAuthSession();
        setUsername(session.tokens.signInDetails.loginId);
        if (!session.credentials) {
          throw new Error("No credentials found in session");
        }
        setCredentials(session.credentials);
        setIdentityId(session.identityId);
        setLoadingProgress(33.33);
      } catch (err) {
        console.error("Error initializing AWS:", err);
        setError("Failed to initialize AWS credentials: " + err.message);
      }
    };

    initializeAWS();
  }, []);

  useEffect(() => {
    if (!roleLoading && !roleError && cognitoRole) {
      setFormData((prev) => {
        const newFormData = { ...prev, IdentityID: identityId, userRole: cognitoRole };
        if (prev.userRole && prev.userRole !== cognitoRole) {
          setRoleUpdateMessage(
            `Your role has changed to ${cognitoRole}. Please save your profile to update it.`
          );
        }
        return newFormData;
      });
      console.log("Cognito role updated:", cognitoRole);
      setLoadingProgress((prev) => prev + 33.33);
    } else if (roleError) {
      setError("Failed to retrieve user role: " + roleError);
    }
  }, [roleLoading, roleError, cognitoRole, identityId]);

  const fetchProfile = useCallback(async (identityId, userRole) => {
    if (!credentials || !identityId) {
      setError("IdentityID or credentials required to fetch profile");
      return;
    }

    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const params = {
      TableName: "ProfileTable",
      KeyConditionExpression: "IdentityID = :id",
      ExpressionAttributeValues: {
        ":id": { S: identityId },
      },
    };

    try {
      const response = await dbClient.send(new QueryCommand(params));
      console.log("Fetch profile response:", response);
      if (response.Items && response.Items.length > 0) {
        const item = response.Items[0];
        setFormData((prev) => {
          const newFormData = {
            IdentityID: item.IdentityID.S,
            nationalId: item.NationalID?.S || "",
            name: item.name?.S || "",
            id: item.id?.S || "",
            gpa: item.gpa?.S || "",
            age: item.age?.S || "",
            gender: item.gender?.S || "",
            photo: item.photo?.S || "",
            phoneNumber: item.phoneNumber?.S || "",
            userRole: item.userRole?.S || userRole,
          };
          if (cognitoRole && item.userRole?.S && item.userRole.S !== cognitoRole) {
            setRoleUpdateMessage(
              `Your role has changed to ${cognitoRole === "Approved" ? "User" : cognitoRole}. Please save your profile to update it.`
            );
          }
          return newFormData;
        });
      } else {
        setFormData({
          IdentityID: identityId,
          nationalId: "",
          name: "",
          id: "",
          gpa: "",
          age: "",
          gender: "",
          photo: "",
          phoneNumber: "",
          userRole,
        });
        setSuccess("No profile data found. Click Add profile to add your details.");
      }
      setLoadingProgress((prev) => prev + 33.33);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(`Failed to fetch profile: ${err.message} (${err.code || "Unknown"})`);
    } finally {
      setIsLoading(false);
    }
  }, [credentials, cognitoRole]);

  useEffect(() => {
    if (identityId && formData.userRole) {
      fetchProfile(identityId, formData.userRole);
    }
  }, [identityId, formData.userRole, fetchProfile]);

  const saveProfile = async () => {
    console.log("saveProfile called with formData:", formData);
    const roleToSave = cognitoRole || formData.userRole;
    if (!formData.IdentityID || !roleToSave) {
      const errorMsg = "IdentityID and Role are required";
      console.log(errorMsg);
      setError(errorMsg);
      return;
    }

    if (!credentials) {
      const errorMsg = "AWS credentials are required";
      console.log(errorMsg);
      setError(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    // Save profile data to ProfileTable
    const profileParams = {
      TableName: "ProfileTable",
      Item: {
        IdentityID: { S: formData.IdentityID },
        NationalID: { S: formData.IdentityID },
        name: { S: formData.name || "" },
        id: { S: formData.id || "" },
        gpa: { S: formData.gpa || "" },
        age: { S: formData.age || "" },
        gender: { S: formData.gender || "" },
        photo: { S: formData.photo || "" },
        phoneNumber: { S: formData.phoneNumber || "" },
        userRole: { S: roleToSave },
      },
    };

    // If Visitor, also save secretKey to SecretKey table
    let secretKeyPromise = Promise.resolve();
    if (roleToSave === "Visitor" && formData.secretKey) {
      const secretKeyParams = {
        TableName: "SecretKey",
        Item: {
          identityId: { S: formData.IdentityID },
          secretKey: { S: formData.secretKey },
        },
      };
      secretKeyPromise = dbClient.send(new PutItemCommand(secretKeyParams));
    }

    try {
      console.log("Saving profile to DynamoDB with params:", profileParams);
      await dbClient.send(new PutItemCommand(profileParams));
      await secretKeyPromise;
      console.log("Profile and secretKey saved successfully");
      setSuccess("Profile saved successfully!");
      setIsEditing(false);
      setRoleUpdateMessage(null);
      window.location.reload();
    } catch (err) {
      console.error("Error saving profile or secretKey:", err);
      setError(`Failed to save profile: ${err.message} (${err.code || "Unknown"})`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const invokeLambda = async () => {
  try {
    const paramString = `${encodeURIComponent(username)}nextparam${encodeURIComponent(formData.userRole)}nextparam${encodeURIComponent(formData.secretKey)}`;
    const url = `https://56eq6iui4qzncxz7ropswbdzr40bordm.lambda-url.eu-west-3.on.aws/?${paramString}`;
    const response = await fetch(url);
    const data = await response.json();
    setCodeStatus(JSON.stringify(data));
  } catch (err) {
    console.log("Error invoking Lambda: " + err.message);
  }
};

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prevData) => ({
          ...prevData,
          photo: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoDelete = () => {
    setFormData((prevData) => ({
      ...prevData,
      photo: "",
    }));
  };

  const toggleEdit = () => {
    console.log("Toggling edit mode");
    setIsEditing(true);
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    console.log("Canceling edit mode");
    setIsEditing(false);
    setError(null);
    setSuccess(null);
    if (identityId) {
      fetchProfile(identityId, formData.userRole);
    }
  };

  return (
    <div className="profile-container">
      <Helmet>
        <title>Profile</title>
      </Helmet>
      <div className="profile-card">
        <h1 className="profile-title">User Profile</h1>

        {(isLoading || roleLoading) && (
          <div>
            <p>Loading... ({Math.round(loadingProgress)}%)</p>
            <progress value={loadingProgress} max="100" />
          </div>
        )}
        {(error || roleError) && <p className="error">{error || roleError}</p>}
        {success && <p className="success">{success}</p>}
        {roleUpdateMessage && <p className="warning">{roleUpdateMessage}</p>}

        {!isEditing ? (
          <>
            {formData.nationalId || formData.name ? (
              <div className="profile-summary">
                <h2>Profile Summary</h2>
                {formData.photo ? (
                  <div className="photo-container">
                    <img src={formData.photo} alt="User profile" className="profile-avatar" />
                  </div>
                ) : (
                  <div className="avatar-placeholder">No photo uploaded</div>
                )}
                <p><strong>Name:</strong> {formData.name || "Not set"}</p>
                {formData.userRole === "Student" && (
                  <>
                    <p><strong>Student ID:</strong> {formData.id || "Not set"}</p>
                    <p><strong>GPA:</strong> {formData.gpa || "Not set"}</p>
                  </>
                )}
                <p><strong>Age:</strong> {formData.age || "Not set"}</p>
                <p><strong>Gender:</strong> {formData.gender || "Not set"}</p>
                <p><strong>Phone Number:</strong> {formData.phoneNumber || "Not set"}</p>
                <p><strong>Role:</strong> {formData.userRole === "Approved" ? "User" : (formData.userRole || "Not set")}</p>
                <button
                  onClick={toggleEdit}
                  className="save-button"
                  disabled={isLoading || roleLoading}
                >
                  {formData.nationalId || formData.name ? "Edit Profile" : "Add Profile"}
                </button>
              </div>
            ) : (
              <div className="profile-summary">
                <p className="hi">No profile data available.</p>
                <button
                  onClick={toggleEdit}
                  className="save-button"
                  disabled={isLoading || roleLoading}
                >
                  Add Profile
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {formData.photo ? (
              <div className="photo-container">
                <img src={formData.photo} alt="User profile" className="profile-avatar" />
                <button
                  className="delete-photo-button"
                  onClick={handlePhotoDelete}
                  disabled={isLoading}
                >
                  Delete Photo
                </button>
              </div>
            ) : (
              <div className="avatar-placeholder">No photo uploaded</div>
            )}

            <div className="form-group">
              <label htmlFor="name">Name:</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your name"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="age">Age:</label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                placeholder="Enter your age"
                min="1"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="gender">Gender:</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className="form-input"
              >
                <option value="" disabled>
                  Select your gender
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="photo">Upload Photo:</label>
              <input
                type="file"
                id="photo"
                name="photo"
                accept="image/*"
                onChange={handlePhotoChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number:</label>
              <input
                type="text"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="Enter your phone number"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Role:</label>
              <p className="form-input readonly">{formData.userRole === "Approved" ? "User" : formData.userRole}</p>
            </div>

            {formData.userRole === "Visitor" && (
              <div className="form-group">
                <label htmlFor="secretKey">Secret Key:</label>
                <input
                  type="text"
                  id="secretKey"
                  name="secretKey"
                  value={formData.secretKey || ""}
                  onChange={handleInputChange}
                  placeholder="Enter your secret key"
                  className="form-input"
                />
                <div>
                  {codestatus ? (
                    <div>
                      <br />
                      <p> {codestatus ?? "N/A"}</p>
                    </div>
                  ) : (
                    <p></p>
                  )}
                </div>
                <button
                  onClick={invokeLambda}
                  className="save-button"
                  disabled={isLoading || roleLoading}
                > 
                  Verify Code
                </button>
              </div> 
            )}

            {formData.userRole === "Student" && (
              <>
                <div className="form-group">
                  <label htmlFor="id">Student ID:</label>
                  <input
                    type="text"
                    id="id"
                    name="id"
                    value={formData.id}
                    onChange={handleInputChange}
                    placeholder="Enter your Student ID"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="gpa">GPA:</label>
                  <input
                    type="number"
                    id="gpa"
                    name="gpa"
                    value={formData.gpa}
                    onChange={handleInputChange}
                    placeholder="Enter your GPA"
                    min="0"
                    max="4"
                    step="0.1"
                    className="form-input"
                  />
                </div>
                <div>
                      <br />
                      <p> {"Please Contact Us to Gain Access to Expirements."}</p>
                </div>
              </>
            )}
            <div className="form-group">
              <button
                onClick={() => {
                  console.log("Save button clicked");
                  saveProfile();
                }}
                className="save-button"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Profile"}
              </button>
              <button
                onClick={cancelEdit}
                className="save-button cancel-button"
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;