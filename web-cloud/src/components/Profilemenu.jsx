import { useState, useEffect, useRef } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { fetchAuthSession } from "@aws-amplify/auth";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { useNavigate } from "react-router-dom";
import defaultAvatar from "../assets/user.png";
import "./Profilemenu.css";
import { useCognitoGroup } from "../auth/hooks/getRole";

const Profilemenu = () => {
  const { user, signOut } = useAuthenticator();
  const [userProfile, setUserProfile] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const { userRole, loading, error } = useCognitoGroup();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();


  // Fetch user profile from ProfileTable
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        const credentials = session.credentials;
        const identityId = session.identityId;

        const dbClient = new DynamoDBClient({
          region: "eu-west-3",
          credentials,
        });

        const params = {
          TableName: "ProfileTable",
          KeyConditionExpression: "IdentityID = :id",
          ExpressionAttributeValues: {
            ":id": { S: identityId },
          },
        };

        const response = await dbClient.send(new QueryCommand(params));

        if (response.Items && response.Items.length > 0) {
          const item = response.Items[0];
          setUserProfile({
            name: item.name?.S || "Unknown User",
            role: userRole,
            photo: item.photo?.S || defaultAvatar,
          });
        } else {
          setUserProfile({
            name: user.attributes?.name || "Unknown User",
            role: userRole,
            photo: defaultAvatar,
          });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setUserProfile({
          name: user.attributes?.name || "Unknown User",
          role: userRole,
          photo: defaultAvatar,
        });
      }
    };

    fetchProfile();
  }, [user, userRole]);

  
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle profile picture click to toggle dropdown or navigate
  const handleProfileClick = () => {
    setIsOpen((prev) => !prev); // Toggle dropdown
  };

  // Handle My Profile button click
  const handleProfileButtonClick = () => {
    navigate("/Profile");
    setIsOpen(false);
  };

  // Handle Order the Queue button click
  const handleOrderClick = () => {
    navigate("/QuadrotorCtrl");
    setIsOpen(false);
  };
  const handleOrderClick2 = () => {
    navigate("/PendulumCtrl");
    setIsOpen(false);
  };
  const handleOrderClick3 = () => {
    navigate("/datavisibility");
    setIsOpen(false);
  };

  const handleOrderClick4 = () => {
    navigate("/FeedbackResponse");
    setIsOpen(false);
  };
    const handleOrderClick5 = () => {
    navigate("/Progresspage");
    setIsOpen(false);
  };
    const handleOrderClick6 = () => {
    navigate("/InvProgresspage");
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <div className="profile-dropdown-container" ref={dropdownRef}>
      <img
        src={userProfile?.photo || defaultAvatar}
        alt="Profile"
        className="profile-pic"
        onClick={handleProfileClick}
      />
      {isOpen && (
        <div className="profile-dropdown">
          <img
            src={userProfile?.photo || defaultAvatar}
            alt="Profile"
            className="dropdown-profile-pic"
          />
          <p className="dropdown-name">{userProfile?.name}</p>
          <p className="dropdown-role">
            {userProfile?.role === "Visitor" //Approved
              ? "User"
              : userProfile?.role
                ? userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)
                : "Unknown"}
          </p>
          <button className="dropdown-order" onClick={handleProfileButtonClick}>
            My Profile
          </button>
          {userProfile?.role === "Visitor" && (  //Admin
            <button className="dropdown-order" onClick={handleOrderClick}>
              Quadrotor Control
            </button>
          )}
          
          {userProfile?.role === "Visitor" && (  //Admin
            <button className="dropdown-order" onClick={handleOrderClick2}>
              Pendulum Control
            </button>
          )}

          {userProfile?.role === "Visitor" && (  //Admin
            <button className="dropdown-order" onClick={handleOrderClick3}>
              Data Control
            </button>
          )}

          {userProfile?.role === "Visitor" && (  //Admin
            <button className="dropdown-order" onClick={handleOrderClick4}>
              Feedback response         
             </button>
          )}

          <button className="dropdown-order" onClick={handleOrderClick5}>
            Quadrotor Results
          </button>
          <button className="dropdown-order" onClick={handleOrderClick6}>
            Pendulum Results
          </button>
          <button className="dropdown-signout" onClick={signOut}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};


export default Profilemenu;