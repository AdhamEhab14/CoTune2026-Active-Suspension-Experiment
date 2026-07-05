import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {jwtDecode} from "jwt-decode";

// Define priority: highest → lowest
const GROUP_PRIORITY = ["Admin", "Approved", "Staff", "Student", "Visitor"];

export function useCognitoGroup() {
  const [userRole, setUserRole] = useState(null); // Default to lowest role
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getUserGroup = async () => {
      try {
        const session = await fetchAuthSession({ forceRefresh: true });
        const idToken = session.tokens?.idToken?.toString();

        if (idToken) {
          const decoded = jwtDecode(idToken);
          const groups = decoded["cognito:groups"] || [];

          // Determine highest priority group the user is in
          for (const group of GROUP_PRIORITY) {
            if (groups.includes(group)) {
              setUserRole(group);
              break;
            }
          }
        } else {
          console.warn("No ID token found");
        }
      } catch (err) {
        console.error("Error fetching user group:", err);
        setError("Failed to retrieve user group");
      } finally {
        setLoading(false);
      }
    };

    getUserGroup();
  }, []);

  return { userRole, loading, error };
}
