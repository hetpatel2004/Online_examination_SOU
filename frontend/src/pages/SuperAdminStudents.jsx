
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const SuperAdminStudents = () => {
  const { user } = useAuth();

  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [semesters, setSemesters] = useState([]);

  // Fetch all courses/programs
  const fetchCourses = async () => {
    try {
      const { data } = await API.get('/superadmin/courses');

      const courseList = Array.isArray(data?.courses)
        ? data.courses
        : [];

      setPrograms(courseList);
    } catch (err) {
      console.error('Failed to load courses:', err);

      setError(
        err.response?.data?.message ||
          'Failed to load courses'
      );

      setPrograms([]);
    }
  };

  // Fetch students with filters
  const fetchStudents = async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await API.get('/superadmin/students', {
        params: {
          program: selectedProgram,
          semester: semesterFilter,
        },
      });

      const studentList = Array.isArray(data?.users)
        ? data.users
        : [];

      setUsers(studentList);

      // Create semester list for selected program
      if (selectedProgram) {
        const semesterList = [
          ...new Set(
            studentList
              .map((student) => student.semester)
              .filter(
                (semester) =>
                  semester !== null &&
                  semester !== undefined &&
                  semester !== ''
              )
          ),
        ].sort((a, b) => Number(a) - Number(b));

        setSemesters(semesterList);
      } else {
        setSemesters([]);
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);

      setError(
        err.response?.data?.message ||
          'Failed to fetch students'
      );

      setUsers([]);
      setSemesters([]);
    } finally {
      setLoading(false);
    }
  };

  // Load courses once when component starts
  useEffect(() => {
    fetchCourses();
  }, []);

  // Fetch students whenever filters change
  useEffect(() => {
    fetchStudents();
  }, [selectedProgram, semesterFilter]);

  // Handle program filter
  const handleProgramChange = (programCode) => {
    setSelectedProgram(programCode);

    // Reset semester when program changes
    setSemesterFilter('');
  };

  // Handle semester filter
  const handleSemesterChange = (semester) => {
    setSemesterFilter(semester);
  };

  // Search students
  const filteredUsers = users.filter((student) => {
    const search = searchTerm.toLowerCase().trim();

    if (!search) {
      return true;
    }

    return (
      student.name?.toLowerCase().includes(search) ||
      student.enrollmentNumber
        ?.toLowerCase()
        .includes(search) ||
      student.email?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <div className="dashboard-main">

          {/* Navigation */}
          <nav className="dashboard-nav">
            <div className="nav-brand">
              <span className="admin-badge">
                SUPER ADMIN PANEL
              </span>
            </div>

            <div className="nav-welcome">
              Welcome, {user?.name || 'Super Admin'}
            </div>
          </nav>

          {/* Main Content */}
          <div className="dashboard-content">
            <div className="superadmin-students-page">

              {/* Page Header */}
              <div className="page-header">
                <h1>All Students</h1>
                <p>
                  Manage and view all student accounts
                </p>
              </div>

              {/* Filters */}
              <div className="filters-section">

                {/* Program Filter */}
                <div className="program-filter">
                  <span>Program:</span>

                  <button
                    type="button"
                    className={`filter-btn ${
                      selectedProgram === ''
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      handleProgramChange('')
                    }
                  >
                    All Programs
                  </button>

                  {programs.length > 0 ? (
                    programs.map((program) => (
                      <button
                        type="button"
                        key={program._id || program.code}
                        className={`filter-btn ${
                          selectedProgram === program.code
                            ? 'active'
                            : ''
                        }`}
                        onClick={() =>
                          handleProgramChange(
                            program.code
                          )
                        }
                      >
                        {program.name ||
                          program.code ||
                          'Unnamed Program'}
                      </button>
                    ))
                  ) : (
                    <span className="filter-loading">
                      Loading programs...
                    </span>
                  )}
                </div>

                {/* Semester Filter */}
                {selectedProgram && (
                  <div className="semester-filter">
                    <span>Semester:</span>

                    <button
                      type="button"
                      className={`filter-btn ${
                        semesterFilter === ''
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        handleSemesterChange('')
                      }
                    >
                      All Semesters
                    </button>

                    {semesters.length > 0 ? (
                      semesters.map((semester) => (
                        <button
                          type="button"
                          key={semester}
                          className={`filter-btn ${
                            semesterFilter ===
                            String(semester)
                              ? 'active'
                              : ''
                          }`}
                          onClick={() =>
                            handleSemesterChange(
                              String(semester)
                            )
                          }
                        >
                          Sem {semester}
                        </button>
                      ))
                    ) : (
                      <span className="filter-loading">
                        No semesters found
                      </span>
                    )}
                  </div>
                )}

                {/* Search */}
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search by name, enrollment, email..."
                    value={searchTerm}
                    onChange={(e) =>
                      setSearchTerm(e.target.value)
                    }
                  />
                </div>
              </div>

              {/* Students Table */}
              <div className="students-table-container">

                {loading ? (
                  <div className="loading">
                    Loading students...
                  </div>
                ) : error ? (
                  <div className="error-msg">
                    {error}
                  </div>
                ) : users.length === 0 ? (
                  <div className="no-students">
                    <span className="coming-icon">
                      📊
                    </span>

                    <h3>No Students Found</h3>

                    <p>
                      No students match the current
                      filters.
                    </p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="no-students">
                    <span className="coming-icon">
                      🔍
                    </span>

                    <h3>No Matching Students</h3>

                    <p>
                      No students match your search.
                    </p>
                  </div>
                ) : (
                  <div className="students-table">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Enrollment</th>
                          <th>Program</th>
                          <th>Semester</th>
                          <th>Email</th>
                          <th>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredUsers.map(
                          (student, index) => (
                            <tr
                              key={
                                student._id ||
                                student.enrollmentNumber ||
                                index
                              }
                            >
                              {/* Number */}
                              <td data-label="#">
                                {index + 1}
                              </td>

                              {/* Name */}
                              <td
                                data-label="Name"
                                className="name-cell"
                              >
                                {student.name || '—'}

                                {student.isBlocked && (
                                  <span className="status-blocked-badge">
                                    Blocked
                                  </span>
                                )}
                              </td>

                              {/* Enrollment */}
                              <td
                                data-label="Enrollment"
                                className="enrollment-cell"
                              >
                                {student.enrollmentNumber ||
                                  '—'}
                              </td>

                              {/* Program */}
                              <td data-label="Program">
                                {student.course || '—'}
                              </td>

                              {/* Semester */}
                              <td data-label="Semester">
                                {student.semester || '—'}
                              </td>

                              {/* Email */}
                              <td data-label="Email">
                                {student.email || '—'}
                              </td>

                              {/* Actions */}
                              <td
                                data-label="Actions"
                                className="actions-cell"
                              >
                                <button
                                  type="button"
                                  className="btn-icon btn-view"
                                  title="View Details"
                                >
                                  👁️
                                </button>

                                <button
                                  type="button"
                                  className="btn-icon btn-block"
                                  title={
                                    student.isBlocked
                                      ? 'Unblock'
                                      : 'Block'
                                  }
                                >
                                  {student.isBlocked
                                    ? '✅'
                                    : '🚫'}
                                </button>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminStudents;
