import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Hamburger from "../assets/hamburger.png";
import Brand from "../assets/CO-Tune_V2.png";
import HomeIcon from "../assets/home.png";
import ExperimentsIcon from "../assets/flying-robots.png";
import simIcon from "../assets/vr.png";
import lesson from "../assets/open-book.png";
import Profilemenu from "../components/Profilemenu";

import "./nav.css";
import { useAuthenticator } from "@aws-amplify/ui-react";

const Navbar = () => {
  const location = useLocation();
  const { user } = useAuthenticator();
  const [showNavbar, setShowNavbar] = useState(false);
  const [showQADropdown, setShowQADropdown] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const navbarRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  const handleShowNavbar = () => {
    setShowNavbar((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target)) {
        setShowNavbar(false);
        setShowQADropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <nav className="navbar" ref={navbarRef}>
      <div className="containerN">
        {/* Logo */}
        <div className="logo">
          <Link to="/">
            <img src={Brand} alt="Co Tune Logo" />
          </Link>
        </div>

        {/* Mobile-only: Hamburger + Profilemenu */}
        <div className="mobile-top-icons mobile-only">
          <div className="menu-icon" onClick={handleShowNavbar}>
            <img src={Hamburger} alt="Menu" />
          </div>
          {user && (
            <div className="mobile-profile-menu">
              <Profilemenu />
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <div className={`nav-elements ${showNavbar ? "active" : ""}`}>
          <ul>
            <li>
              <Link
                onClick={handleShowNavbar}
                to="/Main"
                className={`nav-link ${location.pathname === "/Main" ? "active" : ""}`}
              >
                <img src={HomeIcon} alt="Home" className="nav-icon" />
                Home
              </Link>
            </li>
            <li>
              <Link
                onClick={handleShowNavbar}
                to="/SelectExp"
                className={`nav-link ${location.pathname === "/SelectExp" ? "active" : ""}`}
              >
                <img
                  src={ExperimentsIcon}
                  alt="Experiments"
                  className="nav-icon"
                />
                Experiments
              </Link>
            </li>
            <li>
              <Link
                onClick={handleShowNavbar}
                to="/SelectSim"
                className={`nav-link ${location.pathname === "/SelectSim" ? "active" : ""}`}
              >
                <img src={simIcon} alt="Simulation" className="nav-icon" />
                Simulation
              </Link>
            </li>
            <li>
              <Link
                onClick={handleShowNavbar}
                to="/Lessons"
                className={`nav-link ${location.pathname === "/Lessons" ? "active" : ""}`}
              >
                <img src={lesson} alt="Lessons" className="nav-icon" />
                Lessons
              </Link>
            </li>
            <li className="nav-dropdown-item">
              <button
                className={`nav-dropdown-trigger ${showQADropdown ? "active" : ""}`}
                onClick={() => setShowQADropdown((prev) => !prev)}
              >
                ❔ Q&amp;A ▾
              </button>
              {showQADropdown && (
                <ul className="nav-dropdown-menu">
                  <li>
                    <Link
                      to="/Learn1"
                      onClick={() => { setShowQADropdown(false); setShowNavbar(false); }}
                      className={location.pathname === "/Learn1" ? "active" : ""}
                    >
                      PID
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/Learn2"
                      onClick={() => { setShowQADropdown(false); setShowNavbar(false); }}
                      className={location.pathname === "/Learn2" ? "active" : ""}
                    >
                      LQR
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            <li className="theme-toggle-item">
              <button
                className={`theme-toggle-btn ${theme}-mode`}
                onClick={toggleTheme}
                aria-label="Toggle Theme"
              >
                {theme === "light" ? "🌙 Dark" : "☀️ Light"}
              </button>
            </li>

            {/* Desktop-only Profilemenu */}
            {user && (
              <li className="profile-menu-item desktop-only">
                <Profilemenu />
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
