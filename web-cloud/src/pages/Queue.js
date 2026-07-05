import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Queue.css";
import quadrotorImg1 from "../assets/realQuadrotor.png"; // Quadrotor image
import pendulumImg1 from "../assets/realPendulum.png"; // Pendulum image
import suspensionImg1 from "../assets/realSuspension.png"; // Suspension image
import furutaImg1 from "../assets/realFuruta.png"; // Furuta image
import { Helmet } from "react-helmet-async";

const quadrotorImg2 = process.env.PUBLIC_URL + "/assets/quadrotor.png"; // Quadrotor icon
const pendulumImg2 = process.env.PUBLIC_URL + "/assets/pendulum.png"; // Pendulum icon
// const suspensionImg2 = process.env.PUBLIC_URL + "/assets/suspension.png"; // Suspension icon
// const furutaImg2 = process.env.PUBLIC_URL + "/assets/furuta.png"; // Furuta icon

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
            <title>Choose Experiment</title>
          </Helmet>
          <h1>Choose an Experiment</h1>

          <div className="flip-container">
            <div className="cardfront">
              <h2>Quadrotor</h2>
              <img
                src={quadrotorImg1}
                alt="Quadrotor"
                className="experiment-img"
                onClick={() => handleImageClick("/QuadrotorPage")}
              />
            </div>

            <div className="cardback">
              <h2>Inverted Pendulum</h2>
              <img
                src={pendulumImg1}
                alt="Inverted Pendulum"
                className="experiment-img"
                onClick={() => handleImageClick("/PendulumPage")}
              />
            </div>

            <div className="cardback">
              <h2>Active Suspension</h2>
              <img
                src={suspensionImg1}
                alt="Active Suspension"
                className="experiment-img"
                onClick={() => handleImageClick("/SuspensionPage")}
              />
            </div>

            <div className="cardback">
              <h2>Furuta</h2>
              <img
                src={furutaImg1}
                alt="Furuta"
                className="experiment-img"
                onClick={() => handleImageClick("/FurutaPage")}
              />
            </div>
          </div>

          {/* <div className="button-container">
            <button
              className="btn icon-btn"
              onClick={() => handleImageClick("/QuadrotorPage")}
            >
              <img src={quadrotorImg2} alt="Quadrotor Icon" className="icon-img" />
            </button>
            <button
              className="btn icon-btn"
              onClick={() => handleImageClick("/PendulumPage")}
            >
              <img src={pendulumImg2} alt="Pendulum Icon" className="icon-img" />
            </button>
          </div> */}

          {/* Kept commented-out code for reference */}
          {/* <FlipCard frontImgPath={quadrotorImg2} backImgPath={quadrotorImg1} text={"Quadrotor"} path={"/Pubsub"}></FlipCard>
          <FlipCard frontImgPath={pendulumImg2} backImgPath={pendulumImg1} text={"Pendulum"} path={"/Inv"}></FlipCard> */}
        </div>
      </div>
    </section>
  );
};

export default ExperimentSelector;
