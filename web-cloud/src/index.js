import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, Outlet } from "react-router-dom";
import { Authenticator } from "@aws-amplify/ui-react";
import reportWebVitals from "./reportWebVitals";
import "@aws-amplify/ui-react/styles.css";
import { useCognitoGroup } from "./auth/hooks/getRole";
import useProfile from "./auth/hooks/useProfile";
import App from "./pages/App";
import AccessDenied from "./pages/AccessDenied";
import Pubsub from "./pages/pubsub";
import Pubsubsim from "./pages/pubsubsim";
import Progresspage from "./pages/progresspage";
import Invsim from "./pages/invsim";
import RotarySim from "./pages/RotarySimPage";
import SuspensionSim from "./pages/SuspensionSimPage";
import Footer from "./layout/footer";
import Privacy from "./pages/Privacy";
import TermsOfService from "./pages/TermsOfService";
import Queue from "./pages/Queue";
import Interactive from "./pages/Interactive";
import Live from "./pages/Live";
import Inv from "./pages/inv";
import FeedbackResponse from "./pages/FeedbackResponse";
import Test from "./pages/test";
import Progresspagerealdata from "./pages/progresspagerealdata";
import Invprogresspagerealdata from "./pages/invprogresspagerealdata";
import AboutUs from "./pages/AboutUs";
import Video from "./pages/Video";
import Feedback from "./pages/Feedback";
import Order2 from "./pages/order2";
import Navbar from "./layout/nav";
import Order from "./pages/order";
import Learn1 from "./pages/learn1";
import Profile from "./pages/profile";
import Choosesim from "./pages/Choosesim";
import Learn2 from "./pages/learn2";
import Queue2 from "./pages/Queue2";
import ContactUs from "./pages/contactus";
import Datavisibility from "./pages/Datavisibility";
import Queue1 from "./pages/Queue1";
import RotaryLive from "./pages/RotaryLive";
import SuspensionLive from "./pages/SuspensionLive";
import RotaryProgress from "./pages/RotaryProgress";
import SuspensionProgress from "./pages/SuspensionProgress";
import RotaryOrder from "./pages/RotaryOrder";
import SuspensionOrder from "./pages/SuspensionOrder";
import Home from "./pages/Home";
import ChatSidebar from "./components/ChatSidebar";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";

Amplify.configure(awsExports);

// Auth wrapper
const RequireAuth = ({ children }) => (
  <Authenticator className="auth-container">
    {({ user }) => (user ? children : <Home />)}
  </Authenticator>
);

// ProtectedRoute component for specific roles
const ProtectedRoute = ({ allowedRoles }) => {
  const { userRole, loading, error } = useCognitoGroup();
  // const {profile, isComplete, isLoading,error2 } = useProfile();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <Navigate
        to="/AccessDenied"
        replace
        state={{ message: "Error retrieving user role" }}
      />
    );
  }

  //  if (!isComplete) {
  //   return (
  //     <Navigate
  //       to="/profile"
  //       replace
  //       state={{ message: "Please complete your profile" }}
  //     />
  //   );
  // }

  // Check role access
  if (!allowedRoles.includes(userRole)) {
    return (
      <Navigate
        to="/AccessDenied"
        replace
        state={{ message: "Access denied" }}
      />
    );
  }

  return <Outlet />;
};

// Layout with Navbar and conditional Footer
const LayoutWithConditionalFooter = ({ children }) => {
  const location = useLocation();
  const hideFooterRoutes = ["/", "/AboutUs"];
  const shouldShowFooter = !hideFooterRoutes.includes(location.pathname);

  return (
    <>
      <Navbar />
      <div className="main-content">{children}</div>
      {shouldShowFooter && <Footer />}
      <ChatSidebar />
    </>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Authenticator.Provider>
    <Router>
      <HelmetProvider>
        <LayoutWithConditionalFooter>
          <Routes>

            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/TermsOfService" element={<TermsOfService />} />
            <Route path="/AboutUs" element={<AboutUs />} />

            {/* Authenticated routes */}
            <Route
              path="/Profile"
              element={
                <RequireAuth>
                  <Profile />
                </RequireAuth>
              }
            />

            {/* Student and Visitor routes */}
            <Route
              element={
                <RequireAuth>
                  <ProtectedRoute allowedRoles={["Student", "Visitor", "Admin", "Approved", "Staff"]} />
                </RequireAuth>
              }
            >
              <Route path="/Main" element={<App />} />
              <Route path="/AccessDenied" element={<AccessDenied />} />
              {/* <Route path="/Profile" element={<Profile />} /> */}
              <Route path="/SelectSim" element={<Choosesim />} />
              <Route path="/QuadrotorSim" element={<Pubsubsim />} />
              <Route path="/PendulumSim" element={<Invsim />} />
              <Route path="/SuspensionSim" element={<SuspensionSim />} />
              <Route path="/FurutaSim" element={<RotarySim />} />
              <Route path="/ContactUs" element={<ContactUs />} />
              <Route path="/Learn1" element={<Learn1 />} />
              <Route path="/Learn2" element={<Learn2 />} />
              <Route path="/Lessons" element={<Interactive />} />
              <Route path="/Live" element={<Live />} />
              <Route path="/Feedback" element={<Feedback />} />
              <Route path="/SimProgresspage" element={<Progresspage />} />
            </Route>

            {/* Approved and Staff routes (all pages except admin-only) */}
            <Route
              element={
                <RequireAuth>
                  <ProtectedRoute allowedRoles={["Student", "Visitor","Admin","Approved", "Staff"]} /> {/* Remove Student and Visitor later */}
                </RequireAuth>
              }
            >
              <Route path="/QuadrotorPage" element={<Pubsub />} />
              <Route path="/SelectExp" element={<Queue />} />
              <Route path="/Queue1" element={<Queue1 />} />
              <Route path="/Queue2" element={<Queue2 />} />
              <Route path="/PendulumPage" element={<Inv />} />
              <Route path="/Video" element={<Video />} />
              <Route path="/Progresspage" element={<Progresspagerealdata />} />
              <Route path="/InvProgresspage" element={<Invprogresspagerealdata />} />
              <Route path="/FurutaPage" element={<RotaryLive />} />
              <Route path="/SuspensionPage" element={<SuspensionLive />} />
              <Route path="/RotaryProgress" element={<RotaryProgress />} />
              <Route path="/SuspensionProgress" element={<SuspensionProgress />} />
            </Route>

            {/* Admin routes (all pages) */}
            <Route
              element={
                <RequireAuth>
                  <ProtectedRoute allowedRoles={["Student", "Visitor","Admin","Approved", "Staff"]} /> {/* Remove all except Admin later */}
                </RequireAuth>
              }
            >
              <Route path="/test" element={<Test />} />
              <Route path="/QuadrotorCtrl" element={<Order />} />
              <Route path="/PendulumCtrl" element={<Order2 />} />
              <Route path="/RotaryCtrl" element={<RotaryOrder />} />
              <Route path="/SuspensionCtrl" element={<SuspensionOrder />} />
              <Route path="/Datavisibility" element={<Datavisibility />} />
              <Route path="/FeedbackResponse" element={<FeedbackResponse />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

        </LayoutWithConditionalFooter>
      </HelmetProvider>
    </Router>
  </Authenticator.Provider>
);

reportWebVitals();