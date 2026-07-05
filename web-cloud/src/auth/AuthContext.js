// src/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchAuthSession } from "@aws-amplify/auth";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [role, setRole] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const REGION = "eu-west-3";

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        if (!session.credentials || !session.identityId) {
          throw new Error("No credentials or identityId found");
        }

        const dbClient = new DynamoDBClient({
          region: REGION,
          credentials: session.credentials,
        });

        const params = {
          TableName: "ProfileTable",
          KeyConditionExpression: "IdentityID = :id",
          ExpressionAttributeValues: {
            ":id": { S: session.identityId },
          },
        };

        const response = await dbClient.send(new QueryCommand(params));
        if (response.Items && response.Items.length > 0) {
          const item = response.Items[0];
          const fetchedProfile = {
            userRole: item.userRole?.S || "",
            nationalId: item.NationalID?.S || "",
            name: item.name?.S || "",
          };
          setProfile(fetchedProfile);
          setRole(fetchedProfile.userRole); // <-- 👈 this is crucial
        } else {
          setProfile({ userRole: "", nationalId: "", name: "" });
          setRole(""); // still set something
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const isComplete = profile?.nationalId && profile?.userRole;

  return (
    <AuthContext.Provider value={{ role, setRole, profile, isLoading, isComplete, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
