// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import api from "../services/api";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(localStorage.getItem("token")));
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Check if we should run the auth check
  const shouldRunAuthCheck = Boolean(localStorage.getItem("token") && !user && loading);

  // Check if user is logged in on initial load
  const { isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const response = await api.get("/auth/me");
        return response.data;
      } catch (error) {
        // Only clear token if it's an authentication error
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      setUser(data);
      try { localStorage.setItem("user", JSON.stringify(data)); } catch {}
      setIsAuthenticated(true);
      // Only navigate if we're not already on a protected route
      if (window.location.pathname === '/login' || window.location.pathname === '/register') {
        navigate("/projects");
      }
    },
    onError: (error) => {
      setUser(null);
      // Keep optimistic auth until explicit logout or subsequent guarded action
      // Do not navigate here; route guards will handle if needed
    },
    retry: false,
    // Only run this query if we have a token and not already loading user data
    enabled: shouldRunAuthCheck,
  });

  useEffect(() => {
    if (!isLoading) {
      setLoading(false);
    }
  }, [isLoading]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      setUser(data.user);
      try { localStorage.setItem("user", JSON.stringify(data.user)); } catch {}
      setIsAuthenticated(true);
      toast.success("Logged in successfully");
      navigate("/projects");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
      return false;
    }
  };

  const register = async ({ username, email, password }) => {
    try {
      console.log('Sending registration request with:', { username, email, password: '***' });
      const { data } = await api.post("/auth/register", { 
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim()
      });
      
      console.log('Registration successful, received:', data);
      
      // Check if we have a successful response with a token
      if (data && data.token) {
        const { token, user } = data;
        localStorage.setItem("token", token);
        setUser(user || { username, email });
        try { localStorage.setItem("user", JSON.stringify(user || { username, email })); } catch {}
        setIsAuthenticated(true);
        toast.success(data.message || "Account created successfully");
        navigate("/projects");
        return true;
      } else {
        console.error('Unexpected response format:', data);
        toast.error(data?.message || "Registration successful but received invalid response from server");
        return false;
      }
    } catch (error) {
      console.error('Registration error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // Handle specific error cases
      if (error.response?.data?.message) {
        // Handle "user already exists" case
        if (error.response.data.message === 'User already exists' && error.response.data.field) {
          const field = error.response.data.field;
          const value = field === 'email' ? 'This email is already registered' : 'This username is already taken';
          toast.error(value);
          // Return the field that caused the error
          return { error: true, field };
        }
        toast.error(error.response.data.message);
      } else if (error.response?.data?.errors) {
        // Handle validation errors
        const errorMessages = Object.values(error.response.data.errors).flat();
        toast.error(errorMessages.join('\n'));
      } else if (error.message === 'User already exists') {
        // Fallback for the message format we saw in the logs
        toast.error('A user with this email or username already exists');
      } else {
        toast.error("Registration failed. Please try again.");
      }
      
      return false;
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setIsAuthenticated(false);
      queryClient.clear();
      navigate("/login");
    }
  };

  const updateProfile = async (updates) => {
    try {
      const userId = user?.id || user?._id;
      const { data } = await api.put(`/users/${userId}`, updates);
      setUser(data);
      toast.success("Profile updated successfully");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;