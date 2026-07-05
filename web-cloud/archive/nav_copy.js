import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Hamburger from "../assets/hamburger.png";
import Brand from "../assets/CO-Tune_V1.png";
import HomeIcon from "../assets/home.png"; // Make sure this path is correct
import "../layout/nav.js";

const Navbar = ({ user, signOut }) => {
  const [showNavbar, setShowNavbar] = useState(false);
  const location = useLocation();

  const handleShowNavbar = () => {
    setShowNavbar((prev) => !prev);
  };

  return (
    <nav className="navbar">
      <div className="container">
        {/* Logo Section */}
        <div className="logo">
          <Link to="/">
            <img src={Brand} alt="Co Tune Logo" />
          </Link>
        </div>

        {/* Mobile Menu Icon */}
        <div className="menu-icon" onClick={handleShowNavbar}>
          <img src={Hamburger} alt="Menu" />
        </div>

        {/* Navigation Links */}
        <div className={`nav-elements ${showNavbar ? "active" : ""}`}>
          <ul>
            <li>
              <Link
                to="/App"
                className={`nav-link ${
                  location.pathname === "/App" ? "active" : ""
                }`}
              >
                <img src={HomeIcon} alt="Home" className="nav-icon" /> Home
              </Link>
            </li>
            <li>
              <Link
                to="/Queue"
                className={`nav-link ${
                  location.pathname === "/Queue" ? "active" : ""
                }`}
              >
                Experiments
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
