import React from "react";
import "./loading.css"; // Import the styles

const Loading = ({position}) => {
  return (
    <div className="container">
      <div className="loader-container">
        <div className="loader"></div>
        <div className="loading-text"> Waiting for your turn... Position in Queue: {position}</div>
      </div>
    </div>
    
    
  );    
};

export default Loading;
