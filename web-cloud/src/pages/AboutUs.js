import React from "react";
import { Button, Card, Heading, Text } from "@aws-amplify/ui-react";
import "./AboutUs.css"; // Import the updated CSS file
import { Helmet } from "react-helmet-async";
import eye from "../assets/eye.png"
import goaling from "../assets/mission.png"
import Footer from "../layout/footer";
const AboutUs = () => {

  return (
    <div>
      <div id="container">
        {/* Welcome Section */}
        <Helmet>
          <title>CoTune</title>
        </Helmet>
        {/* Who Are We Section */}

        <section className="section who-we-are">
          <Card className="info-card">
            <Heading level={2} color="var(--text-primary)">
              Who Are We?
            </Heading>
            <Text color="var(--text-secondary)">
              Cotune is a team of engineering students from Ain Shams
              University, dedicated to making control system education more
              practical and accessible. We are building a platform that allows
              students to focus on mastering control algorithms without worrying
              about mechanical design.
            </Text>
          </Card>
        </section>

        {/* Our Vision Section */}
        <section className="section vision">
          <Card className="info-card">
            <Heading level={2} color="var(--text-primary)">
              Our Vision
            </Heading>
            {/* <img src={eye} alt="EYE" className="eye"></img> */}
            <p></p>
            <Text color="var(--text-secondary)">
              We believe that learning control systems should be hands-on,
              engaging, and available to everyone. Our vision is to create a
              fully interactive learning environment where students can
              implement control algorithms and optimize performance.
            </Text>
          </Card>
        </section>

        {/* Our Goal Section */}
        <section className="section goal">
          <Card className="info-card">
            <Heading level={2} color="var(--text-primary)">
              Our Goal
            </Heading>
              {/* <img src={goalimg} alt="goalimg" className="goalimg"></img> */}
            <p></p>
            <Text color="var(--text-secondary)">
              Cotune is more than just a learning tool, it’s a practical
              simulation-based lab designed to help students gain real-world
              experience in control system implementation.
            </Text>
          </Card>
        </section>

      </div>
    </div>
  );
};

export default AboutUs;
