import React from "react";
import "./DropDownMenu.css"; // Import the styles

const DropDownMenu = ({link1,link2,link3,text1,text2,text3}) => {
  return (
    <div className="paste-button">
      <button className="button">Menu &nbsp; ▼</button>
      <div className="dropdown-content">
        <a id="top" href={link1}>{text1}</a>
      </div>
    </div>
  );
};

export default DropDownMenu;