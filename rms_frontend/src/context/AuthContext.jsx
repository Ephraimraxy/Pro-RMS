import { authAPI } from '../lib/api';
import { logActivity } from '../lib/store';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('rms_token');
      const storedUser = localStorage.getItem('rms_user');
      
      if (token && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          // Proactively verify token with backend
          const result = await authAPI.checkSession();
          if (result.user) {
            setUser(result.user);
            localStorage.setItem('rms_user', JSON.stringify(result.user));
          }
        } catch (err) {
          console.error("Session verification failed:", err);
          logout();
        }
      }
      setLoading(false);
    };

    verifySession();
  }, []);

  const login = async (email, password) => {
    const { token, user: userData } = await authAPI.login(email, password);
    setUser(userData);
    localStorage.setItem('rms_token', token);
    localStorage.setItem('rms_user', JSON.stringify(userData));
    return userData;
  };

  const deptLogin = async (departmentName, accessCode) => {
    const { token, user: userData } = await authAPI.deptLogin(departmentName, accessCode);
    setUser(userData);
    localStorage.setItem('rms_token', token);
    localStorage.setItem('rms_user', JSON.stringify(userData));
    return userData;
  };

  const logout = async () => {
    await authAPI.logout();
    setUser(null);
    localStorage.removeItem('rms_token');
    localStorage.removeItem('rms_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, deptLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
