import React from "react";
import "./Popupmuenu.css"; // Import the styles

const Popupmuenu = () => {
    function myFunction() {
  var popup = document.getElementById("myPopup");
  popup.classList.toggle("show");
}
  return (
    <div class="popup" onclick={myFunction()}>Click me!
        <span class="popuptext" id="myPopup">Popup text...</span>
    </div>
  );
};

export default Popupmuenu;
