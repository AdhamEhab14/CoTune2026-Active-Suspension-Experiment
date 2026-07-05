import React, { useState, useEffect } from "react";
import { useWindowWidth } from "../../breakpoints";
import { useLocation } from "react-router-dom";
import { ButtonsSim } from "../../components/ButtonsSim";
import { Footer } from "../../../layout/footer";
import { Graphsim } from "../../components/Graphsim";
import { Results } from "../../components/Results/Results";
import { NavBar } from "../../components/NavBar";
import { NavBar_2 } from "../../components/NavBar_2";
import { Next } from "../../components/Next/Next";
import { Parametersim } from "../../components/Parametersim";
import { Parametersnewand } from "../../components/Parametersnewand";
import { SimulationStreaming } from "../../components/SimulationStreaming";
import { Amplify } from "aws-amplify";
import awsConfig from "../../aws-export";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "./style.css";
import { simulate } from "../../components/2DOF_Model";
import { Authenticator } from "@aws-amplify/ui-react";

Amplify.configure(awsConfig);

export const HoverSimcomponent = () => {
  const location = useLocation();
  const screenWidth = useWindowWidth();
  const [scrollToTop, setScrollToTop] = useState(false);
  const [isCriteriaMet, setIsCriteriaMet] = useState(false); // State to track if criteria are met

  const [Xovershoot, setXovershoot] = useState(0);
  const [Yovershoot, setYovershoot] = useState(0);
  const [XError, setXError] = useState(0);
  const [YError, setYError] = useState(0);
  const [xtime, setXtime] = useState(0);
  const [ytime, setYtime] = useState(0);

  useEffect(() => {
    if (location.pathname === "/") {
      // Scroll to the top of the page when the route changes to "/"
      window.scrollTo(0, 0);
      setScrollToTop(true);
    } else {
      setScrollToTop(false);
    }
  }, [location.pathname]);


  const [SimulationPoints, setSimulationPoints] = useState(null);
  const [Simulation, setSimulation] = useState(null);
  const [ParameterData, setParameterData] = useState(null);

  const GraphAndSimulate = () => {
    try {
      const Sim = simulate(ParameterData);
      console.log("Points:", Sim);
      setSimulationPoints(Sim);
      console.log("Sim:", Sim);
  
    // Calculate overshoot
    const XovershootResult = calculateOvershoot(Sim.XPos, ParameterData.xposSet);
    const YovershootResult = calculateOvershoot(Sim.YPos, ParameterData.yposSet);
  
    // Calculate errors
    const newXError = Math.abs(ParameterData.xposSet - Sim.XPos[1999]);
    const newYError = Math.abs(ParameterData.yposSet - Sim.YPos[1999]);
  
    // Calculate times
    const newXtime = XovershootResult.indexOfFirstZeroCrossing * 0.005;
    const newYtime = YovershootResult.indexOfFirstZeroCrossing * 0.005;
  
    // Set state with calculated values
    setXovershoot(XovershootResult.overshoot);
    setYovershoot(YovershootResult.overshoot);
    setXError(newXError);
    setYError(newYError);
    setXtime(newXtime);
    setYtime(newYtime);
  
    console.log("XovershootResult:", XovershootResult);
    console.log("YovershootResult:", YovershootResult);
    console.log("XError:", newXError);
    console.log("YError:", newYError);
    console.log("xtime:", newXtime);
    console.log("ytime:", newYtime);
  
    // Check if overshoot is less than 0.1
    if (newXError < 0.01 && newYError < 0.01) {
      if (Math.abs(XovershootResult.overshoot) < 0.03 && Math.abs(YovershootResult.overshoot) < 0.03) {
        // Calculate variance
        const Xvariance = calculateVariance(Sim.XPos, ParameterData.xposSet);
        const Yvariance = calculateVariance(Sim.YPos, ParameterData.yposSet);
  
        // Check if variance is less than 0.1
        if (Xvariance < 0.1 && Yvariance < 0.1) {
          setIsCriteriaMet(true); // Set criteria met
        } else {
          setIsCriteriaMet(false); // Reset criteria met
          alert("Variance criterion not met. Adjust PID parameters.");
          console.log(Xvariance);
          console.log(Yvariance);
        }
      } else {
        setIsCriteriaMet(false); // Reset criteria met
        alert("Overshoot criterion not met. Adjust PID parameters.");
        console.log(XovershootResult.overshoot);
        console.log(YovershootResult.overshoot);
      }
    } else {
      setIsCriteriaMet(false); // Reset criteria met
      alert("Steady State Error Too Big criterion not met. Adjust PID parameters.");
      console.log(newXError);
      console.log(newYError);
    }
    } catch (e) {
      const Sim = simulate(ParameterData);
      console.log("Points:", Sim);
      setSimulationPoints(Sim);
      console.log("Sim:", Sim);
  
    // Calculate overshoot
    const XovershootResult = calculateOvershoot(Sim.XPos, ParameterData.xposSet);
    const YovershootResult = calculateOvershoot(Sim.YPos, ParameterData.yposSet);
  
    // Calculate errors
    const newXError = Math.abs(ParameterData.xposSet - Sim.XPos[1999]);
    const newYError = Math.abs(ParameterData.yposSet - Sim.YPos[1999]);
  
    // Calculate times
    const newXtime = XovershootResult.indexOfFirstZeroCrossing * 0.005;
    const newYtime = YovershootResult.indexOfFirstZeroCrossing * 0.005;
  
    // Set state with calculated values
    setXovershoot(XovershootResult.overshoot);
    setYovershoot(YovershootResult.overshoot);
    setXError(newXError);
    setYError(newYError);
    setXtime(newXtime);
    setYtime(newYtime);
  
    console.log("XovershootResult:", XovershootResult);
    console.log("YovershootResult:", YovershootResult);
    console.log("XError:", newXError);
    console.log("YError:", newYError);
    console.log("xtime:", newXtime);
    console.log("ytime:", newYtime);
  
    // Check if overshoot is less than 0.1
    if (newXError < 0.01 && newYError < 0.01) {
      if (Math.abs(XovershootResult.overshoot) < 0.03 && Math.abs(YovershootResult.overshoot) < 0.03) {
        // Calculate variance
        const Xvariance = calculateVariance(Sim.XPos, ParameterData.xposSet);
        const Yvariance = calculateVariance(Sim.YPos, ParameterData.yposSet);
  
        // Check if variance is less than 0.1
        if (Xvariance < 0.1 && Yvariance < 0.1) {
          setIsCriteriaMet(true); // Set criteria met
        } else {
          setIsCriteriaMet(false); // Reset criteria met
          alert("Variance criterion not met. Adjust PID parameters.");
          console.log(Xvariance);
          console.log(Yvariance);
        }
      } else {
        setIsCriteriaMet(false); // Reset criteria met
        alert("Overshoot criterion not met. Adjust PID parameters.");
        console.log(XovershootResult.overshoot);
        console.log(YovershootResult.overshoot);
      }
    } else {
      setIsCriteriaMet(false); // Reset criteria met
      alert("Steady State Error Too Big criterion not met. Adjust PID parameters.");
      console.log(newXError);
      console.log(newYError);
    }
    }
  
    
  };

  const destroygraph = () => {
    console.log(1);
    const destroy = 5;
    setSimulation(destroy);
  };

  // Function to calculate overshoot
  const calculateOvershoot = (simData, setp) => {
    // Find the direction of movement based on the sign of the first point
    const initialSign = Math.sign(simData[0] - setp);

    // Initialize variables to track the index of the first zero crossing and the extreme value after crossing
    let indexOfFirstZeroCrossing = -1;
    let extremeValueAfterCrossing = null;

    // Iterate through the data to find the first zero crossing
    for (let i = 1; i < simData.length; i++) {
      // Check if the current point crosses zero from the initial sign
      if (Math.sign(simData[i] - setp) !== initialSign) {
        indexOfFirstZeroCrossing = i;
        break;
      }
    }

    // If no zero crossing is found, there's no overshoot
    if (indexOfFirstZeroCrossing === -1) {
      return { overshoot: 0, indexOfFirstZeroCrossing };
    }

    // Determine whether to look for the maximum or minimum value after the zero crossing
    const lookForMaxValue = initialSign === 1; // If initial sign is positive, look for maximum value

    // Find the extreme value after the zero crossing
    for (let i = indexOfFirstZeroCrossing; i < simData.length; i++) {
      // If looking for maximum value, update extremeValueAfterCrossing if current value is greater
      if (lookForMaxValue && (extremeValueAfterCrossing === null || simData[i] > extremeValueAfterCrossing)) {
        extremeValueAfterCrossing = simData[i] - setp;
      }
      // If looking for minimum value, update extremeValueAfterCrossing if current value is lesser
      else if (!lookForMaxValue && (extremeValueAfterCrossing === null || simData[i] < extremeValueAfterCrossing)) {
        extremeValueAfterCrossing = simData[i] - setp;
      }
    }

    // Calculate the overshoot as the difference between the extreme value and the initial set point
    return { overshoot: Math.abs(extremeValueAfterCrossing), indexOfFirstZeroCrossing };
  };

  // Function to calculate variance
  const calculateVariance = (simData, setp) => {
    // Find the direction of movement based on the sign of the first point
    const initialSign = Math.sign(simData[0] - setp);

    // Initialize variables to track the index of the first sign flip and the data after the flip
    let indexOfFirstSignFlip = -1;
    let dataAfterSignFlip = [];

    // Iterate through the data to find the first sign flip
    for (let i = 1; i < simData.length; i++) {
      // Check if the current point changes sign from the initial sign
      if (Math.sign(simData[i] - setp) !== initialSign) {
        indexOfFirstSignFlip = i;
        dataAfterSignFlip = simData.slice(indexOfFirstSignFlip + 1);
        break;
      }
    }

    // If no sign flip is found, return 0 variance
    if (indexOfFirstSignFlip === -1) return 0;

    // Calculate the mean of the data after the sign flip
    const mean = dataAfterSignFlip.reduce((acc, val) => acc + val, 0) / dataAfterSignFlip.length;

    // Calculate the squared differences from the mean
    const squaredDifferences = dataAfterSignFlip.map((val) => (val - mean) ** 2);

    // Calculate the variance
    const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / dataAfterSignFlip.length;

    return variance;
  };


  return (
    <Authenticator>
      {({ signOut, user }) => (
        <>
          <div className="hoversim"
            style={{
              width: { screenWidth }
            }}
          >
            {screenWidth >= 834 && screenWidth < 1300 && (
              <>
                <NavBar_2
                  onclick={signOut}
                  className="nav-bar-tab" />
                <SimulationStreaming
                  title="Simulation of Hover"
                  className="simulation-streaming-instance" />
                <div className="input1300">
                <Parametersim
                  setParameterData={setParameterData}
                  className="parameters-instance"
                  rollgroup="rollgroup1"
                  pitchgroup="pitchgroup1"
                  plantgroup="plantimg1"
                  arrow3="arrow1"
                  arrow4="arrow1" 
                />
                <ButtonsSim
                  GraphAndSimulate={GraphAndSimulate}
                  destroygraph={destroygraph}
                  className="buttons-instance"
                  startClassName="button-wrap"
                 />
                </div>
                <Graphsim
                  SimulationPoints={SimulationPoints}
                  Simulation={Simulation}
                  className="graphs-instance"
                />
                <Results
                  className="Resultsmid"
                  steadyStateErrorPitch={XError}
                  overshootPitch={Xovershoot}
                  settlingTimePitch={xtime}
                  steadyStateErrorRoll={YError}
                  overshootRoll={Yovershoot}
                  settlingTimeRoll={ytime}
                  />
                <Next
                  navigate="nav1"
                  linkTo1="/hover-realtime"
                  linkTo2="/Hover-Documentation/"
                  disable={!isCriteriaMet} // Disable Next button until criteria are met
                />
                <Footer
                  className="footer1"
                />
                <div style={{ height: 0 }}></div>
              </>
            )}

            {screenWidth >= 1300 && (
              <>
                <NavBar
                  onclick={signOut}
                  className="navbardoc"
                />
                <SimulationStreaming
                  title="Simulation of Hover"
                  className="simulation-streaming-2" />
                <div className="inputpb">
                <Parametersim
                  setParameterData={setParameterData}
                  className="parameters-2" />
                <ButtonsSim
                  className="SimulationPoints-2"
                  GraphAndSimulate={GraphAndSimulate}
                  destroygraph={destroygraph} />
                </div>  
                <Graphsim
                  SimulationPoints={SimulationPoints}
                  Simulation={Simulation}
                  className="graphs-17" />
                <Results
                  className="Results1300"
                  steadyStateErrorPitch={XError}
                  overshootPitch={Xovershoot}
                  settlingTimePitch={xtime}
                  steadyStateErrorRoll={YError}
                  overshootRoll={Yovershoot}
                  settlingTimeRoll={ytime}
                  />
                <Next
                  navigate="nav"
                  linkTo1="/hover-realtime"
                  linkTo2="/Hover-Documentation/"
                  disable={!isCriteriaMet} // Disable Next button until criteria are met
                />
                <Footer className="footerdoc" />
                <div style={{ height: 0 }}></div>
              </>
            )}

            {screenWidth < 834 && (
              <>
                <NavBar_2
                  onclick={signOut}
                  className="nav-bar-tab-instance"
                  controlchef1="logo1-control"
                  navbardrop="nav-bar-drop"
                  dropdowncontentexperiments="drop-down-exp"
                  dropdowncontenttheories="drop-down-theory"
                  navbartext="nav-bar-text"
                />
                <SimulationStreaming
                  title="Simulation of Hover"
                  className="simulation-streaming-3"
                  simulationStreamingClassName="titlesize"
                />
                <Parametersnewand
                  setParameterData={setParameterData}
                  className="BlockDiagrams5"
                />
                <ButtonsSim
                  GraphAndSimulate={GraphAndSimulate}
                  destroygraph={destroygraph}
                  className="buttons-3"
                  startClassName="button-wrap3"
                />
                <Graphsim
                  SimulationPoints={SimulationPoints}
                  Simulation={Simulation}
                  className="graphs-18"
                  divClassName1="titlegraph"
                  xPosClassName="singlegraphtitle"
                  yPosClassName="singlegraphtitle"
                  xVelClassName="singlegraphtitle"
                  yVelClassName="singlegraphtitle"
                  rectangleClassName="graphsize"
                  groupClassName="graphsize-warp"
                />
                <Results
                  className="Results834"
                  steadyStateErrorPitch={XError}
                  overshootPitch={Xovershoot}
                  settlingTimePitch={xtime}
                  steadyStateErrorRoll={YError}
                  overshootRoll={Yovershoot}
                  settlingTimeRoll={ytime}
                  />
                <Next
                  navigate="nav2"
                  next="next2"
                  back="back2"
                  linkTo1="/hover-realtime"
                  linkTo2="/Hover-Documentation/"
                  disable={!isCriteriaMet} // Disable Next button until criteria are met
                />
                <Footer
                  className="footer5"
                  group="groupwrap"
                  group7="group7footer"
                  buttonf="buttonfooter"
                  textwrapper="textwrapperfooter"
                  textwrapper2="textwrapper2footer"
                  textwrapper3="textwrapper3footer"
                  textwrapper4="textwrapper4footer"
                  textwrapper5="textwrapper5footer"
                  group8="group8footer"
                  group9="group9footer"
                  group10="group10footer"
                  copyright="copyrightfooter"
                />
                <div style={{ height: 0 }}></div>
              </>
            )}
          </div>
        </>
      )}
    </Authenticator>
  );
};

export const HoverSim = withAuthenticator(HoverSimcomponent);
