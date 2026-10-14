import { useEffect, useRef, useState } from 'react'
import { Turnstile } from './Turnstile'

const CONTACT_EMAIL = 'ext.eklavya@gmail.com'

type ContactFields = {
  name: string
  email: string
  subject: string
  message: string
}

function buildEmailDraft(fields: ContactFields) {
  const body = `Name: ${fields.name}\nEmail: ${fields.email}\n\n${fields.message}`
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(fields.subject || 'Portfolio Contact')}&body=${encodeURIComponent(body)}`
}

const projects = [
  {
    id: 'orbiz',
    number: '01',
    name: 'Orbiz',
    subtitle: 'Campus services in one place',
    category: 'Full-stack development',
    teamLabel: 'Team project',
    year: '2025–26',
    description:
      'Orbiz brings canteen ordering, queue management, and campus navigation into one platform. It combines a shared sign-in with an interactive 3D map, with features for finding locations, checking congestion, and viewing teacher availability.',
    contributionLabel: 'My contribution',
    contribution:
      'I built Campus Cart, the canteen-ordering component of Orbiz, as part of our team project. This was my main implementation contribution to the wider campus platform.',
    operationNote: '',
    detailLabel: 'Technical focus',
    detail:
      'Connecting everyday campus services through a shared interface and authentication flow.',
    tech: ['React', 'TypeScript', 'FastAPI', 'Three.js', 'PostgreSQL'],
    additional: 'PyJWT',
    recognitionLabel: 'Recognition',
    recognition: 'Winner · August Tinkering Lab Challenge',
    linkLabel: 'View code',
    github: 'https://github.com/eklvy/Orbiz',
  },
  {
    id: 'sovereign',
    number: '02',
    name: 'Sovereign AI',
    subtitle: 'An AI workbench for industrial fault investigation',
    category: 'Local AI · Industrial systems',
    teamLabel: 'Team project',
    year: '2025–26',
    description:
      'Sovereign AI explores how an industrial AI assistant can support fault investigation without relying on cloud services. The workbench combines a digital twin, document retrieval, and a knowledge graph to bring relevant evidence into the investigation.',
    contributionLabel: 'My contribution',
    contribution:
      'I worked on the frontend and its connection to the local backend/server. My focus was on bringing live data updates into the interface within an offline setup.',
    operationNote:
      'The interface and backend communicate locally, without relying on internet access for that communication.',
    detailLabel: 'Design principle',
    detail:
      'The language model provides advice. Deterministic rules define safety boundaries, and shutdown decisions remain with human operators.',
    tech: ['LangGraph', 'llama.cpp', 'Qdrant', 'Neo4j'],
    additional: 'LangChain · MQTT · Modbus',
    recognitionLabel: 'Recognition',
    recognition: '1st place · SIH internal round',
    linkLabel: 'View code',
    github: 'https://github.com/eklvy/Sovereign',
  },
  {
    id: 'amda',
    number: '03',
    name: 'AMDA',
    subtitle: 'Adaptive Model Drift Analysis',
    category: 'Machine learning research',
    teamLabel: 'Team research',
    year: '2025–26',
    description:
      'AMDA is a team research project studying how drift-detection methods behave as data changes. The study spans synthetic streams, tabular data, network traffic, time series, and visual anomaly detection.',
    contributionLabel: 'Research focus',
    contribution:
      'The study asks how well drift-detection methods carry over from controlled experiments to more complex data.',
    operationNote: '',
    detailLabel: '',
    detail: '',
    tech: ['Python', 'stream-learn', 'LSTMs / TCNs', 'Autoencoders', 'SMOTE'],
    additional: '',
    recognitionLabel: 'Status',
    recognition: 'Research in progress · Paper in preparation',
    linkLabel: 'Explore the repository',
    github: 'https://github.com/eklvy/AMDA',
  },
]

/*
 * Editor notes — no authentic project visuals are currently available in the supplied
 * assets. Request a Campus Cart interface screenshot, a Sovereign AI frontend screenshot
 * or accurate supplied diagram, and an AMDA research figure or experiment output.
 * Also request Eklavya's specific AMDA research contribution and one supported observation.
 * Do not publish missing details until they are supplied.
 */

const skills = [
  { group: 'Languages', items: ['Python', 'JavaScript', 'TypeScript', 'C++'] },
  {
    group: 'Machine learning and research',
    items: [
      'PyTorch',
      'TensorFlow',
      'Concept drift detection',
      'LSTMs / TCNs',
      'Autoencoders',
      'SMOTE',
    ],
  },
  {
    group: 'LLM systems',
    items: ['RAG / GraphRAG', 'LLM fine-tuning', 'LangGraph', 'LangChain', 'llama.cpp'],
  },
  {
    group: 'Web and data',
    items: ['React', 'FastAPI', 'Three.js', 'PostgreSQL', 'SQLite', 'Neo4j', 'Qdrant'],
  },
  {
    group: 'Development tools and protocols',
    items: ['Git', 'Docker', 'Figma', 'MQTT', 'Modbus'],
  },
]

const achievements = [
  {
    number: '01',
    placement: 'Winner',
    competition: 'August Tinkering Lab Challenge',
    context: 'Project: Orbiz',
  },
  {
    number: '02',
    placement: '1st place',
    competition: 'SIH internal round',
    context: 'Project: Sovereign AI',
  },
  {
    number: '03',
    placement: '1st place',
    competition: 'GeeksforGeeks DSA Summer Contest',
    context: 'Final contest in the summer programme',
  },
]

// Editor note: request missing dates, organisers, and evidence links for recognition entries.

const navLinks = [
  { label: 'Work', href: '#work' },
  { label: 'About', href: '#about' },
  { label: 'Skills', href: '#skills' },
  { label: 'Contact', href: '#contact' },
]

function ArrowLink({
  href,
  children,
  external = false,
  className = '',
}: {
  href: string
  children: React.ReactNode
  external?: boolean
  className?: string
}) {
  return (
    <a
      href={href}
      className={`arrow-link ${className}`}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      <span>{children}</span>
      <span className="arrow" aria-hidden="true">→</span>
    </a>
  )
}

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const toggleMenu = () => setMenuOpen(open => !open)

  useEffect(() => {
    if (!menuOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <div className="nav-inner">
        <a className="wordmark" href="#top" aria-label="Eklavya Gogia, back to top">
          Eklavya Gogia
        </a>
        <div className="desktop-nav">
          {navLinks.map(link => (
            <a key={link.label} href={link.href} className="nav-link">
              {link.label}
            </a>
          ))}
        </div>
        <button
          ref={menuButtonRef}
          className="menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          onClick={toggleMenu}
          onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            toggleMenu()
          }}
        >
          <span />
          <span />
        </button>
      </div>
      <div
        id="mobile-navigation"
        className={`mobile-nav ${menuOpen ? 'is-open' : ''}`}
        aria-hidden={!menuOpen}
      >
        {navLinks.map(link => (
          <a
            key={link.label}
            href={link.href}
            className="nav-link"
            tabIndex={menuOpen ? 0 : -1}
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <header id="top" className="hero page-shell">
      <div className="hero-copy">
        <p className="eyebrow">AI / ML · Software · Research</p>
        <h1>
          AI systems for <span className="no-break">real-world</span> constraints.
        </h1>
        <p className="hero-intro">
          I’m Eklavya Gogia, an AI/ML undergraduate at The NorthCap University. My work spans campus
          software, local AI systems, and research into how models behave as data changes.
        </p>
        <p className="hero-support">
          I’m especially interested in building with limited hardware, unreliable connectivity, and
          human oversight in mind.
        </p>
        <div className="hero-actions">
          <ArrowLink href="#work">Explore my work</ArrowLink>
          <ArrowLink href="#contact" className="arrow-link-secondary">Get in touch</ArrowLink>
        </div>
      </div>
      <div className="hero-portrait framed-corners">
        <img src="/eklavya.jpg" alt="Eklavya Gogia" />
      </div>
    </header>
  )
}

function ProjectMasthead({ project }: { project: (typeof projects)[number] }) {
  return (
    <div className="project-masthead framed-corners" aria-label={`${project.name} title graphic`}>
      <div className="masthead-topline">
        <span>Project {project.number}</span>
        <span>{project.category}</span>
      </div>
      <div className="masthead-title">{project.name}</div>
      <div className="masthead-subtitle">{project.subtitle}</div>
    </div>
  )
}

function Projects() {
  return (
    <section id="work" className="projects-section section-space page-shell">
      <div className="section-intro">
        <p className="eyebrow">Work</p>
        <h2>Selected work</h2>
        <p>
          Three team projects spanning campus software, local AI, and machine learning research,
          with my contributions outlined below.
        </p>
      </div>

      <div className="project-list">
        {projects.map((project, index) => (
          <article
            key={project.id}
            id={project.id}
            className={`project-feature ${index % 2 ? 'project-feature-reverse' : ''}`}
          >
            <header className="project-header">
              <div className="project-kicker">
                <span>{project.number}</span>
                <span>{project.category}</span>
                <span>{project.teamLabel}</span>
                <span>{project.year}</span>
              </div>
              <h3>{project.name}</h3>
              <p className="project-subtitle">{project.subtitle}</p>
            </header>

            <ProjectMasthead project={project} />

            <div className="project-content">
              <p className="project-description">{project.description}</p>

              <div className="contribution-note">
                <p className="detail-label">{project.contributionLabel}</p>
                <p>{project.contribution}</p>
              </div>

              {project.operationNote && (
                <p className="operation-note">
                  <span>Offline operation</span>
                  {project.operationNote}
                </p>
              )}

              {project.detailLabel && (
                <div className="project-detail">
                  <p className="detail-label">{project.detailLabel}</p>
                  <p>{project.detail}</p>
                </div>
              )}

              <div className="technology-list" aria-label={`${project.name} technologies`}>
                {project.tech.map(technology => (
                  <span key={technology}>{technology}</span>
                ))}
              </div>

              {project.additional && (
                <p className="additional-detail">
                  <span>Additional technical detail</span>
                  {project.additional}
                </p>
              )}

              <div className="project-footer">
                <div className="project-status">
                  <span>{project.recognitionLabel}</span>
                  <strong>{project.recognition}</strong>
                </div>
                <ArrowLink href={project.github} external>
                  {project.linkLabel}
                </ArrowLink>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function About() {
  return (
    <section id="about" className="about-section section-space">
      <div className="page-shell about-layout">
        <p className="eyebrow">About</p>
        <div className="about-content">
          <h2>What I’m working toward</h2>
          <div className="about-copy">
            <p>
              I’m an AI/ML undergraduate at The NorthCap University, graduating in 2028. My recent
              work includes building Campus Cart within Orbiz, working on the frontend and local
              server connectivity for Sovereign AI, and contributing to the AMDA research project.
            </p>
            <p>
              I’m interested in how the pieces of a system work together: the interface people use,
              the backend it connects to, and the models working with its data. I’m looking to
              develop that understanding further through engineering work and research.
            </p>
          </div>
          <ArrowLink href="#contact">Get in touch</ArrowLink>
        </div>
      </div>
    </section>
  )
}

function Skills() {
  return (
    <section id="skills" className="skills-section section-space page-shell">
      <div className="compact-section-header">
        <div>
          <p className="eyebrow">Skills</p>
          <h2>Tools behind the work</h2>
        </div>
        <p>
          The languages, frameworks, and methods I use across software projects and machine learning
          research.
        </p>
      </div>

      <div className="skills-grid">
        {skills.map((skill, index) => (
          <div className="skill-group" key={skill.group}>
            <div className="skill-heading">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{skill.group}</h3>
            </div>
            <div className="skill-list">
              {skill.items.map(item => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Recognition() {
  return (
    <section className="recognition-section section-space">
      <div className="page-shell">
        <div className="compact-section-header">
          <div>
            <p className="eyebrow">Recognition</p>
            <h2>Awards and competitions</h2>
          </div>
        </div>
        <div className="recognition-list">
          {achievements.map(achievement => (
            <div className="recognition-row" key={achievement.number}>
              <span className="recognition-number">{achievement.number}</span>
              <strong>{achievement.placement}</strong>
              <div>
                <h3>{achievement.competition}</h3>
                <p>{achievement.context}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Contact() {
  const [fields, setFields] = useState<ContactFields>({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [honeypot, setHoneypot] = useState('')
  const [siteKey, setSiteKey] = useState('')
  const [token, setToken] = useState('')
  const [challengeVersion, setChallengeVersion] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const directSubmissionEnabled = Boolean(siteKey)
  const [submissionState, setSubmissionState] = useState<
    'ready' | 'pending' | 'success' | 'error'
  >('ready')
  const submissionPending = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    fetch('/api/contact/config', { signal: controller.signal, credentials: 'same-origin' })
      .then(async response => response.ok ? response.json() : null)
      .then(config => {
        if (!controller.signal.aborted && config?.enabled === true && typeof config.siteKey === 'string' && config.siteKey) {
          setSiteKey(config.siteKey)
        }
      })
      .catch(() => { /* Direct email remains available if the backend is not configured. */ })
      .finally(() => window.clearTimeout(timeout))
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [])

  const set =
    (key: keyof typeof fields) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (submissionState === 'success' || submissionState === 'error') {
        setSubmissionState('ready')
      }
      setFields(current => ({ ...current, [key]: event.target.value }))
    }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!directSubmissionEnabled) {
      window.location.href = buildEmailDraft(fields)
      return
    }

    if (submissionPending.current) return
    if (!token) {
      setErrorMessage('Please complete the spam verification, or email me directly.')
      setSubmissionState('error')
      return
    }
    submissionPending.current = true
    setSubmissionState('pending')
    setErrorMessage('')

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(25000),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fields.name.trim(),
          email: fields.email.trim(),
          subject: fields.subject.trim(),
          message: fields.message.trim(),
          website: honeypot,
          token,
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok || result?.ok !== true) {
        if (response.status === 429) {
          setErrorMessage('Too many attempts. Please try again later or email me directly.')
        } else if (response.status === 400) {
          setErrorMessage('Please check the form and complete the verification again.')
        }
        throw new Error('Submission could not be confirmed')
      }

      setSubmissionState('success')
      setFields({ name: '', email: '', subject: '', message: '' })
      setHoneypot('')
    } catch {
      setSubmissionState('error')
    } finally {
      submissionPending.current = false
      setToken('')
      setChallengeVersion(current => current + 1)
    }
  }

  const emailDraft = buildEmailDraft(fields)
  const statusMessage =
    submissionState === 'success'
      ? 'Your message has been submitted. Thanks for getting in touch.'
      : submissionState === 'error'
        ? errorMessage || 'Your submission could not be confirmed. Please try again or email me directly.'
        : ''

  return (
    <section id="contact" className="contact-section section-space">
      <div className="page-shell contact-grid">
        <div className="contact-intro">
          <p className="eyebrow">Contact</p>
          <h2>What are you working on?</h2>
          <p className="contact-body">
            Have an internship opportunity, a research question, or a project related to my work?
            Tell me a little about it and how I could contribute.
          </p>

          <div className="contact-options">
            <a href="mailto:ext.eklavya@gmail.com">
              <span>Email</span>
              <strong>ext.eklavya@gmail.com</strong>
            </a>
            <a href="https://github.com/eklvy" target="_blank" rel="noreferrer">
              <span>GitHub</span>
              <strong>github.com/eklvy</strong>
            </a>
            <a
              href="https://www.linkedin.com/in/eklavya-gogia-67b00a321/"
              target="_blank"
              rel="noreferrer"
            >
              <span>LinkedIn</span>
              <strong>linkedin.com/in/eklavya-gogia</strong>
            </a>
          </div>
        </div>

        <form className="contact-form framed-corners" onSubmit={handleSubmit}>
          <div className="form-honeypot" aria-hidden="true">
            <label htmlFor="contact-website">Leave this field empty</label>
            <input
              id="contact-website"
              name="website"
              type="text"
              value={honeypot}
              onChange={event => setHoneypot(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="contact-name">Name</label>
              <input
                id="contact-name"
                name="name"
                type="text"
                placeholder="Your name"
                value={fields.name}
                disabled={submissionState === 'pending'}
                onChange={set('name')}
                minLength={2}
                maxLength={100}
                autoComplete="name"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="contact-email">Email</label>
              <input
                id="contact-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={fields.email}
                disabled={submissionState === 'pending'}
                onChange={set('email')}
                maxLength={254}
                autoComplete="email"
                required
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="contact-subject">Subject — optional</label>
            <input
              id="contact-subject"
              name="subject"
              type="text"
              placeholder="What would you like to discuss?"
              value={fields.subject}
              disabled={submissionState === 'pending'}
              onChange={set('subject')}
              maxLength={160}
            />
          </div>
          <div className="form-field">
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              name="message"
              placeholder="Tell me about the opportunity, question, or project."
              value={fields.message}
              disabled={submissionState === 'pending'}
              onChange={set('message')}
              minLength={10}
              maxLength={5000}
              required
            />
          </div>
          {directSubmissionEnabled && (
            <div>
              <Turnstile key={challengeVersion} siteKey={siteKey}
                onToken={value => { setToken(value); if (value) setErrorMessage('') }}
                onError={() => {
                  setErrorMessage('Spam verification could not load. Please retry or email me directly.')
                  setSubmissionState(current => current === 'pending' || current === 'success' ? current : 'error')
                }} />
              {!token && (
                <button className="verification-retry" type="button" disabled={submissionState === 'pending'}
                  onClick={() => { setErrorMessage(''); setSubmissionState('ready'); setChallengeVersion(current => current + 1) }}>
                  Retry verification
                </button>
              )}
            </div>
          )}
          <p className="form-helper">
            {directSubmissionEnabled
              ? 'Direct submission is available. You can also open a draft in your email app.'
              : 'This form opens a draft in your email app.'}
          </p>
          <div className="form-actions">
            <button
              type="submit"
              className="contact-submit"
              disabled={submissionState === 'pending'}
            >
              <span>
                {directSubmissionEnabled
                  ? submissionState === 'pending'
                    ? 'Sending…'
                    : 'Send message'
                  : 'Open email draft'}
              </span>
              {submissionState !== 'pending' && (
                <span className="arrow" aria-hidden="true">→</span>
              )}
            </button>
            {directSubmissionEnabled && (
              <a className="email-draft-link" href={emailDraft}>
                Open email draft →
              </a>
            )}
          </div>
          <p
            className={`form-status ${submissionState === 'error' ? 'form-status-error' : ''}`}
            role={submissionState === 'error' ? 'alert' : 'status'}
            aria-live={submissionState === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            {statusMessage}
          </p>
        </form>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="site-footer page-shell">
      <div className="footer-identity">
        <p>Eklavya Gogia</p>
        <span>AI/ML undergraduate · The NorthCap University</span>
      </div>
      <div className="footer-links" aria-label="Footer navigation">
        {navLinks.map(link => (
          <a key={link.label} href={link.href}>
            {link.label}
          </a>
        ))}
      </div>
      <div className="footer-links footer-social">
        <a href="https://github.com/eklvy" target="_blank" rel="noreferrer">GitHub</a>
        <a
          href="https://www.linkedin.com/in/eklavya-gogia-67b00a321/"
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
        <a href="#top">Back to top ↑</a>
      </div>
      <p className="copyright">© 2026 Eklavya Gogia. All rights reserved.</p>
    </footer>
  )
}

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Projects />
        <About />
        <Skills />
        <Recognition />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
