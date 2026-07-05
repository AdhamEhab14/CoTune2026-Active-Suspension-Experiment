import { useState, useEffect } from "react";
import { fetchAuthSession } from "@aws-amplify/auth";
import "./contactus.css";

const API_ENDPOINT = "https://e9rack1ad0.execute-api.eu-west-3.amazonaws.com/prod/contact"; // Replace with your API Gateway URL

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Pre-fill form with user details if logged in
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: false });
        if (session.credentials && session.tokens?.idToken) {
          const idToken = session.tokens.idToken.toString();
          const user = session.tokens.idToken.payload;
          setFormData((prev) => ({
            ...prev,
            email: user.email || "",
            name: user.name || "",
          }));
        }
      } catch (err) {
        console.warn("No user session found, proceeding without pre-fill:", err);
      }
    };
    initializeAuth();
  }, []);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setSuccess(null);
    setError(null);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }
    if (!formData.subject) newErrors.subject = "Subject is required";
    if (!formData.message) newErrors.message = "Message is required";
    return newErrors;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      setSuccess("Your message has been sent! We'll get back to you soon.");
      setFormData({ name: formData.name, email: formData.email, subject: "", message: "" });
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send your message. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="contact-page">
      <div className="form-wrapper">      
      <h1>Contact Us</h1>
      <p>Have a question or need support? Fill out the form below, and we'll get back to you as soon as possible.</p>
      {/* <p className="privacy-notice">
        Your data will be used solely to respond to your inquiry, in compliance with GDPR.
      </p> */}

      {isLoading && (
        <p className="loading">
          <span className="spinner"></span> Sending...
        </p>
      )}
      {success && <p className="success">{success}</p>}
      {error && <p className="error">{error}</p>}

      <form className="contact-form" onSubmit={handleSubmit}>

        <div className="form-group">
          <label htmlFor="name">Name (Optional)</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Your name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email <span className="required">*</span></label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Your email"
            required
          />
          {errors.email && <span className="error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="subject">Subject <span className="required">*</span></label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            placeholder="Subject of your message"
            required
          />
          {errors.subject && <span className="error">{errors.subject}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="message">Message <span className="required">*</span></label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="Your message"
            rows="5"
            required
          ></textarea>
          {errors.message && <span className="error">{errors.message}</span>}
        </div>

        <button type="submit" className="submit-button" disabled={isLoading}>
          Send Message
        </button>

        
      </form>
      </div>
    </div>
  );
};

export default ContactUs;