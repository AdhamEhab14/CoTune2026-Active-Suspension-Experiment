import React from "react";
import "./TermsOfService.css"; // Assuming you have a CSS file for styling
import { Helmet } from "react-helmet-async";

const TermsOfService = () => {
  return (
    <div className="terms-container">
      <Helmet>
        <title>Terms of Service</title>
      </Helmet>
      <header>
        <h1>Terms of Service</h1>
        <p>Effective Date: November 24, 2024</p>
      </header>
      <p>
        By accessing or using our services, you agree to be bound by these Terms
        of Service. If you do not agree, please refrain from using our platform.
      </p>
      <p>
        <strong>Use of Services:</strong> You must use our services responsibly
        and in compliance with all applicable laws. Unauthorized use of our
        platform may result in termination of access.
      </p>
      <p>
        <strong>Intellectual Property:</strong> All content, trademarks, and
        other intellectual property displayed on our platform are owned by us or
        our licensors. You may not use, reproduce, or distribute any content
        without explicit permission.
      </p>
      <p>
        <strong>Account Responsibility:</strong> You are responsible for
        maintaining the confidentiality of your account credentials. Any
        activity under your account is your responsibility.
      </p>
      <p>
        <strong>Limitation of Liability:</strong> We are not liable for any
        indirect, incidental, or consequential damages arising from your use of
        our services.
      </p>
      <p>
        <strong>Amendments:</strong> We reserve the right to update or modify
        these terms at any time. Continued use of the platform after such
        changes constitutes acceptance of the updated terms.
      </p>
      <p>
        If you have questions regarding these terms, please contact us at{" "}
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

export default TermsOfService;
