// src/hooks/useProfile.js
import { useState, useEffect } from "react";
import { fetchAuthSession } from "@aws-amplify/auth";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { ConsoleLogger } from "aws-amplify/utils";

const REGION = "eu-west-3";
const defaultProfile = {
  userRole: "",
  nationalId: "",
  name: "",
};

const useProfile = () => {
  const [profile, setProfile] = useState(defaultProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
          setProfile({
            userRole: item.userRole?.S || "",
            nationalId: item.NationalID?.S || "",
            name: item.name?.S || "",
          });
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

  const isComplete = !!profile.name;

  return { profile, isComplete, isLoading, error };
};


export default useProfile;