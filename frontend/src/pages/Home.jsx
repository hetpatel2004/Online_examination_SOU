import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  const [currentGallery, setCurrentGallery] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const galleryImages = [
    { url: 'https://silveroakuni.ac.in/assets/images/banner-images/home-page-banner/new/slide-1.webp', caption: 'Silver Oak University Campus' },
    { url: 'https://silveroakuni.ac.in/assets/images/student_group.webp', caption: 'Student Life at SOU' },
    { url: 'https://silveroakuni.ac.in/assets/images/banner-images/home-page-banner/new/slide-2.webp', caption: 'Academic Excellence' },
    { url: 'https://silveroakuni.ac.in/assets/images/stipend_based.webp', caption: 'Internship Programs' },
    { url: 'https://silveroakuni.ac.in/assets/images/banner-images/home-page-banner/new/slide-3.webp', caption: 'Industry Ready Campus' },
  ];

  const activities = [
    { icon: '&#127942;', name: 'Junoon', desc: 'Mega Cultural Festival' },
    { icon: '&#127881;', name: 'Kalpvruksh', desc: 'National-Level Conclave' },
    { icon: '&#127941;', name: 'Sports', desc: 'Inter-College Tournaments' },
    { icon: '&#128640;', name: 'Hackathons', desc: 'Smart Gujarat Winners' },
    { icon: '&#128187;', name: 'Tech Fests', desc: 'IEEE Best in Asia-Pacific' },
    { icon: '&#127891;', name: 'Convocation', desc: 'Annual Graduation Ceremony' },
  ];

  const courses = [
    { name: 'MCA', icon: '&#128187;', color: '#1a73e8' },
    { name: 'B.Sc IT', icon: '&#128196;', color: '#34a853' },
    { name: 'M.Sc IT', icon: '&#128200;', color: '#ea4335' },
    { name: 'MSCIT', icon: '&#128187;', color: '#fbbc04' },
    { name: 'MCA Cyber Security', icon: '&#128274;', color: '#9c27b0' },
    { name: 'BCA', icon: '&#128196;', color: '#00bcd4' },
  ];

  useEffect(() => {
    const galleryTimer = setInterval(() => {
      setCurrentGallery((prev) => (prev + 1) % galleryImages.length);
    }, 3000);
    return () => clearInterval(galleryTimer);
  }, []);

  return (
    <div className="home">
      <nav className="navbar">
        <div className="nav-brand">
          <img 
            src="https://silveroakuni.ac.in/assets/images/logo/sou-l.svg" 
            alt="Silver Oak University" 
            className="sou-logo-nav"
          />
        </div>
        <button className={`hamburger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span></span><span></span><span></span>
        </button>
        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <a href="#about" className="nav-link" onClick={() => setMenuOpen(false)}>About</a>
          <a href="#campus" className="nav-link" onClick={() => setMenuOpen(false)}>Campus</a>
          <a href="#features" className="nav-link" onClick={() => setMenuOpen(false)}>Why SOU</a>
          <Link to="/login" className="nav-link" onClick={() => setMenuOpen(false)}>Login</Link>
          <Link to="/register" className="nav-link btn-register" onClick={() => setMenuOpen(false)}>Register</Link>
        </div>
      </nav>

      {/* ============ HERO SECTION (original) ============ */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="badge">Online Examination Portal</div>
          <h1>Silver Oak University</h1>
          <h2>MCA Online Examination System</h2>
          <p className="hero-desc">
            Carrying forward the legacy of the renowned Silver Oak Group of Institutes, 
            SOU stands tall as one of the best private universities in Gujarat. 
            True to its motto, <strong>"Gyanam Parmam Bhushanam"</strong> (Knowledge is the highest virtue), 
            we don't just teach - we inspire.
          </p>
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">25,000+</span>
              <span className="stat-label">Students</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">150+</span>
              <span className="stat-label">Courses</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">500+</span>
              <span className="stat-label">Recruiters</span>
            </div>
          </div>
          <div className="hero-buttons">
            <Link to="/register" className="btn-primary">Get Started</Link>
            <Link to="/login" className="btn-secondary">Already Registered? Login</Link>
          </div>
        </div>
        
        <div className="hero-visual">
          <div className="orbit-container">
            <div className="center-logo">
              <img 
                src="https://silveroakuni.ac.in/assets/images/logo/sou-l.svg" 
                alt="Silver Oak University Logo" 
                className="sou-logo-main"
              />
            </div>
            {courses.map((course, index) => (
              <div 
                key={index} 
                className={`orbit-item orbit-item-${index + 1}`}
                style={{ '--course-color': course.color }}
              >
                <span className="course-icon" dangerouslySetInnerHTML={{ __html: course.icon }} />
                <span className="course-name">{course.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STATS BAR ============ */}
      <section className="stats-bar">
        <div className="stat-item">
          <span className="stat-number">25,000+</span>
          <span className="stat-label">Students</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">150+</span>
          <span className="stat-label">Courses</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">1000+</span>
          <span className="stat-label">Recruiters</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">80%+</span>
          <span className="stat-label">Placement Rate</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">180+</span>
          <span className="stat-label">Patents Filed</span>
        </div>
      </section>

      {/* ============ ABOUT SECTION ============ */}
      <section className="about-section" id="about">
        <div className="about-container">
          <div className="about-image">
            <img 
              src="https://silveroakuni.ac.in/assets/images/student_group.webp" 
              alt="Silver Oak University Students" 
              className="students-img"
            />
          </div>
          <div className="about-content">
            <h2>About Silver Oak University</h2>
            <p>
              Silver Oak University (SOU) is one of the leading private universities in 
              Ahmedabad-Gujarat, rooted in the legacy of the Silver Oak Group of Institutes. 
              Established in 2009 under the Gujarat Private Universities Act, SOU proudly holds 
              a Grade 'A' accreditation from NAAC.
            </p>
            <p>
              Embodying the motto "Gyanam Parmam Bhushanam" (Knowledge is the highest virtue), 
              SOU offers a future-focused learning environment through a modern curriculum, 
              advanced technology and accomplished faculty.
            </p>
            <div className="about-highlights">
              <div className="highlight">
                <span className="highlight-icon">&#127942;</span>
                <span>7th Rank - Times of India</span>
              </div>
              <div className="highlight">
                <span className="highlight-icon">&#128640;</span>
                <span>Most Innovative Campus - MY FM</span>
              </div>
              <div className="highlight">
                <span className="highlight-icon">&#127891;</span>
                <span>NAAC Grade A Accredited</span>
              </div>
              <div className="highlight">
                <span className="highlight-icon">&#128176;</span>
                <span>Highest Package: 20 LPA</span>
              </div>
            </div>
            <a href="https://silveroakuni.ac.in/about" target="_blank" rel="noopener noreferrer" className="btn-learn-more">
              Learn More About SOU &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ============ CAMPUS GALLERY SLIDER ============ */}
      <section className="campus-section" id="campus">
        <h2>Campus Life at Silver Oak</h2>
        <p className="section-subtitle">Experience vibrant campus life with world-class facilities</p>
        
        <div className="campus-slider">
          {galleryImages.map((img, index) => (
            <div 
              key={index} 
              className={`campus-slide ${index === currentGallery ? 'active' : ''}`}
            >
              <img src={img.url} alt={img.caption} />
              <div className="campus-caption">{img.caption}</div>
            </div>
          ))}
          <div className="campus-dots">
            {galleryImages.map((_, index) => (
              <button 
                key={index} 
                className={`campus-dot ${index === currentGallery ? 'active' : ''}`}
                onClick={() => setCurrentGallery(index)}
              />
            ))}
          </div>
        </div>

        <div className="activities-grid">
          {activities.map((activity, index) => (
            <div key={index} className="activity-card">
              <span className="activity-icon" dangerouslySetInnerHTML={{ __html: activity.icon }} />
              <h4>{activity.name}</h4>
              <p>{activity.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ COURSES ORBIT ============ */}
     

      {/* ============ FEATURES ============ */}
      <section className="features-section" id="features">
        <h2>Why Choose Our Platform ?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">&#128187;</div>
            <h4>Online Exams</h4>
            <p>Take examinations from the comfort of your home with our secure online platform.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#128221;</div>
            <h4>Instant Evaluation</h4>
            <p>Get your results instantly after submission with automated evaluation system.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#128272;</div>
            <h4>Secure Platform</h4>
            <p>Your data and examination papers are fully encrypted and secure.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#128197;</div>
            <h4>Scheduled Exams</h4>
            <p>View your exam schedule and get reminders before each examination.</p>
          </div>
        </div>
      </section>

      {/* ============ RECRUITERS ============ */}
      <section className="recruiters-section">
        <h2>Top Recruiters</h2>
        <div className="recruiters-logos">
          <img src="https://silveroakuni.ac.in/assets/images/recruiter/recruiters/accenture.webp" alt="Accenture" />
          <img src="https://silveroakuni.ac.in/assets/images/recruiter/recruiters/adani_power.webp" alt="Adani Power" />
          <img src="https://silveroakuni.ac.in/assets/images/recruiter/recruiters/coca_cola.webp" alt="Coca Cola" />
          <img src="https://silveroakuni.ac.in/assets/images/recruiter/recruiters/tcs.webp" alt="TCS" />
          <img src="https://silveroakuni.ac.in/assets/images/recruiter/recruiters/zomato.webp" alt="Zomato" />
          <img src="https://silveroakuni.ac.in/assets/images/recruiter/recruiters/royalenfield.webp" alt="Royal Enfield" />
        </div>
      </section>

      {/* ============ CTA SECTION ============ */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Want to Know More About Silver Oak University?</h2>
          <p>Visit our official website for complete information about admissions, courses, campus life, and more.</p>
          <div className="cta-buttons">
            <a href="https://silveroakuni.ac.in" target="_blank" rel="noopener noreferrer" className="btn-primary">
              Visit SOU Website &rarr;
            </a>
            <a href="https://silveroakuni.ac.in/about" target="_blank" rel="noopener noreferrer" className="btn-secondary-light">
              About SOU
            </a>
            <a href="https://silveroakuni.ac.in/galleries" target="_blank" rel="noopener noreferrer" className="btn-secondary-light">
              Photo Gallery
            </a>
            <a href="https://virtualtour.silveroakuni.ac.in/" target="_blank" rel="noopener noreferrer" className="btn-secondary-light">
              Virtual Campus Tour
            </a>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="footer">
        <div className="footer-content">
          <img 
            src="https://silveroakuni.ac.in/assets/images/logo/sou-l.svg" 
            alt="Silver Oak University" 
            className="footer-logo"
          />
          <p>Silver Oak Campus and Research Foundation</p>
          <p>352/353, 370/371, Gota Gam, Ahmedabad, Gujarat 382481</p>
          <p>Contact: 079-35201300 / 079-66046300</p>
          <div className="footer-social">
            <a href="https://www.facebook.com/SilverOakUni" target="_blank" rel="noopener noreferrer">Facebook</a>
            <a href="https://www.instagram.com/silveroakuni/" target="_blank" rel="noopener noreferrer">Instagram</a>
            <a href="https://www.linkedin.com/school/silveroakuni/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://www.youtube.com/@SilverOakUni" target="_blank" rel="noopener noreferrer">YouTube</a>
          </div>
          <p className="copyright">&copy; 2026 Silver Oak University. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
