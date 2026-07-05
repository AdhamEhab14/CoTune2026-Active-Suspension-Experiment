// src/authService.js
import { CognitoUser, AuthenticationDetails } from "amazon-cognito-identity-js";
import { userPool } from "./cognitoConfig";

export function authenticateUser(username, password) {
  const userData = {
    Username: username,
    Pool: userPool,
  };

  const cognitoUser = new CognitoUser(userData);
  const authDetails = new AuthenticationDetails({
    Username: username,
    Password: password,
  });

  cognitoUser.authenticateUser(authDetails, {
    onSuccess: (result) => {
      console.log("Login successful:", result);
    },
    onFailure: (err) => {
      console.error("Login failed:", err);
    },
  });
}
