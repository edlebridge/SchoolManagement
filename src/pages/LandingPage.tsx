import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  GraduationCap,
  Laptop,
  Menu,
  MessageSquare,
  MonitorSmartphone,
  School,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import './landing.css';

const webScreen = '/image copy copy.png';

const featureItems = [
  { icon: GraduationCap, title: 'Student Management', text: 'Keep student profiles, admission details, classes, and parent connections organized in one place.' },
  { icon: Users, title: 'Teacher & Staff Management', text: 'Manage staff records and give teachers the school tools they need for their daily work.' },
  { icon: BookOpen, title: 'Classes & Subjects', text: 'Set up classes, streams, subjects, and teacher assignments around your academic structure.' },
  { icon: CalendarCheck, title: 'Attendance', text: 'Record student attendance and review attendance activity across the school.' },
  { icon: ClipboardList, title: 'Exams, Marks & Results', text: 'Plan exam sessions, enter marks, and publish results for the school community.' },
  { icon: MessageSquare, title: 'Announcements & Messages', text: 'Share announcements and keep school conversations connected across supported experiences.' },
  { icon: CalendarCheck, title: 'Attendance Requests', text: 'Review absence, late arrival, and early collection requests from families.' },
  { icon: BarChart3, title: 'Academic Years', text: 'Organize academic years and terms so school activities stay in context.' },
];

const faqs = [
  ['What is EdLe Bridge?', 'EdLe Bridge is a connected school management platform for school administrators, teachers, and parents. It brings supported school records, academic activities, communication, and family access together across web and mobile.'],
  ['Who can use EdLe Bridge?', 'School administrators and teachers use the web platform. Teachers and parents can also use the mobile app where supported.'],
  ['What is the web platform?', 'The web platform is the desktop and browser experience for managing school information, students, staff, classes, subjects, attendance, exams, results, announcements, and related workflows.'],
  ['Who can use the web platform?', 'The web platform is designed for school administrators and teachers who work from a laptop, desktop, or browser.'],
  ['Who can use the mobile app?', 'The mobile app is designed for teachers and parents who need to stay connected from an Android or iOS device.'],
  ['Can parents use EdLe Bridge?', 'Yes. Parents use the mobile experience to stay connected with their child’s attendance, homework, exams, results, announcements, messages, and supported requests.'],
  ['What features does EdLe Bridge provide?', 'The current application includes student, staff, parent, class, subject, academic year, attendance, exam, marks, results, homework, announcement, message, and attendance-request workflows.'],
  ['What are the different pricing plans?', 'EdLe Bridge currently presents Starter at $40/month, Pro at $99/month, and Enterprise at $249/month. Plan limits are shown below and can be confirmed before publishing.'],
  ['How does a school get started?', 'Use the demo request form to share your school details. The form is prepared for connection to your preferred email, booking, or onboarding process.'],
  ['How can I get support?', 'Support contact details are placeholders for now. Add your preferred support email, phone number, or support link before publishing.'],
  ['Where can I download the mobile app?', 'The App Store and Google Play buttons are prepared as placeholders until the official store links are provided.'],
];

const plans = [
  { name: 'Starter', price: '$40', description: 'A practical starting point for a growing school.', limits: ['Up to 500 students', 'Up to 20 staff'], featured: false },
  { name: 'Pro', price: '$99', description: 'More room for an established school community.', limits: ['Up to 1,000 students', 'Up to 50 staff'], featured: true },
  { name: 'Enterprise', price: '$249', description: 'Flexible capacity for larger school communities.', limits: ['Unlimited students', 'Unlimited staff'], featured: false },
];

const comparisonRows = [
  ['Student management', true, true, true],
  ['Teacher & staff management', true, true, true],
  ['Classes and subjects', true, true, true],
  ['Attendance workflows', true, true, true],
  ['Exam sessions, marks & results', true, true, true],
  ['Announcements and messages', true, true, true],
  ['Parent access', true, true, true],
  ['Attendance requests', true, true, true],
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`landing-brand${compact ? ' landing-brand-compact' : ''}`} href="#home" aria-label="EdLe Bridge home">
      <span className="landing-brand-mark">E</span>
      <span className="landing-brand-copy"><strong>EdLe<span>Bridge</span></strong><small>School platform</small></span>
    </a>
  );
}

function ProductDashboardVisual() {
  return (
    <div className="product-visual" aria-label="Preview of the EdLe Bridge web platform">
      <div className="browser-bar"><span /><span /><span /><div className="browser-address">EdLe Bridge web platform</div></div>
      <div className="real-screen-frame"><img src={webScreen} alt="EdLe Bridge student management screen" /></div>
    </div>
  );
}

function MobilePreview() {
  return (
    <div className="phone-stage" aria-label="Replaceable preview of the EdLe Bridge mobile app">
      <div className="phone-backdrop" />
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-top"><span>9:41</span><span>•••</span></div>
        <div className="phone-content"><small>EDLE BRIDGE</small><h3>Good afternoon,<br /><strong>Parent</strong></h3><p>Here is your child’s school overview.</p><div className="child-card"><div className="child-avatar">AM</div><div><b>Abubakar Mohamed</b><span>ADM00001 · Year 8</span></div><i>Active</i></div><div className="phone-metrics"><div><CalendarCheck /><b>94%</b><span>Attendance</span></div><div><BookOpen /><b>6</b><span>Homework</span></div></div><div className="phone-section"><b>Recent homework</b><div className="phone-item"><BookOpen /><span>Mathematics revision<br /><small>Due tomorrow</small></span></div><div className="phone-item"><ClipboardList /><span>Mid-term preparation<br /><small>Due Friday</small></span></div></div></div><div className="phone-nav"><span>Home</span><span>Results</span><span>Messages</span><span>Profile</span></div>
      </div>
      <div className="preview-label"><Smartphone /> Replaceable app preview</div>
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const handleDemoSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDemoSubmitted(true);
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-container header-inner">
          <BrandLogo />
          <button className="mobile-menu-button" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button>
          <nav className={`landing-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
            <a href="#home" onClick={closeMenu}>Home</a><a href="#features" onClick={closeMenu}>Features</a><a href="#how-it-works" onClick={closeMenu}>How It Works</a><a href="#pricing" onClick={closeMenu}>Pricing</a><a href="#faqs" onClick={closeMenu}>FAQs</a><a href="#support" onClick={closeMenu}>Support</a>
            <div className="nav-actions"><a className="nav-login" href="/login" onClick={closeMenu}>Login</a><a className="button button-small" href="#demo" onClick={closeMenu}>Get Started <ArrowRight /></a></div>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
          <div className="landing-container hero-grid">
            <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> One connected school community</div><h1>Connect Your Entire School Community with <span>EdLe Bridge</span></h1><p>EdLe Bridge brings school management, communication, teachers, parents, and everyday school activities together in one connected platform.</p><div className="hero-actions"><a className="button" href="#demo">Get Started <ArrowRight /></a><button className="button button-outline" type="button" onClick={() => scrollToSection('experiences')}>Explore EdLe Bridge <ArrowRight /></button></div><a className="hero-login" href="/login"><Laptop /> Login to Web Platform</a><div className="hero-note"><ShieldCheck /> Built around the real workflows your school already uses</div></div>
            <div className="hero-product"><div className="floating-note note-top"><MonitorSmartphone /><span><b>Web + Mobile</b><small>One connected platform</small></span></div><ProductDashboardVisual /><div className="floating-note note-bottom"><div className="mini-check"><Check /></div><span><b>Stay in sync</b><small>Where your community needs it</small></span></div></div>
          </div>
          <div className="hero-scroll-hint"><span /> Scroll to explore</div>
        </section>

        <section className="trust-strip"><div className="landing-container trust-inner"><span>Built for the rhythm of school life</span><div><School /> School administration</div><div><Users /> Teachers & families</div><div><MonitorSmartphone /> Web and mobile access</div></div></section>

        <section className="section section-light" id="experiences"><div className="landing-container"><div className="section-heading center"><div className="eyebrow">Choose the experience that fits your day</div><h2>EdLe Bridge Works Where Your School Community Needs It</h2><p>One platform, with focused experiences for the people who keep a school moving.</p></div><div className="experience-grid"><article className="experience-card web-card"><div className="card-kicker"><Laptop /> Web platform</div><h3>EdLe Bridge Web Platform</h3><p>Access EdLe Bridge from a laptop, desktop, or web browser.</p><div className="designed-for"><span>Designed for</span><b>School Admins</b><b>Teachers</b></div><div className="mini-browser"><div className="mini-browser-top"><span /><span /><span /></div><img src={webScreen} alt="EdLe Bridge student management screen" /></div><a className="text-link" href="/login">Login to Web Platform <ArrowRight /></a></article><article className="experience-card mobile-card"><div className="card-kicker"><Smartphone /> Mobile app</div><h3>EdLe Bridge Mobile App</h3><p>Stay connected with EdLe Bridge from your mobile device.</p><div className="designed-for"><span>Designed for</span><b>Teachers</b><b>Parents</b></div><div className="experience-phone"><MobilePreview /></div><div className="store-row"><a href="#mobile-download" className="store-button"><span>Download on the</span><b>App Store</b></a><a href="#mobile-download" className="store-button"><span>GET IT ON</span><b>Google Play</b></a></div></article></div></div></section>

        <section className="section section-tinted" id="features"><div className="landing-container"><div className="section-heading"><div className="eyebrow">A clearer way to run school life</div><h2>Everything Your School Needs, Connected in One Place</h2><p>Real workflows from the EdLe Bridge application, brought into one dependable school platform.</p></div><div className="feature-grid">{featureItems.map(({ icon: Icon, title, text }) => <article className="feature-card" key={title}><div className="icon-box"><Icon /></div><h3>{title}</h3><p>{text}</p><span className="feature-arrow"><ArrowRight /></span></article>)}</div></div></section>

        <section className="section section-dark audience-section"><div className="landing-container"><div className="section-heading center light-heading"><div className="eyebrow">A place for every part of your school</div><h2>Who Is EdLe Bridge For?</h2><p>Keep each person close to the workflows and information they need.</p></div><div className="audience-grid"><article><div className="audience-icon"><School /></div><h3>School Admins</h3><p>Manage school information, students, staff, academic activities, attendance, and supported school functions.</p><a href="#web-platform">Web Platform <ArrowRight /></a></article><article><div className="audience-icon"><GraduationCap /></div><h3>Teachers</h3><p>Access teaching, timetable, attendance, student, homework, exam, results, and communication features.</p><a href="#web-platform">Web Platform / Mobile App <ArrowRight /></a></article><article><div className="audience-icon"><Users /></div><h3>Parents</h3><p>Stay connected with your child’s school through the EdLe Bridge mobile experience.</p><a href="#mobile-app">Mobile App <ArrowRight /></a></article></div></div></section>

        <section className="section section-light" id="how-it-works"><div className="landing-container"><div className="section-heading center"><div className="eyebrow">Simple to understand</div><h2>How It Works</h2><p>EdLe Bridge connects your school community in three clear steps.</p></div><div className="steps-grid"><article><div className="step-number">01</div><div><h3>Your School Connects</h3><p>The school sets up its EdLe Bridge environment.</p></div></article><article><div className="step-number">02</div><div><h3>Staff & Families Connect</h3><p>School administrators, teachers, and parents access the appropriate EdLe Bridge experience.</p></div></article><article><div className="step-number">03</div><div><h3>Manage & Stay Connected</h3><p>The school community uses EdLe Bridge to manage information, communicate, and stay connected.</p></div></article></div></div></section>

        <section className="section platform-section" id="web-platform"><div className="landing-container platform-grid"><div className="platform-copy"><div className="eyebrow">The web platform</div><h2>Powerful School Management From Your Desktop</h2><p>School administrators and teachers can access EdLe Bridge from a laptop or desktop browser to manage supported school activities and day-to-day operations.</p><ul className="check-list"><li><Check /> Students, staff, classes, and subjects</li><li><Check /> Attendance, exams, marks, and results</li><li><Check /> Announcements, messages, and requests</li></ul><div className="platform-actions"><a className="button" href="/login">Login to Web Platform <ArrowRight /></a><a className="button button-outline" href="#demo">Get Started</a></div></div><div className="platform-screen"><ProductDashboardVisual /></div></div></section>

        <section className="section mobile-section" id="mobile-app"><div className="landing-container mobile-grid"><div className="mobile-art"><MobilePreview /></div><div className="platform-copy"><div className="eyebrow">The mobile app</div><h2>Stay Connected Wherever You Are</h2><p>Teachers and parents can use the EdLe Bridge mobile app to stay connected with the school community from their Android or iOS device.</p><ul className="check-list"><li><Check /> Teachers can stay close to classes, homework, exams, and requests</li><li><Check /> Parents can follow attendance, homework, results, and announcements</li><li><Check /> Store links are ready to add when your official app listings are live</li></ul><div className="store-row large-stores" id="mobile-download"><a href="#mobile-download" className="store-button"><Download /><span>Download on the</span><b>App Store</b></a><a href="#mobile-download" className="store-button"><Download /><span>GET IT ON</span><b>Google Play</b></a></div><small className="placeholder-note">Official app store links will be added before publishing.</small></div></div></section>

        <section className="section benefits-section"><div className="landing-container"><div className="section-heading center"><div className="eyebrow">Why a connected platform?</div><h2>Designed Around Your School Community</h2></div><div className="benefit-grid"><article><Sparkles /><h3>One Connected Platform</h3><p>Bring school information and supported workflows together.</p></article><article><MessageSquare /><h3>Better Communication</h3><p>Help schools and families stay connected through supported messages and announcements.</p></article><article><Laptop /><h3>Easier School Management</h3><p>Access school management tools from the web platform.</p></article><article><Smartphone /><h3>Mobile Access</h3><p>Allow teachers and parents to stay connected through the mobile app.</p></article><article><School /><h3>Built for Schools</h3><p>Use a platform shaped around school administration and the school community.</p></article></div></div></section>

        <section className="section pricing-section" id="pricing"><div className="landing-container"><div className="section-heading center"><div className="eyebrow">Plans for different school sizes</div><h2>Simple Pricing to Get Started</h2><p>Choose a starting plan for your school. Final pricing can be confirmed before launch.</p></div><div className="pricing-grid">{plans.map((plan) => <article className={`pricing-card${plan.featured ? ' featured' : ''}`} key={plan.name}>{plan.featured && <div className="popular-tag">Most flexible</div>}<h3>{plan.name}</h3><p>{plan.description}</p><div className="price"><strong>{plan.price}</strong><span>/month</span></div><ul>{plan.limits.map((limit) => <li key={limit}><Check /> {limit}</li>)}</ul><a className={plan.featured ? 'button' : 'button button-outline'} href="#demo">Get Started <ArrowRight /></a></article>)}</div><button className="comparison-toggle" type="button" onClick={() => setShowComparison((show) => !show)}>Compare All Features <ChevronDown className={showComparison ? 'rotate' : ''} /></button>{showComparison && <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Feature</th><th>Starter</th><th>Pro</th><th>Enterprise</th></tr></thead><tbody>{comparisonRows.map(([name, starter, pro, enterprise]) => <tr key={String(name)}><td>{name}</td>{[starter, pro, enterprise].map((available, index) => <td key={`${String(name)}-${index}`}>{available ? <Check /> : '—'}</td>)}</tr>)}</tbody></table></div>}</div></section>

        <section className="section faq-section" id="faqs"><div className="landing-container faq-grid"><div className="section-heading"><div className="eyebrow">Questions, answered</div><h2>Everything You Need to Know</h2><p>Still deciding which experience fits your school community? Start here.</p><a className="text-link" href="#support">Talk to support <ArrowRight /></a></div><div className="faq-list">{faqs.map(([question, answer], index) => <div className={`faq-item${openFaq === index ? ' open' : ''}`} key={question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{question}</span><ChevronDown /></button>{openFaq === index && <p>{answer}</p>}</div>)}</div></div></section>

        <section className="section contact-section" id="support"><div className="landing-container contact-grid"><div><div className="eyebrow">Support & contact</div><h2>Need Help With EdLe Bridge?</h2><p>We’re preparing the right place for schools, teachers, and families to get answers. Add your official support details before publishing.</p><div className="contact-links"><div><MessageSquare /><span><b>Visit Support</b><small>Support link placeholder</small></span></div><div><Users /><span><b>Contact Support</b><small>support@example.com placeholder</small></span></div></div></div><div className="contact-placeholder"><h3>Contact details to add</h3><p>Email · Phone · Address</p><span>Replace these placeholders with your official school or company contact information.</span></div></div></section>

        <section className="section demo-section" id="demo"><div className="landing-container demo-grid"><div className="demo-copy"><div className="eyebrow">Bring your school on board</div><h2>Book a Demo</h2><p>Tell us a little about your school and we’ll connect this form to your preferred booking or contact process.</p><div className="demo-points"><span><Check /> For schools and administrators</span><span><Check /> No invented booking links</span><span><Check /> Ready for your final contact details</span></div></div><form className="demo-form" onSubmit={handleDemoSubmit}><div className="form-row"><label>Name<input required name="name" placeholder="Your name" /></label><label>School Name<input required name="school" placeholder="Your school" /></label></div><div className="form-row"><label>Email<input required type="email" name="email" placeholder="you@school.edu" /></label><label>Phone<input name="phone" placeholder="Phone number" /></label></div><label>Number of Students<select name="students" defaultValue=""><option value="" disabled>Select a range</option><option>Up to 500</option><option>501–1,000</option><option>More than 1,000</option></select></label><label>Message<textarea name="message" rows={4} placeholder="Tell us what your school needs" /></label>{demoSubmitted && <p className="form-notice">This demo form is ready to connect to your email or booking service. Add that connection before publishing.</p>}<button className="button" type="submit">Request a Demo <ArrowRight /></button></form></div></section>

        <section className="final-cta"><div className="landing-container final-cta-inner"><div><div className="eyebrow">One community, better connected</div><h2>Bring Your School Community Together with EdLe Bridge</h2><p>One connected platform for school management, communication, teachers, and parents.</p></div><div className="final-actions"><a className="button" href="#demo">Get Started <ArrowRight /></a><a className="button button-light-outline" href="/login">Login to Web Platform</a><a className="button button-light-outline" href="#mobile-download">Download the App</a></div></div></section>
      </main>

      <footer className="landing-footer"><div className="landing-container footer-grid"><div className="footer-brand"><BrandLogo compact /><p>A connected school management platform for schools, teachers, and parents.</p><div className="footer-placeholder">Official contact details coming soon</div></div><div><h3>Explore</h3><a href="#home">Home</a><a href="#features">Features</a><a href="#how-it-works">How It Works</a><a href="#pricing">Pricing</a></div><div><h3>Resources</h3><a href="#faqs">FAQs</a><a href="#support">Support</a><a href="#demo">Contact</a><a href="#demo">Book a Demo</a><a href="/login">Login</a></div><div><h3>Get the app</h3><a href="#mobile-download">App Store</a><a href="#mobile-download">Google Play</a><h3 className="footer-legal-heading">Legal</h3><a href="#">Privacy Policy placeholder</a><a href="#">Terms of Service placeholder</a></div></div><div className="landing-container footer-bottom"><span>© {new Date().getFullYear()} EdLe Bridge. All rights reserved.</span><span>Built for connected school communities.</span></div></footer>
    </div>
  );
}
