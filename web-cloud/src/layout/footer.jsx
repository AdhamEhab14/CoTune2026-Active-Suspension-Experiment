import React from "react";
import { Link } from "react-router-dom";
import "./footer.css";

import youtubeIcon from "../assets/icons8-youtube-48.png";
import facebookIcon from "../assets/icons8-facebook-48.png";
import linkedinIcon from "../assets/icons8-linkedin-48.png";
import whatsappIcon from "../assets/icons8-whatsapp-48.png";
import twitchIcon from "../assets/icons8-twitch-48.png";

const iconMap = {
  youtube: youtubeIcon,
  facebook: facebookIcon,
  linkedin: linkedinIcon,
  whatsapp: whatsappIcon,
  twitch: twitchIcon,
};

const Footer = () => {
  return (
    <div className="footer-container">
      {/* Social Media Icons */}
      <div className="social-media">
        {[
          { href: "https://youtube.com", icon: "youtube", alt: "YouTube" },
          { href: "https://facebook.com", icon: "facebook", alt: "Facebook" },
          { href: "https://linkedin.com", icon: "linkedin", alt: "LinkedIn" },
          { href: "https://wa.me/+201117485545", icon: "whatsapp", alt: "WhatsApp" },
          { href: "https://twitch.tv/cotune26", icon: "twitch", alt: "Twitch" },
        ].map(({ href, icon, alt }, index) => (
          <a key={index} href={href} target="_blank" rel="noopener noreferrer" aria-label={alt}>
            <img src={iconMap[icon]} alt={alt} className="social-icon" />
          </a>
        ))}
      </div>

      {/* Footer Text */}
      <p className="copyright">&copy; {new Date().getFullYear()} CoTune. All rights reserved.</p>

      {/* Footer Links */}
      <div className="footer-links">
        <Link className="link" to="/privacy">Privacy Policy</Link>
        <Link className="link" to="/TermsOfService">Terms of Service</Link>
        <Link className="link" to="/aboutus">About Us</Link>
        <Link className="link" to="/feedback">Feedback</Link>
        <Link className="link" to="/contactus">Contact Us</Link>
      </div>
    </div>
  );
};

export default Footer;
