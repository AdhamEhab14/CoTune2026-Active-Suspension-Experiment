import React from "react";
import { useNavigate } from "react-router-dom";
import "./CustomButton.css"; // Make sure to create this CSS file

const CustomButton = ({ text, path }) => {

  const navigate = useNavigate();

  const handleImageClick = () => {
    navigate(path);
  };
  return (

<button className="CustomButton" onClick={() => handleImageClick({path})} > {text}</button>

  );
};

export default CustomButton;
