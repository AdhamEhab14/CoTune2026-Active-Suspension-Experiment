import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthSession } from "@aws-amplify/auth";
import { Helmet } from "react-helmet-async";

import { DynamoDBClient, ScanCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import "./FeedbackResponse.css";

const REGION = "eu-west-3";

function FeedbackResponse() {
  const [credentials, setCredentials] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);
  const navigate = useNavigate();

  // Initialize AWS credentials
  useEffect(() => {
    const initializeAWS = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        if (!session.credentials) {
          throw new Error("No credentials found in session");
        }
        setCredentials(session.credentials);
      } catch (err) {
        console.error("Error initializing AWS:", err);
        if (isMounted.current) {
          setError("Failed to initialize AWS credentials: " + err.message);
        }
      }
    };
    initializeAWS();

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch feedback and user data
  useEffect(() => {
    const fetchFeedback = async () => {
      if (!credentials) return;

      setIsLoading(true);
      setError(null);

      const dbClient = new DynamoDBClient({ region: REGION, credentials });

      try {
        // Scan feedback table to get all items
        const feedbackParams = {
          TableName: "feedback",
          Limit: 50, // Limit to 50 feedbacks for performance
        };

        const feedbackResult = await dbClient.send(new ScanCommand(feedbackParams));
        let feedbackItems = feedbackResult.Items?.map((item) => unmarshall(item)) || [];

        // Sort feedback by timestamp in descending order
        feedbackItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Fetch user details for each feedback
        const enrichedFeedbacks = await Promise.all(
          feedbackItems.map(async (feedback) => {
            let userName = "Anonymous";
            let userEmail = "N/A";

            // Query ProfileTable for user name
            try {
              const profileParams = {
                TableName: "ProfileTable",
                KeyConditionExpression: "IdentityID = :id and NationalID = :nid",
                ExpressionAttributeValues: {
                  ":id": { S: feedback.identityId },
                  ":nid": { S: feedback.identityId }, // NationalID contains IdentityID
                },
              };
              const profileResult = await dbClient.send(new QueryCommand(profileParams));
              const profile = profileResult.Items?.[0]
                ? unmarshall(profileResult.Items[0])
                : null;
              if (profile?.name) {
                userName = profile.name;
              }
            } catch (err) {
              console.error(`Error fetching profile for ${feedback.identityId}:`, err);
            }

            // Fetch user email using identityId
            try {
              const session = await fetchAuthSession({ forceRefresh: false });
              if (session.identityId === feedback.identityId) {
                userEmail = session.tokens?.idToken?.payload?.email || "N/A";
              }
            } catch (err) {
              console.error(`Error fetching email for ${feedback.identityId}:`, err);
            }

            return {
              ...feedback,
              userName,
              userEmail,
            };
          })
        );

        if (isMounted.current) {
          setFeedbacks(enrichedFeedbacks);
        }
      } catch (err) {
        console.error("Error fetching feedback:", err);
        if (isMounted.current) {
          setError(`Failed to fetch feedback: ${err.message} (${err.code || "Unknown"})`);
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    fetchFeedback();
  }, [credentials]);

  return (
    <div className="pa">
      <Helmet>
        <title>Feedback Response</title>
      </Helmet>
      <div className="feedback-response-page">
        <h1>Feedback Responses</h1>
        <p>View all feedback submitted by users.</p>

        {isLoading && (
          <p className="loading">
            <span className="spinner"></span> Loading...
          </p>
        )}
        {error && <p className="error">{error}</p>}

        {feedbacks.length === 0 && !isLoading && !error && (
          <p>No feedback available.</p>
        )}

        {feedbacks.length > 0 && (
          <div className="feedback-list">
            {feedbacks.map((feedback, index) => (
              <div key={index} className="feedback-item">
                <p><strong>Name:</strong> {feedback.userName}</p>
                {/* <p><strong>Email:</strong> {feedback.userEmail}</p> */}
                <p><strong>Message:</strong> {feedback.message}</p>
                <p><strong>Submitted:</strong> {new Date(feedback.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="back-button"
          onClick={() => navigate("/")}
          disabled={isLoading}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default FeedbackResponse;