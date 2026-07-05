import { useState, useEffect } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { fetchAuthSession } from "@aws-amplify/auth";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Amplify } from "aws-amplify";

import awsExports from "../aws-exports"; // Adjust if needed
import "./App.css";
import TiltedCard from "../components/TiltedCard";
import CustomButton from "../components/CustomButton";

import tuningimg from "../assets/tuning2.png";
import lessonsimg from "../assets/interactive.png";

Amplify.configure(awsExports);

const REGION = "eu-west-3";

function App() {
  const { user } = useAuthenticator();
  const navigate = useNavigate();

  const [userName, setUserName] = useState("Guest");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddProfile, setShowAddProfile] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        console.debug("No user available.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const session = await fetchAuthSession({ forceRefresh: true });
        const identityId = session.identityId;
        const credentials = session.credentials;

        if (!identityId || !credentials) {
          throw new Error("Missing identity ID or credentials.");
        }

        const dbClient = new DynamoDBClient({ region: REGION, credentials });
        const docClient = DynamoDBDocumentClient.from(dbClient);

        const params = {
          TableName: "ProfileTable",
          KeyConditionExpression: "IdentityID = :id",
          ExpressionAttributeValues: {
            ":id": identityId,
          },
        };

        const response = await docClient.send(new QueryCommand(params));

        if (response.Items && response.Items.length > 0) {
          const profile = response.Items[0];
          setUserName(profile.name || "Guest");
        } else {
          console.warn("No profile found.");
          setShowAddProfile(true);
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
        setError(`Failed to load profile: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleImageClick = (path) => {
    navigate(path);
  };

  return (
    <div className="app-container">
      <Helmet>
        <title>Home - Cotune</title>
      </Helmet>

      <section className="section hero">
        {isLoading && <p>Loading...</p>}
        {error && <p className="error">{error}</p>}

        
        
        {!showAddProfile && (
          <div className="ttt">
         <h1 className="welcome-text">Welcome, {userName}!</h1>

          </div>
        )}
        {showAddProfile && (
          <div className="addprofilecontainer">
            
            <button
              className="add-profile-btn"
              onClick={() => navigate("/profile")}
            >
              Add Profile
            </button>
            <p>
  🚫 No profile data found. <br />
  <strong>Create your profile now</strong> to unlock powerful features like saving your experiment data and tracking your progress. Don’t miss out!
</p>
          </div>
        )}

        <div className="curlybox-1">
          <div className="tuning-page">
            <TiltedCard
              imageSrc={tuningimg}
              altText="Tuning Sessions"
              captionText="Go to Tuning"
              containerHeight="250px"
              containerWidth="250px"
              onClick={() => handleImageClick("/SelectExp")}
            />
            <div className="btn1">
              <CustomButton text="Choose an experiment" path="/SelectExp" />
            </div>
          </div>

          <div className="lessons-page">
            <TiltedCard
              imageSrc={lessonsimg}
              altText="Interactive Lessons"
              captionText="Explore Lessons"
              containerHeight="250px"
              containerWidth="250px"
              onClick={() => handleImageClick("/Lessons")}
            />
            <div className="btn2">
              <CustomButton text="Explore Lessons" path="/Lessons" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
