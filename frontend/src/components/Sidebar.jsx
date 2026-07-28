import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ role, activePage, onNavigate }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminMenu = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'subjects', icon: '📚', label: 'My Subjects' },
    { id: 'students', icon: '👥', label: 'Students' },
    { id: 'exams', icon: '📝', label: 'Exams' },
  ];

  const studentMenu = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'subjects', icon: '📖', label: 'My Subjects' },
    { id: 'exams', icon: '📝', label: 'My Exams' },
  ];

  const superAdminMenu = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'admins', icon: '👤', label: 'Manage Admins' },
    { id: 'courses', icon: '🎓', label: 'Manage Courses' },
    { id: 'subjects', icon: '📚', label: 'Manage Subjects' },
    { id: 'assignment', icon: '🔗', label: 'Assign Faculty' },
  ];

  const menuItems = role === 'superadmin' ? superAdminMenu : role === 'admin' ? adminMenu : studentMenu;
  const themeClass = role === 'superadmin' ? 'sidebar-superadmin' : role === 'admin' ? 'sidebar-admin' : 'sidebar-student';

  return (
    <aside className={`sidebar ${themeClass}`}>
      <div className="sidebar-header">
        <img
          src="https://silveroakuni.ac.in/assets/images/logo/sou-l.svg"
          alt="SOU"
          className="sidebar-logo"
        />
        <span className="sidebar-title">
          {role === 'superadmin' ? 'Super Admin Panel' : role === 'admin' ? 'Admin Panel' : 'Student Panel'}
        </span>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-user-role">
              {role === 'superadmin' ? 'Super Admin' : role === 'admin' ? 'Administrator' : 'Student'}
            </span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
