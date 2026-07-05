import { useAuthenticator } from "@aws-amplify/ui-react";
import "./App.css"; // Ensure your styles are applied
import { Link } from "react-router-dom"; // Import Link and useNavigate
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import TiltedCard from "../components/TiltedCard.jsx";
import tuningImage from "../assets/tuning.jpg";
import interactiveImage from "../assets/interactive.png";

// import DecryptedText from "./components/DecryptedText";

function App() {
  const { user, signOut } = useAuthenticator();
  const navigate = useNavigate();

  const handleImageClick = (path) => {
    navigate(path);
  };
  return (
    <main>
      <Helmet>
        <title>Home</title>
      </Helmet>

      {/* Learn by Doing Section */}
      <section className="learn-by-doing">

        
        
        {/*   <h1>Master Concepts Through Practice</h1>*/}
        <section className="activities">
          {/* <div className="activity tuning" onClick={() => handleImageClick("/Queue")}>
            <h2>Tuning Sessions</h2>
          </div>

          <div className="activity interactive"  onClick={() => handleImageClick("/Interactive")}>
            <h2>Interactive Lessons</h2>
          </div> */}

          <div className="grid-container">
            <TiltedCard
              imageSrc= {tuningImage}
              altText="not found"
              captionText="Tuning Sessions"
              containerHeight="400px"
              containerWidth="400px"
              imageHeight="250px"
              imageWidth="250px"
              rotateAmplitude={12}
              scaleOnHover={1.2}
              showMobileWarning={false}
              showTooltip={true}
              displayOverlayContent={true}
              overlayContent={
                <p className="tilted-card-demo-text">
                </p>
                
              }
              onClick={() => handleImageClick("/Queue")}
              
            />



            <TiltedCard
              imageSrc= {interactiveImage}
              altText="not found"
              captionText="interactive Sessions"
              containerHeight="400px"
              containerWidth="400px"
              imageHeight="250px"
              imageWidth="250px"
              rotateAmplitude={12}
              scaleOnHover={1.2}
              showMobileWarning={false}
              showTooltip={true}
              displayOverlayContent={true}
              overlayContent={
                <p className="tilted-card-demo-text">
                </p>
              }
              onClick={() => handleImageClick("/Interactive")}
            />
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
