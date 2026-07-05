import React from "react";
import "./Privacy.css"; // Assuming you have a CSS file for styling
import { Helmet } from "react-helmet-async";

const PrivacyPolicy = () => {
  return (
    <div className="privacy-container">
      <Helmet>
        <title>Privacy Policy</title>
      </Helmet>
      <header>
        <h1>Privacy Policy</h1>
        <p>Effective Date: November 24, 2024</p>
      </header>
      <p>
        We value your privacy and are committed to protecting your personal
        information. This privacy policy outlines how we collect, use, and
        safeguard your data when you interact with our website or services.
      </p>
      <p>
        <strong>Data Collection:</strong> We may collect personal information,
        such as your name, email address, and usage data, to improve our
        services and provide you with a better experience.
      </p>
      <p>
        <strong>Data Usage:</strong> Your data is used to personalize content,
        analyze trends, and improve functionality. We may also use it to send
        important updates or promotional materials, with your consent.
      </p>
      <p>
        <strong>Third-Party Sharing:</strong> We do not sell or share your
        personal data with third parties unless required by law or necessary for
        the operation of our services.
      </p>
      <p>
        <strong>Security:</strong> We implement robust security measures to
        protect your data from unauthorized access, disclosure, alteration, or
        destruction.
      </p>
      <p>
        If you have any questions about this privacy policy or your personal
        data, please contact us at{" "}
        <a
          href="mo.mamd000h@gmail.com
"
        >
          mo.mamd000h@gmail.com
        </a>
        .
      </p>
      <footer>
        <p>Last Updated: November 24, 2024</p>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
