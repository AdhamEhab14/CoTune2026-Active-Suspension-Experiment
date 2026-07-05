import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Queue.css";
import quadrotorImg1 from "../assets/realQuadrotor.png"; // Quadrotor image
import pendulumImg1 from "../assets/realPendulum.png"; // Pendulum image
import suspensionImg1 from "../assets/realSuspension.png"; // Suspension image
import furutaImg1 from "../assets/realFuruta.png"; // Furuta image
import { Helmet } from "react-helmet-async";

const quadrotorImg2 = process.env.PUBLIC_URL + "/quadrotor.png"; // Quadrotor icon
const pendulumImg2 = process.env.PUBLIC_URL + "/pendulum.png"; // Pendulum icon
// const suspensionImg2 = process.env.PUBLIC_URL + "/suspension.png"; // Suspension icon
// const furutaImg2 = process.env.PUBLIC_URL + "/furuta.png"; // Furuta icon

const ExperimentSelector = () => {
  const [isFlipped, setIsFlipped] = useState(false); // Kept for potential future use
  const navigate = useNavigate();

  // Function to navigate when image or button is clicked
  const handleImageClick = (path) => {
    navigate(path);
  };

  return (
    <section>
      <div className="background">
        <div className="experiment-selector">
          <Helmet>
            <title>Choose Simulation</title>
          </Helmet>
          <h1>Choose a Simulation</h1>

          <div className="flip-container">
            <div className="cardfront">
              <h2>Quadrotor</h2>
              <img
                src={quadrotorImg1}
                alt="Quadrotor"
                className="experiment-img"
                onClick={() => handleImageClick("/QuadrotorSim")}
              />
            </div>

            <div className="cardback">
              <h2>Inverted Pendulum</h2>
              <img
                src={pendulumImg1}
                alt="Inverted Pendulum"
                className="experiment-img"
                onClick={() => handleImageClick("/PendulumSim")}
              />
            </div>

            <div className="cardfront">
              <h2>Active Suspension</h2>
              <img
                src={suspensionImg1}
                alt="Suspension"
                className="experiment-img"
                onClick={() => handleImageClick("/SuspensionSim")}
              />
            </div>

            <div className="cardback">
              <h2>Furuta</h2>
              <img
                src={furutaImg1}
                alt="Furuta"
                className="experiment-img"
                onClick={() => handleImageClick("/FurutaSim")}
              />
            </div>
          </div>

          {/* <div className="button-container">
            <button
              className="btn icon-btn"
              onClick={() => handleImageClick("/QuadrotorPage")}
            >
              <img src={quadrotorImg1} alt="Quadrotor Icon" className="icon-img" />
            </button>
            <button
              className="btn icon-btn"
              onClick={() => handleImageClick("/PendulumPage")}
            >
              <img src={pendulumImg1} alt="Pendulum Icon" className="icon-img" />
            </button>
          </div> */}

          {/* Kept commented-out code for reference */}
          {/* <FlipCard frontImgPath={quadrotorImg1} backImgPath={quadrotorImg2} text={"Quadrotor"} path={"/Pubsub"}></FlipCard>
          <FlipCard frontImgPath={pendulumImg1} backImgPath={pendulumImg2} text={"Pendulum"} path={"/Inv"}></FlipCard> */}
        </div>
      </div>
    </section>
  );
};

export default ExperimentSelector;
