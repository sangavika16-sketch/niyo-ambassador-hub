
import { useState, useEffect } from 'react'
import './App.css'
import Auth from './Auth'
import { supabase } from './supabaseClient'

// REUSABLE PAGE HEADER
function PageHeader({ eyebrow, title, description, badge }) {
  return (
    <div className="welcome-section">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {badge && <div className="welcome-badge">{badge}</div>}
    </div>
  )
}

// REUSABLE STATISTICS CARD
function StatCard({ icon, color, label, value, note }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${color}`}>{icon}</span>
      <p>{label}</p>
      <h2>{value}</h2>
      <span className="stat-note">{note}</span>
    </div>
  )
}

function App() {
  // ==========================================
  // AUTHENTICATION & PROFILE
  // ==========================================

  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [ambassadorProfile, setAmbassadorProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // ==========================================
  // REFERRAL STATE
  // ==========================================

  const [referrals, setReferrals] = useState([])
  const [referralsLoading, setReferralsLoading] = useState(false)
  const [addingReferral, setAddingReferral] = useState(false)
  const [studentName, setStudentName] = useState('')
  const [collegeName, setCollegeName] = useState('')

  // ==========================================
  // AUTHENTICATION SESSION
  // ==========================================

  useEffect(() => {
    let mounted = true

    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Session error:', error.message)
      }

      if (mounted) {
        setUser(data?.session?.user ?? null)
        setAuthLoading(false)
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ==========================================
  // LOAD OR CREATE AMBASSADOR PROFILE
  // ==========================================

  useEffect(() => {
    if (!user) {
      setAmbassadorProfile(null)
      return
    }

    let cancelled = false

    const loadAmbassadorProfile = async () => {
      setProfileLoading(true)

      try {
        const { data: existingProfile, error: fetchError } =
          await supabase
            .from('ambassadors')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle()

        if (fetchError) throw fetchError

        if (existingProfile) {
          if (!cancelled) {
            setAmbassadorProfile(existingProfile)
          }
          return
        }

        const { data: newProfile, error: insertError } =
          await supabase
            .from('ambassadors')
            .insert({
              user_id: user.id,
              full_name:
                user.user_metadata?.full_name ||
                user.email?.split('@')[0] ||
                'Ambassador',
              email: user.email,
            })
            .select()
            .single()

        if (insertError) throw insertError

        if (!cancelled) {
          setAmbassadorProfile(newProfile)
        }
      } catch (error) {
        console.error('Ambassador profile error:', error.message)
      } finally {
        if (!cancelled) {
          setProfileLoading(false)
        }
      }
    }

    loadAmbassadorProfile()

    return () => {
      cancelled = true
    }
  }, [user])

  // ==========================================
  // LOAD REFERRALS FROM SUPABASE
  // ==========================================

  useEffect(() => {
    if (!ambassadorProfile) {
      setReferrals([])
      setReferralsLoading(false)
      return
    }

    let cancelled = false

    const fetchReferrals = async () => {
      setReferralsLoading(true)

      try {
        const { data, error } = await supabase
          .from('referrals')
          .select('*')
          .eq('ambassador_id', ambassadorProfile.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        if (!cancelled) {
          setReferrals(
            (data || []).map((item) => ({
              id: item.id,
              name: item.student_name,
              college: item.college,
              date: item.referral_date?.split('T')[0] || '',
              status: item.status,
            }))
          )
        }
      } catch (error) {
        console.error('Referrals loading error:', error.message)
      } finally {
        if (!cancelled) {
          setReferralsLoading(false)
        }
      }
    }

    fetchReferrals()

    return () => {
      cancelled = true
    }
  }, [ambassadorProfile])

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      alert(error.message)
    }
  }

  // ==========================================
  // GENERAL PAGE STATE
  // ==========================================

  const [activePage, setActivePage] = useState('Overview')
  const [copied, setCopied] = useState(false)

  // ==========================================
  // REFERRAL DATA & CALCULATIONS
  // ==========================================

  const referralLink = 'niyo.com/ambassador/srinidhi'

  const completedCount = referrals.filter(
    (r) => r.status === 'Completed'
  ).length

  const pendingCount = referrals.filter(
    (r) => r.status === 'Pending'
  ).length

  const totalEarned = completedCount * 100
  const pendingRewards = pendingCount * 100

  // ==========================================
  // ADD REFERRAL TO SUPABASE
  // ==========================================

  const addReferral = async (e) => {
    e.preventDefault()

    if (!studentName.trim() || !collegeName.trim()) {
      alert('Please enter the student name and college.')
      return
    }

    if (!ambassadorProfile) {
      alert('Your ambassador profile is still loading. Please try again.')
      return
    }

    setAddingReferral(true)

    try {
      const { data, error } = await supabase
        .from('referrals')
        .insert({
          ambassador_id: ambassadorProfile.id,
          student_name: studentName.trim(),
          college: collegeName.trim(),
          status: 'Pending',
        })
        .select()
        .single()

      if (error) throw error

      setReferrals((previous) => [
        {
          id: data.id,
          name: data.student_name,
          college: data.college,
          date: data.referral_date?.split('T')[0] || '',
          status: data.status,
        },
        ...previous,
      ])

      setStudentName('')
      setCollegeName('')

      alert('Referral added successfully!')
    } catch (error) {
      console.error('Add referral error:', error.message)
      alert('Unable to add referral: ' + error.message)
    } finally {
      setAddingReferral(false)
    }
  }

  // ==========================================
  // UPDATE REFERRAL STATUS IN SUPABASE
  // ==========================================

  const updateReferralStatus = async (id, newStatus) => {
    if (!ambassadorProfile) return

    const { data, error } = await supabase
      .from('referrals')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('ambassador_id', ambassadorProfile.id)
      .select()
      .single()

    if (error) {
      console.error('Referral update error:', error.message)
      alert('Unable to update referral: ' + error.message)
      return
    }

    setReferrals((previous) =>
      previous.map((referral) =>
        referral.id === id
          ? { ...referral, status: data.status }
          : referral
      )
    )
  }

  // ==========================================
  // COMMUNITY DATA
  // ==========================================

  const [ambassadors] = useState([
    {
      id: 1,
      name: 'Ananya Sharma',
      college: 'PES University',
      country: 'India',
      course: 'Computer Science',
      initials: 'AS',
    },
    {
      id: 2,
      name: 'Rahul Mehta',
      college: 'Christ University',
      country: 'India',
      course: 'Business Management',
      initials: 'RM',
    },
    {
      id: 3,
      name: 'Sarah Johnson',
      college: 'University of Toronto',
      country: 'Canada',
      course: 'Economics',
      initials: 'SJ',
    },
    {
      id: 4,
      name: 'Daniel Lee',
      college: 'National University of Singapore',
      country: 'Singapore',
      course: 'Information Technology',
      initials: 'DL',
    },
    {
      id: 5,
      name: 'Priya Nair',
      college: 'Jain University',
      country: 'India',
      course: 'Marketing',
      initials: 'PN',
    },
    {
      id: 6,
      name: 'Emma Wilson',
      college: 'University of Melbourne',
      country: 'Australia',
      course: 'Finance',
      initials: 'EW',
    },
  ])

  const [communitySearch, setCommunitySearch] = useState('')

  const filteredAmbassadors = ambassadors.filter((person) => {
    const search = communitySearch.toLowerCase().trim()

    return (
      person.name.toLowerCase().includes(search) ||
      person.college.toLowerCase().includes(search) ||
      person.country.toLowerCase().includes(search)
    )
  })

  // COMMUNITY RECOMMENDATION FORM

  const [nomineeName, setNomineeName] = useState('')
  const [nomineeCollege, setNomineeCollege] = useState('')
  const [nomineeCountry, setNomineeCountry] = useState('')
  const [nomineeEmail, setNomineeEmail] = useState('')
  const [nominations, setNominations] = useState([])

  const recommendAmbassador = (e) => {
    e.preventDefault()

    const newNomination = {
      id: Date.now(),
      name: nomineeName.trim(),
      college: nomineeCollege.trim(),
      country: nomineeCountry.trim(),
      email: nomineeEmail.trim(),
      status: 'Under Review',
    }

    setNominations((previous) => [...previous, newNomination])

    setNomineeName('')
    setNomineeCollege('')
    setNomineeCountry('')
    setNomineeEmail('')

    alert('Ambassador recommendation submitted successfully!')
  }

  // ==========================================
  // CAMPAIGNS DATA
  // ==========================================

  const [campaigns, setCampaigns] = useState([
    {
      id: 1,
      title: 'Campus Connect',
      category: 'Campus Engagement',
      description:
        'Introduce Niyo to students at your college and help them discover the benefits of the platform.',
      date: '2026-11-25',
      status: 'Active',
      participants: 124,
      joined: false,
    },
    {
      id: 2,
      title: 'Refer & Earn Challenge',
      category: 'Referral Campaign',
      description:
        'Share your referral link with friends and encourage them to explore Niyo. Track your referrals through the portal.',
      date: '2026-12-01',
      status: 'Active',
      participants: 86,
      joined: false,
    },
    {
      id: 3,
      title: 'Digital Awareness Week',
      category: 'Social Media',
      description:
        'Create awareness about digital banking and share educational content with your campus community.',
      date: '2026-12-10',
      status: 'Upcoming',
      participants: 52,
      joined: false,
    },
    {
      id: 4,
      title: 'Ambassador Meet 2026',
      category: 'Community',
      description:
        'Connect with fellow ambassadors, exchange ideas, and participate in community activities.',
      date: '2026-12-18',
      status: 'Upcoming',
      participants: 40,
      joined: false,
    },
  ])

  const toggleCampaignJoin = (campaignId) => {
    setCampaigns((previous) =>
      previous.map((campaign) =>
        campaign.id === campaignId
          ? {
              ...campaign,
              joined: !campaign.joined,
              participants: campaign.joined
                ? Math.max(0, campaign.participants - 1)
                : campaign.participants + 1,
            }
          : campaign
      )
    )
  }

  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === 'Active'
  )

  const upcomingCampaigns = campaigns.filter(
    (campaign) => campaign.status === 'Upcoming'
  )

  const joinedCampaigns = campaigns.filter(
    (campaign) => campaign.joined
  ).length

  // ==========================================
  // FEEDBACK HUB DATA
  // ==========================================

  const [feedbackCategory, setFeedbackCategory] = useState('General Feedback')
  const [feedbackSubject, setFeedbackSubject] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackRating, setFeedbackRating] = useState('5')

  const [feedbackList, setFeedbackList] = useState([
    {
      id: 1,
      subject: 'Campaign suggestions',
      category: 'Campaigns',
      message:
        'It would be helpful to have more campus-level activities.',
      rating: 4,
      date: '2026-11-18',
      status: 'Under Review',
    },
  ])

  const submitFeedback = (e) => {
    e.preventDefault()

    const newFeedback = {
      id: Date.now(),
      subject: feedbackSubject.trim(),
      category: feedbackCategory,
      message: feedbackMessage.trim(),
      rating: Number(feedbackRating),
      date: new Date().toISOString().slice(0, 10),
      status: 'Submitted',
    }

    setFeedbackList((previous) => [newFeedback, ...previous])

    setFeedbackSubject('')
    setFeedbackMessage('')
    setFeedbackCategory('General Feedback')
    setFeedbackRating('5')

    alert('Your feedback has been submitted successfully!')
  }

  // ==========================================
  // AI ASSISTANT DATA
  // ==========================================

  const [chatInput, setChatInput] = useState('')

  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: `Hi ${
        user?.user_metadata?.full_name ||
        ambassadorProfile?.full_name ||
        'there'
      }! 👋 I am your NIYO Ambassador Assistant. Ask me about referrals, rewards, campaigns, community, or using this portal.`,
    },
  ])

  const suggestedQuestions = [
    'How do referrals work?',
    'How can I track my rewards?',
    'How do I join a campaign?',
    'How can I recommend an ambassador?',
  ]

  const getBotResponse = (message) => {
    const question = message.toLowerCase()

    if (
      question.includes('referral') ||
      question.includes('refer')
    ) {
      return 'You can add a referral from the Earnings & Referrals section. Enter the student name and college, then select Add Referral. Your referral will appear in the referral records with a Pending status.'
    }

    if (
      question.includes('reward') ||
      question.includes('earning') ||
      question.includes('money')
    ) {
      return 'You can view your completed referrals, pending referrals, and illustrative rewards in the Earnings & Referrals section. The reward amounts displayed in this demo are sample figures and are not official Niyo payout details.'
    }

    if (
      question.includes('campaign') ||
      question.includes('event')
    ) {
      return 'Open the Campaigns section to view active and upcoming campaigns. Select Join Campaign to register your interest. Your joined campaigns will be reflected in the campaign statistics.'
    }

    if (
      question.includes('community') ||
      question.includes('ambassador') ||
      question.includes('recommend')
    ) {
      return 'Visit the Community section to search for ambassadors by name, college, or country. You can also use the Recommend an Ambassador form to submit a new recommendation.'
    }

    if (
      question.includes('feedback') ||
      question.includes('issue') ||
      question.includes('suggestion')
    ) {
      return 'Go to Feedback Hub. Choose a category, enter a subject and message, provide a rating, and submit your feedback. You can view your submitted feedback and its current demo status below the form.'
    }

    if (
      question.includes('profile') ||
      question.includes('account')
    ) {
      return 'Your profile is displayed in the sidebar. Your account is connected through Supabase authentication. Profile editing and account settings can be added in a future version.'
    }

    if (
      question.includes('hello') ||
      question.includes('hi') ||
      question.includes('hey')
    ) {
      return 'Hello! 😊 How can I help you with your ambassador activities today?'
    }

    return 'I can help with referrals, rewards, campaigns, community recommendations, and feedback. Try asking one of these topics or select a suggested question.'
  }

  const sendMessage = (message = chatInput) => {
    const trimmedMessage = message.trim()

    if (!trimmedMessage) return

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: trimmedMessage,
    }

    const botMessage = {
      id: Date.now() + 1,
      sender: 'bot',
      text: getBotResponse(trimmedMessage),
    }

    setChatMessages((previous) => [
      ...previous,
      userMessage,
      botMessage,
    ])

    setChatInput('')
  }

  const handleChatSubmit = (e) => {
    e.preventDefault()
    sendMessage()
  }

  // ==========================================
  // COMMON FUNCTIONS
  // ==========================================

  const menuItems = [
    { name: 'Overview', icon: '▦' },
    { name: 'Earnings & Referrals', icon: '₹' },
    { name: 'Community', icon: '♧' },
    { name: 'Campaigns', icon: '◈' },
    { name: 'Feedback Hub', icon: '✉' },
    { name: 'AI Assistant', icon: '✧' },
  ]

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${referralLink}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('Copy this referral link: https://' + referralLink)
    }
  }

  // ==========================================
  // AUTHENTICATION CHECK
  // ==========================================

  if (authLoading) {
    return (
      <div className="auth-container">
        Loading NIYO Ambassador Hub...
      </div>
    )
  }

  if (!user) {
    return <Auth onLogin={setUser} />
  }

  // ==========================================
  // MAIN UI
  // ==========================================

  const displayName =
    ambassadorProfile?.full_name ||
    user.user_metadata?.full_name ||
    user.email ||
    'Ambassador'

  const initials = displayName.charAt(0).toUpperCase()

  return (
    <div className="app-container">
      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">N</div>

          <div>
            <h2>NIYO</h2>
            <span>AMBASSADOR HUB</span>
          </div>
        </div>

        <div className="menu-label">WORKSPACE</div>

        <nav>
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`menu-item ${
                activePage === item.name ? 'active' : ''
              }`}
              onClick={() => setActivePage(item.name)}
            >
              <span className="menu-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-avatar">{initials}</div>

          <div>
            <strong>{displayName}</strong>
            <span>
              {profileLoading
                ? 'Loading profile...'
                : 'Student Ambassador'}
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">
        {/* TOP BAR */}

        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace /</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-right">
            <span className="notification">♧</span>

            <div className="profile-avatar small">
              {initials}
            </div>

            <button
              onClick={handleLogout}
              className="logout-button"
            >
              Logout
            </button>
          </div>
        </header>

        {/* ====================================== */}
        {/* PAGE 1: OVERVIEW */}
        {/* ====================================== */}

        {activePage === 'Overview' && (
          <div className="dashboard">
            <PageHeader
              eyebrow="AMBASSADOR WORKSPACE"
              title={`Welcome back, ${displayName.split(' ')[0]}! 👋`}
              description="Here's what's happening with your Niyo ambassador journey."
              badge="✦ Active Ambassador"
            />

            <div className="stats-grid">
              <StatCard
                icon="↗"
                color="blue"
                label="Total Referrals"
                value={referrals.length}
                note="Students referred"
              />

              <StatCard
                icon="✓"
                color="green"
                label="Successful Onboardings"
                value={completedCount}
                note="Completed referrals"
              />

              <StatCard
                icon="₹"
                color="purple"
                label="Total Earnings"
                value={`₹${totalEarned.toLocaleString('en-IN')}`}
                note="Illustrative rewards"
              />

              <StatCard
                icon="◷"
                color="orange"
                label="Pending Rewards"
                value={`₹${pendingRewards.toLocaleString('en-IN')}`}
                note={`${pendingCount} pending referrals`}
              />
            </div>

            <div className="content-grid">
              <section className="panel referral-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Your Referral Link</h3>
                    <p>Share your unique link with friends.</p>
                  </div>

                  <span className="link-symbol">↗</span>
                </div>

                <div className="referral-link">
                  <span>{referralLink}</span>

                  <button onClick={copyLink}>
                    {copied ? 'Copied ✓' : 'Copy Link'}
                  </button>
                </div>

                <div className="link-footer">
                  <span className="status-dot"></span>
                  Active referral link
                </div>
              </section>

              <section className="panel progress-panel">
                <h3>Ambassador Progress</h3>
                <p>Keep referring and grow your impact!</p>

                <div className="progress-numbers">
                  <strong>{completedCount}</strong>
                  <span>/ 100 onboardings</span>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(completedCount, 100)}%`,
                    }}
                  ></div>
                </div>

                <span className="progress-caption">
                  {Math.min(completedCount, 100)}% of illustrative target achieved
                </span>
              </section>
            </div>

            <section className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <h3>Recent Activity</h3>
                  <p>Track your latest referral activity.</p>
                </div>

                <button
                  className="view-button"
                  onClick={() =>
                    setActivePage('Earnings & Referrals')
                  }
                >
                  View all →
                </button>
              </div>

              {referrals.slice(0, 2).map((referral) => (
                <div className="activity-row" key={referral.id}>
                  <div
                    className={`activity-avatar ${
                      referral.status === 'Completed'
                        ? 'green-bg'
                        : 'orange-bg'
                    }`}
                  >
                    {referral.status === 'Completed' ? '✓' : '◷'}
                  </div>

                  <div className="activity-info">
                    <strong>{referral.name}</strong>
                    <span>{referral.college} · {referral.date}</span>
                  </div>

                  <strong>
                    {referral.status === 'Completed' ? '+₹100' : '₹0'}
                  </strong>

                  <span
                    className={
                      referral.status === 'Completed'
                        ? 'completed'
                        : referral.status === 'Rejected'
                          ? 'pending'
                          : 'pending'
                    }
                  >
                    {referral.status}
                  </span>
                </div>
              ))}

              {!referralsLoading && referrals.length === 0 && (
                <p>No referral activity yet.</p>
              )}
            </section>

            <div className="footer-note">
              Referral records are loaded from Supabase. Reward figures are illustrative.
            </div>
          </div>
        )}

        {/* ====================================== */}
        {/* PAGE 2: EARNINGS & REFERRALS */}
        {/* ====================================== */}

        {activePage === 'Earnings & Referrals' && (
          <div className="dashboard">
            <PageHeader
              eyebrow="REFERRAL MANAGEMENT"
              title="Earnings & Referrals"
              description="Manage your student referrals and track your rewards."
              badge="✦ Ambassador Rewards"
            />

            <div className="stats-grid">
              <StatCard
                icon="↗"
                color="blue"
                label="Total Referrals"
                value={referrals.length}
                note="Students referred"
              />

              <StatCard
                icon="✓"
                color="green"
                label="Successful Onboardings"
                value={completedCount}
                note="Completed referrals"
              />

              <StatCard
                icon="₹"
                color="purple"
                label="Total Earnings"
                value={`₹${totalEarned.toLocaleString('en-IN')}`}
                note="Illustrative rewards"
              />

              <StatCard
                icon="◷"
                color="orange"
                label="Pending Rewards"
                value={`₹${pendingRewards.toLocaleString('en-IN')}`}
                note={`${pendingCount} pending referrals`}
              />
            </div>

            <section className="panel referral-panel">
              <h3>Your Unique Referral Link</h3>
              <p>Share this link with students to track your referrals.</p>

              <div className="referral-link">
                <span>{referralLink}</span>

                <button onClick={copyLink}>
                  {copied ? 'Copied ✓' : 'Copy Link'}
                </button>
              </div>

              <div className="link-footer">
                <span className="status-dot"></span>
                Active referral link
              </div>
            </section>

            <section className="panel add-referral-panel">
              <h3>+ Add New Referral</h3>
              <p>Enter the details of a student you referred.</p>

              <form onSubmit={addReferral} className="referral-form">
                <div>
                  <label>Student Name</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Enter student name"
                    required
                  />
                </div>

                <div>
                  <label>College Name</label>
                  <input
                    type="text"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    placeholder="Enter college name"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingReferral || !ambassadorProfile}
                >
                  {addingReferral ? 'Saving...' : 'Add Referral'}
                </button>
              </form>
            </section>

            <section className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <h3>Referral Records</h3>
                  <p>Track and update your referral status.</p>
                </div>

                <span className="record-count">
                  {referrals.length} Records
                </span>
              </div>

              <div className="table-wrapper">
                <table className="referral-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>College</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Reward</th>
                    </tr>
                  </thead>

                  <tbody>
                    {referralsLoading ? (
                      <tr>
                        <td colSpan="5">Loading referrals...</td>
                      </tr>
                    ) : referrals.length === 0 ? (
                      <tr>
                        <td colSpan="5">No referrals added yet.</td>
                      </tr>
                    ) : (
                      referrals.map((referral) => (
                        <tr key={referral.id}>
                          <td><strong>{referral.name}</strong></td>
                          <td>{referral.college}</td>
                          <td>{referral.date}</td>

                          <td>
                            <select
                              className="status-select"
                              value={referral.status}
                              onChange={(e) =>
                                updateReferralStatus(
                                  referral.id,
                                  e.target.value
                                )
                              }
                            >
                              <option value="Pending">Pending</option>
                              <option value="Completed">Completed</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </td>

                          <td>
                            {referral.status === 'Completed' ? '₹100' : '₹0'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="footer-note">
                Reward rate of ₹100 is illustrative, not an official Niyo payout policy.
              </div>
            </section>
          </div>
        )}

        {/* ====================================== */}
        {/* PAGE 3: COMMUNITY */}
        {/* ====================================== */}

        {activePage === 'Community' && (
          <div className="dashboard">
            <PageHeader
              eyebrow="GLOBAL AMBASSADOR NETWORK"
              title="Ambassador Community 🌍"
              description="Connect with student ambassadors across colleges and countries."
              badge="✦ Global Network"
            />

            <div className="stats-grid">
              <StatCard
                icon="♧"
                color="blue"
                label="Total Ambassadors"
                value={ambassadors.length}
                note="Sample community profiles"
              />

              <StatCard
                icon="🌍"
                color="green"
                label="Countries Represented"
                value={new Set(ambassadors.map((a) => a.country)).size}
                note="Countries in this demo"
              />

              <StatCard
                icon="🎓"
                color="purple"
                label="Colleges Represented"
                value={new Set(ambassadors.map((a) => a.college)).size}
                note="Institutions in this demo"
              />

              <StatCard
                icon="✉"
                color="orange"
                label="My Recommendations"
                value={nominations.length}
                note="Nominations submitted"
              />
            </div>

            <section className="panel community-panel">
              <div className="panel-heading">
                <div>
                  <h3>Global Ambassador Directory</h3>
                  <p>Discover and connect with fellow ambassadors.</p>
                </div>

                <span className="record-count">
                  {filteredAmbassadors.length} Profiles
                </span>
              </div>

              <div className="community-search">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search by name, college or country..."
                  value={communitySearch}
                  onChange={(e) => setCommunitySearch(e.target.value)}
                />
              </div>

              <div className="ambassador-grid">
                {filteredAmbassadors.map((person) => (
                  <div className="ambassador-card" key={person.id}>
                    <div className="ambassador-avatar">
                      {person.initials}
                    </div>

                    <h3>{person.name}</h3>

                    <span className="ambassador-country">
                      🌍 {person.country}
                    </span>

                    <div className="ambassador-details">
                      <p>
                        <strong>College</strong>
                        {person.college}
                      </p>

                      <p>
                        <strong>Course</strong>
                        {person.course}
                      </p>
                    </div>

                    <div className="ambassador-tag">
                      Student Ambassador
                    </div>
                  </div>
                ))}

                {filteredAmbassadors.length === 0 && (
                  <div className="empty-community">
                    No ambassadors found. Try another search.
                  </div>
                )}
              </div>
            </section>

            <section className="panel recommend-panel">
              <div className="panel-heading">
                <div>
                  <h3>+ Recommend an Ambassador</h3>
                  <p>
                    Know someone from a college not represented in our
                    community? Recommend them here.
                  </p>
                </div>
              </div>

              <form
                className="recommend-form"
                onSubmit={recommendAmbassador}
              >
                <div>
                  <label>Student Name</label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={nomineeName}
                    onChange={(e) => setNomineeName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label>College / University</label>
                  <input
                    type="text"
                    placeholder="Enter college name"
                    value={nomineeCollege}
                    onChange={(e) => setNomineeCollege(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label>Country</label>
                  <input
                    type="text"
                    placeholder="Enter country"
                    value={nomineeCountry}
                    onChange={(e) => setNomineeCountry(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={nomineeEmail}
                    onChange={(e) => setNomineeEmail(e.target.value)}
                    required
                  />
                </div>

                <button type="submit">
                  Submit Recommendation →
                </button>
              </form>
            </section>

            <section className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <h3>My Recommendations</h3>
                  <p>Track the ambassadors you have nominated.</p>
                </div>

                <span className="record-count">
                  {nominations.length} Submitted
                </span>
              </div>

              {nominations.length === 0 ? (
                <div className="empty-community">
                  No recommendations submitted yet.
                  Your nominations will appear here.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="referral-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>College</th>
                        <th>Country</th>
                        <th>Email</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {nominations.map((nomination) => (
                        <tr key={nomination.id}>
                          <td><strong>{nomination.name}</strong></td>
                          <td>{nomination.college}</td>
                          <td>{nomination.country}</td>
                          <td>{nomination.email}</td>
                          <td>
                            <span className="pending">
                              {nomination.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="footer-note">
              Demo community · All ambassador profiles and recommendations are sample data.
            </div>
          </div>
        )}

        {/* ====================================== */}
        {/* PAGE 4: CAMPAIGNS */}
        {/* ====================================== */}

        {activePage === 'Campaigns' && (
          <div className="dashboard">
            <PageHeader
              eyebrow="AMBASSADOR ACTIVITIES"
              title="Campaigns & Activities 🚀"
              description="Explore campaigns, participate in activities, and grow your campus network."
              badge="✦ Campaign Centre"
            />

            <div className="stats-grid">
              <StatCard
                icon="◈"
                color="blue"
                label="Total Campaigns"
                value={campaigns.length}
                note="Available campaigns"
              />

              <StatCard
                icon="✓"
                color="green"
                label="Active Campaigns"
                value={activeCampaigns.length}
                note="Currently available"
              />

              <StatCard
                icon="◷"
                color="purple"
                label="Upcoming Campaigns"
                value={upcomingCampaigns.length}
                note="Starting soon"
              />

              <StatCard
                icon="★"
                color="orange"
                label="My Joined Campaigns"
                value={joinedCampaigns}
                note="Your participation"
              />
            </div>

            {/* ACTIVE CAMPAIGNS */}

            <section className="panel campaign-section">
              <div className="panel-heading">
                <div>
                  <h3>Active Campaigns</h3>
                  <p>Campaigns currently open for participation.</p>
                </div>

                <span className="record-count">
                  {activeCampaigns.length} Active
                </span>
              </div>

              <div className="campaign-grid">
                {activeCampaigns.map((campaign) => (
                  <div className="campaign-card" key={campaign.id}>
                    <div className="campaign-card-top">
                      <span className="campaign-category">
                        {campaign.category}
                      </span>

                      <span className="completed">
                        {campaign.status}
                      </span>
                    </div>

                    <h3>{campaign.title}</h3>
                    <p>{campaign.description}</p>

                    <div className="campaign-info">
                      <span>📅 Start date: {campaign.date}</span>
                      <span>👥 {campaign.participants} participants</span>
                    </div>

                    <button
                      className={campaign.joined ? 'joined-button' : ''}
                      onClick={() => toggleCampaignJoin(campaign.id)}
                    >
                      {campaign.joined
                        ? '✓ Joined Campaign'
                        : 'Join Campaign →'}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* UPCOMING CAMPAIGNS */}

            <section className="panel campaign-section">
              <div className="panel-heading">
                <div>
                  <h3>Upcoming Campaigns</h3>
                  <p>Get ready for the next ambassador activities.</p>
                </div>

                <span className="record-count">
                  {upcomingCampaigns.length} Upcoming
                </span>
              </div>

              <div className="campaign-grid">
                {upcomingCampaigns.map((campaign) => (
                  <div className="campaign-card" key={campaign.id}>
                    <div className="campaign-card-top">
                      <span className="campaign-category">
                        {campaign.category}
                      </span>

                      <span className="pending">Upcoming</span>
                    </div>

                    <h3>{campaign.title}</h3>
                    <p>{campaign.description}</p>

                    <div className="campaign-info">
                      <span>📅 Start date: {campaign.date}</span>
                      <span>👥 {campaign.participants} interested</span>
                    </div>

                    <button
                      className={campaign.joined ? 'joined-button' : ''}
                      onClick={() => toggleCampaignJoin(campaign.id)}
                    >
                      {campaign.joined
                        ? '✓ Registered'
                        : 'Register Interest →'}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="footer-note">
              Demo campaigns · Campaign names, dates, and participation figures are sample data.
            </div>
          </div>
        )}

        {/* ====================================== */}
        {/* PAGE 5: FEEDBACK HUB */}
        {/* ====================================== */}

        {activePage === 'Feedback Hub' && (
          <div className="dashboard">
            <PageHeader
              eyebrow="YOUR VOICE MATTERS"
              title="Feedback Hub 💬"
              description="Share your experience, report issues, and help improve the ambassador programme."
              badge="✦ Feedback Centre"
            />

            <div className="stats-grid">
              <StatCard
                icon="✉"
                color="blue"
                label="Total Feedback"
                value={feedbackList.length}
                note="Feedback submitted"
              />

              <StatCard
                icon="◷"
                color="orange"
                label="Under Review"
                value={
                  feedbackList.filter(
                    (f) => f.status === 'Under Review'
                  ).length
                }
                note="Being reviewed"
              />

              <StatCard
                icon="✓"
                color="green"
                label="Submitted"
                value={
                  feedbackList.filter(
                    (f) => f.status === 'Submitted'
                  ).length
                }
                note="Successfully submitted"
              />

              <StatCard
                icon="★"
                color="purple"
                label="Average Rating"
                value={
                  feedbackList.length
                    ? (
                        feedbackList.reduce(
                          (sum, f) => sum + f.rating,
                          0
                        ) / feedbackList.length
                      ).toFixed(1) + '/5'
                    : '—'
                }
                note="Your feedback ratings"
              />
            </div>

            {/* FEEDBACK FORM */}

            <section className="panel feedback-panel">
              <div className="panel-heading">
                <div>
                  <h3>Share Your Feedback</h3>
                  <p>
                    Tell us about your experience as a Niyo ambassador.
                  </p>
                </div>
              </div>

              <form
                className="feedback-form"
                onSubmit={submitFeedback}
              >
                <div>
                  <label>Feedback Category</label>

                  <select
                    value={feedbackCategory}
                    onChange={(e) =>
                      setFeedbackCategory(e.target.value)
                    }
                  >
                    <option>General Feedback</option>
                    <option>Campaigns</option>
                    <option>Referrals & Rewards</option>
                    <option>Community</option>
                    <option>Technical Issue</option>
                    <option>Suggestions</option>
                  </select>
                </div>

                <div>
                  <label>Subject</label>

                  <input
                    type="text"
                    placeholder="Enter feedback subject"
                    value={feedbackSubject}
                    onChange={(e) =>
                      setFeedbackSubject(e.target.value)
                    }
                    required
                  />
                </div>

                <div>
                  <label>Your Feedback</label>

                  <textarea
                    rows="5"
                    placeholder="Write your feedback or describe the issue..."
                    value={feedbackMessage}
                    onChange={(e) =>
                      setFeedbackMessage(e.target.value)
                    }
                    required
                  />
                </div>

                <div>
                  <label>Rate Your Experience</label>

                  <select
                    value={feedbackRating}
                    onChange={(e) =>
                      setFeedbackRating(e.target.value)
                    }
                  >
                    <option value="5">★★★★★ - Excellent</option>
                    <option value="4">★★★★ - Very Good</option>
                    <option value="3">★★★ - Good</option>
                    <option value="2">★★ - Fair</option>
                    <option value="1">★ - Poor</option>
                  </select>
                </div>

                <button type="submit">
                  Submit Feedback →
                </button>
              </form>
            </section>

            {/* FEEDBACK TRACKER */}

            <section className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <h3>My Submitted Feedback</h3>
                  <p>View your feedback submissions and their status.</p>
                </div>

                <span className="record-count">
                  {feedbackList.length} Records
                </span>
              </div>

              {feedbackList.length === 0 ? (
                <div className="empty-community">
                  You haven't submitted any feedback yet.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="referral-table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Category</th>
                        <th>Date</th>
                        <th>Rating</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {feedbackList.map((feedback) => (
                        <tr key={feedback.id}>
                          <td><strong>{feedback.subject}</strong></td>
                          <td>{feedback.category}</td>
                          <td>{feedback.date}</td>
                          <td>{'★'.repeat(feedback.rating)}</td>
                          <td>
                            <span
                              className={
                                feedback.status === 'Under Review'
                                  ? 'pending'
                                  : 'completed'
                              }
                            >
                              {feedback.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="footer-note">
                Demo feedback tracker · Submissions are stored only in the current browser session.
              </div>
            </section>
          </div>
        )}

        {/* ====================================== */}
        {/* PAGE 6: AI ASSISTANT */}
        {/* ====================================== */}

        {activePage === 'AI Assistant' && (
          <div className="dashboard">
            <PageHeader
              eyebrow="YOUR DIGITAL HELPER"
              title="NIYO AI Assistant ✨"
              description="Get quick guidance about referrals, rewards, campaigns, and your ambassador activities."
              badge="✦ Demo Assistant"
            />

            <section className="panel ai-panel">
              <div className="ai-heading">
                <div className="ai-avatar">✧</div>

                <div>
                  <h3>Ambassador Assistant</h3>
                  <span className="ai-online">
                    <span className="status-dot"></span>
                    Online · Demo mode
                  </span>
                </div>
              </div>

              {/* CHAT MESSAGES */}

              <div className="chat-messages">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-message ${
                      message.sender === 'user'
                        ? 'user-message'
                        : 'bot-message'
                    }`}
                  >
                    {message.sender === 'bot' && (
                      <div className="chat-avatar">✧</div>
                    )}

                    <div className="chat-bubble">
                      <span>
                        {message.sender === 'user'
                          ? 'You'
                          : 'Assistant'}
                      </span>

                      <p>{message.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* SUGGESTED QUESTIONS */}

              <div className="suggested-questions">
                <strong>Suggested questions</strong>

                <div className="suggestion-list">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => sendMessage(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>

              {/* CHAT INPUT */}

              <form
                className="chat-input-form"
                onSubmit={handleChatSubmit}
              >
                <input
                  type="text"
                  placeholder="Ask something about your ambassador journey..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />

                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                >
                  Send ↑
                </button>
              </form>

              <div className="footer-note">
                This is a frontend demo chatbot with predefined answers. It is not connected to a live AI service.
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
