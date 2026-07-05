import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import URDFLoader from "urdf-loader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "../../URDFViewer.css";

export const InvURDFViewer = ({
  urdfUrl,
  width,
  height,
  className,
  urdfbutton,
  urdfbutton1,
  buttonWrap5,
  joint1,
  joint2,
}) => {
  const containerRef = useRef();
  const sceneRef = useRef();
  const cameraRef = useRef();
  const rendererRef = useRef();
  const robotRef = useRef();
  const setonce = useRef(false);
  const controlsRef = useRef();
  const [controlsEnabled, setControlsEnabled] = useState(true);

  useEffect(() => {
    if (setonce.current) return;
    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.001, 1000);
    camera.position.set(5, 5, 5);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);

    scene.add(ambientLight);
    scene.add(directionalLight);

    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    setonce.current = true;

    const loader = new URDFLoader();
    loader.load(
      urdfUrl,
      (robot) => {
        console.log("Robot loaded:", robot);
        console.log(urdfUrl);
        robotRef.current = robot;
        robot.position.set(0, 0, 0);
        robot.rotation.set(0, 0, 0);

        scene.add(robot);

        setTimeout(() => {
          const box = new THREE.Box3().setFromObject(robot);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

          const controls = new OrbitControls(camera, renderer.domElement);
          controls.target.set(center.x, center.y, center.z);
          controls.update();
          controlsRef.current = controls;

          camera.position.set(
                -1.0399999526785202,
                1.2347214689026544,
              -0.32951732976928744
              );
              camera.rotation.set(
                -1.5707953268221626,
                7.384497844806215e-9,
                0.007384564960971104
              );
          cameraRef.current = camera;
        }, 300);
      },
      undefined,
      (error) => {
        console.error("Error loading URDF file:", error);
      }
    );

    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current && controlsRef.current.enabled) {
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, [urdfUrl, width, height]);

  useEffect(() => {
    if (robotRef.current) {
      if (robotRef.current.joints["joint1"]) {
        robotRef.current.joints["joint1"].setJointValue(-joint1);
      } else {
        console.warn('Joint "joint1" not found');
      }
      if (robotRef.current.joints["joint2"]) {
        robotRef.current.joints["joint2"].setJointValue(joint2);
      } else {
        console.warn('Joint "joint2" not found');
      }
    }
  }, [joint1, joint2]);

  const moveCameraToPosition1 = () => {
    const camera = cameraRef.current;
    if (camera) {
      camera.position.set(
       -1.039999962799879,
        -0.8704955607770445,
       -0.32951943499408287

      );
      camera.rotation.set(
        1.5707973268382067,
        -1.5095903501847682e-9,
        3.140083129763227
      );
    }
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }
  };

  const moveCameraToPosition2 = () => {
    const camera = cameraRef.current;
    if (camera) {
      camera.position.set(
        -1.0399999526785202,
        1.2347214689026544,
       -0.32951732976928744
      );
      camera.rotation.set(
        -1.5707953268221626,
        7.384497844806215e-9,
        0.007384564960971104
      );
    }
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }
  };

  const moveCameraToPosition3 = () => {
    const camera = cameraRef.current;
    if (camera) {
      camera.position.set(  
        -1.039999959416983,     
        1.0302535607651693,
        -0.32951948903921463
      );
      camera.rotation.set(
        -1.5707973268372755,
       2.0350101543123444e-9,
       3.1395577324815993
      );
    }
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }
  };

  const enableControls = () => {
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }

    const camera = cameraRef.current;
    if (camera) {
      console.log("Camera Position:", camera.position);
      console.log("Camera Rotation:", camera.rotation);
    }
  };

  return (
    <div
      className={`urdf ${className}`}
      ref={containerRef}
      style={{ width: "100%", height: "auto" }}
    >
      <div className={`button-wrap ${buttonWrap5}`}>
        <button
          className={`urdfbutton5 ${urdfbutton}`}
          onClick={moveCameraToPosition1}
        >
          Cam Position 1
        </button>
        <button
          className={`urdfbutton4 ${urdfbutton1}`}
          onClick={moveCameraToPosition2}
        >
          Cam Position 2
        </button>
        <button
          className={`urdfbutton5 ${urdfbutton}`}
          onClick={moveCameraToPosition3}
        >
          Cam Position 3
        </button>
        <button
          className={`urdfbutton4 ${urdfbutton1}`}
          onClick={enableControls}
        >
          Free Cam
        </button>
      </div>
    </div>
  );
};
