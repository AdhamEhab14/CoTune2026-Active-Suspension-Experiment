import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthSession } from "@aws-amplify/auth";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import "./Feedback.css";

const REGION = "eu-west-3";

function FeedbackPage() {
  const [credentials, setCredentials] = useState(null);
  const [identityId, setIdentityId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
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
        setIdentityId(session.identityId);
        console.log("Credentials found");
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

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!credentials || !identityId) {
      setError("AWS credentials or IdentityID not initialized");
      return;
    }
    if (!message.trim()) {
      setError("Feedback message is required");
      return;
    }
    if (message.length > 500) {
      setError("Feedback must be 500 characters or less");
      return;
    }

    const dbClient = new DynamoDBClient({ region: REGION, credentials });
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const timestamp = new Date().toISOString();
    const dbParams = {
      TableName: "feedback",
      Item: {
        identityId: { S: identityId },
        timestamp: { S: timestamp },
        message: { S: message.trim() },
      },
    };

    try {
      await dbClient.send(new PutItemCommand(dbParams));
      if (isMounted.current) {
        setSuccess("Feedback submitted successfully!");
        setMessage("");
        setTimeout(() => {
          if (isMounted.current) {
            setSuccess(null);
            navigate("/");
          }
        }, 2000);
      }
    } catch (err) {
      console.error("Error saving feedback:", err);
      if (isMounted.current) {
        setError(`Failed to submit feedback: ${err.message} (${err.code || "Unknown"})`);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // Handle message input change
  const handleMessageChange = (e) => {
    setMessage(e.target.value);
    if (error) setError(null);
  };

  return (
    <div className="pa">
    <div className="feedback-page">
      <h1>Send Feedback</h1>
      <p>We value your input! Please share your thoughts or suggestions below.</p>

      {isLoading && (
        <p className="loading">
          <span className="spinner"></span> Submitting...
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <form onSubmit={handleSubmit} className="feedback-form">
        <div className="form-group">
          <label htmlFor="message">Your Feedback</label>
          <textarea
            id="message"
            value={message}
            onChange={handleMessageChange}
            placeholder="Enter your feedback here (max 500 characters)"
            maxLength={500}
            rows={5}
            disabled={isLoading}
          />
          <p className="char-count">{message.length}/500 characters</p>
        </div>
        <div className="button-group">
          <button
            type="submit"
            className="submit-button"
            disabled={isLoading || !message.trim()}
          >
            Submit Feedback
          </button>
          <button
            type="button"
            className="cancel-button"
            onClick={() => navigate("/")}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
    </div>
    
  );
}

export default FeedbackPage;