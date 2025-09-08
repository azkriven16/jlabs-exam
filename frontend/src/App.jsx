import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { HomeScreen } from "./pages/HomeScreen";
import { LoginScreen } from "./pages/LoginScreen";

export default function App() {
  const token = localStorage.getItem("authToken");

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={token ? "/home" : "/login"} replace />}
        />
        {/* public */}
        <Route path="/login" element={<LoginScreen />} />
        {/* protected group */}
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<HomeScreen />} />
          {/* add other protected routes here */}
        </Route>
        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/** route protection implemented via Outlet to be minimal */
const ProtectedRoute = () => {
  const token = localStorage.getItem("authToken");
  return token ? <Outlet /> : <Navigate to="/login" replace />;
};
