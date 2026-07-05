import React from "react";
import { Button, Card, Heading, Text } from "@aws-amplify/ui-react";
import "./Home.css";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import eye from "../assets/eye.png";
import goaling from "../assets/mission.png";
import exp from "../assets/experiments.png";
import heroGif from "../assets/output-onlinegiftools.gif"; // Import the GIF
import heroGif2 from "../assets/pid-ezgif.com-optimize.gif"; // Import the GIF
import invertedpendulem from "../assets/inverted-ezgif.com-crop.gif"; // Import the GIF
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Footer from "../layout/footer";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div id="container">
            <Helmet>
              <title>CoTune</title>
            </Helmet>
      {/* Hero Section */}
      <section className="section hero-section">
        <div className="content info-card">
          <h1 className="title">Welcome to Control Lab</h1>
          <p className="subtitle">
            A cutting-edge platform where you can interact with real physical experiments like 2DoF Hover, Inverted Pendulum, Active Suspension and Furuta—anytime, anywhere.
          </p>
          <img src={heroGif} alt="Control Lab Animation" className="hero-gif" />
        </div>
      </section>

      {/* About Section Part 1: Purpose */}
      <section className="section part2">
       <div className="simulation-content">
        <img src={invertedpendulem} alt="PID Animation" className="inverted-gif" />
        <div className="content info-card">
          <h2 className="title">Master Control, Hands-On</h2>
          <p className="subtitle">
            Step into Control Lab—a revolutionary space where theory meets reality. Here, you don’t just learn control techniques; you apply them. From cascaded PID for quadrotors to LQR for stabilizing an inverted pendulum, our platform empowers you to command real experiments with precision and confidence.
          </p>
        </div>
        </div>
        
      </section>

      {/* About Section Part 2: Simulation */}
      <section className="section simulation-section">
        <div className="simulation-content">
          <div className="content info-card">
            <h2 className="title">Simulate, Tweak, Succeed</h2>
            <p className="subtitle">
              Start with our advanced simulations. Adjust parameters, experiment with URDF models, and visualize the outcomes in real-time. Whether you’re fine-tuning a PID loop or optimizing an LQR controller, see how your choices play out—before taking them to the physical world.
            </p>
          </div>
          <img src={heroGif2} alt="PID Animation" className="hero2-gif" />
        </div>
      </section>

      {/* About Section Part 3: Real-World Control */}
      <section className="section">
        <div className="content info-card">
          <h2 className="title">From Screen to Reality</h2>
          <p className="subtitle">
            Ready to test your skills? Once your simulation shines, deploy your parameters to our real hardware. Watch your control strategies come to life through live streams—2DoF Hover soaring or Inverted Pendulum balancing or active suspension controlling or rotary inverted pendulum stabilizing, anywhere-accessible experience.
          </p>
        </div>
      </section>

      {/* Experiments Section */}
      <section className="section">
        <div className="content info-card">
          <h2 className="title">Our Experiments</h2>
          <div className="experiment-grid">

<div>
            <div className="experiment-item">
              <div className="experiment-image two-dof-hover"></div>
              <p className="subtitle">Quadrotor</p>
            </div>

            <div className="experiment-item">
              <div className="experiment-image active-suspension"></div>
              <p className="subtitle">Active Suspension</p>
            </div>
</div>
<div>
            <div className="experiment-item">
              <div className="experiment-image inverted-pendulum"></div>
              <p className="subtitle">Inverted Pendulum</p>
            </div>

            <div className="experiment-item">
              <div className="experiment-image rotary-inverted-pendulum"></div>
              <p className="subtitle">Rotary Inverted Pendulum</p>
            </div>
</div>
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section className="section">
        <div className="content info-card">
          <h2 className="title">Ready to Dive In?</h2>
          <p className="subtitle">
            Start exploring real experiments today with just a few clicks.
          </p>
          <button
            onClick={() => navigate('/Main')}
            className="cta-button"
          >
            Get Started
          </button>
        </div>
      </section>
    </div>
  );
};

export default Home;