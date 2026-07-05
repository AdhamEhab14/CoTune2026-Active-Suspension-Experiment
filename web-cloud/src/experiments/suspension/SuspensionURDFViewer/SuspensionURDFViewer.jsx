import React, { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import URDFLoader from "urdf-loader";
import { LoadingManager } from "three";

export const SuspensionURDFViewer = ({
  zr = 0,
  zus_zr = 0,
  zs_zus = 0,
  zoom = 1,
}) => {
  const [robot, setRobot] = useState(null);
  const robotRef = useRef();

  useEffect(() => {
    let active = true;
    const manager = new LoadingManager();
    const loader = new URDFLoader(manager);
    
    // We parse the mesh packages relative to the public URL
    loader.packages = {
      Active_Suspension_urdf: "/Active_Suspension_urdf",
    };

    loader.load("/Active_Suspension_urdf/urdf/Active_Suspension_urdf.urdf", (loadedRobot) => {
      if (active) {
        // Adjust the rotation to be vertical and base on the ground
        // The Y axis is the vertical axis based on prismatic joints (0 1 0).
        loadedRobot.rotation.x = 0; // -Math.PI / 2 if Z was up, but Y is up so 0 is fine
        loadedRobot.rotation.y = 0;
        loadedRobot.position.y = -0.2; // Move down slightly to center it
        
        // Enhance materials
        loadedRobot.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.metalness = 0.5;
              child.material.roughness = 0.4;
            }
          }
        });

        // Override mechanical limits to allow any simulation amplitude
        for (const jointName in loadedRobot.joints) {
          const joint = loadedRobot.joints[jointName];
          if (joint.limit) {
            joint.limit.lower = -100;
            joint.limit.upper = 100;
          }
        }

        setRobot(loadedRobot);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (robotRef.current) {
      // Map state to joints
      // joint_1 = zr (road level)
      // joint_2 = zus - zr (tire deflection)
      // joint_3 = zs - zus (suspension travel)
      
      const joints = robotRef.current.joints;

      if (joints["joint_1"]) {
        joints["joint_1"].setJointValue(zr);
      }
      if (joints["joint_2"]) {
        joints["joint_2"].setJointValue(zus_zr);
      }
      if (joints["joint_3"]) {
        joints["joint_3"].setJointValue(zs_zus);
      }
    }
  }, [robot, zr, zus_zr, zs_zus]);

  return (
    <div style={{ width: "100%", height: "400px", borderRadius: "10px", overflow: "hidden" }}>
      <Canvas shadows>
        <PerspectiveCamera 
            makeDefault 
            position={[0.8 / zoom, 0.5 / zoom, 0.8 / zoom]} 
            fov={50} 
        />
        <OrbitControls 
            target={[0, 0.1, 0]} 
            enablePan={false}
            minDistance={0.5} 
            maxDistance={3}
        />
        
        <ambientLight intensity={0.6} />
        <directionalLight 
            position={[5, 10, 5]} 
            intensity={1.0} 
            castShadow 
            shadow-mapSize-width={1024} 
            shadow-mapSize-height={1024} 
        />
        <Environment preset="city" />

        <group>
          {robot && <primitive object={robot} ref={robotRef} />}
        </group>
      </Canvas>
    </div>
  );
};
