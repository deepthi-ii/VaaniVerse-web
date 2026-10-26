
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import './App.css'

const CATEGORIES = [
  'All',
  'Community',
  'Education',
  'Technology',
  'Agriculture',
  'Careers',
  'Culture',
  'Environment',
]

function timeAgo(date) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000))

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return new Date(date).toLocaleDateString()
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const [posts, setPosts] = useState([])
  const [likedPosts, setLikedPosts] = useState([])
  const [draft, setDraft] = useState('')
  const [draftCategory, setDraftCategory] = useState('Community')
  const [posting, setPosting] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [notice, setNotice] = useState('')
  const [feedError, setFeedError] = useState('')

  const [activeNav, setActiveNav] = useState('Home Feed')
  const [filter, setFilter] = useState('Latest')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [activeTool, setActiveTool] = useState('')
  const [composerMode, setComposerMode] = useState('text')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordedAudio, setRecordedAudio] = useState(null)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState('')
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState(null)
  const [selectedMediaUrl, setSelectedMediaUrl] = useState('')
  const [mediaBusy, setMediaBusy] = useState(false)
  const mediaInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const recordingStartedAtRef = useRef(0)
  const recordingTimerRef = useRef(null)

  const [openComments, setOpenComments] = useState([])
  const [commentsByPost, setCommentsByPost] = useState({})
  const [commentDrafts, setCommentDrafts] = useState({})
  const [loadingComments, setLoadingComments] = useState([])
  const [sendingComment, setSendingComment] = useState([])

  useEffect(() => {
    let alive = true

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!alive) return

      if (error) setAuthMessage(error.message)
      setUser(data?.session?.user ?? null)
      setAuthReady(true)
    }

    checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setAuthReady(true)
      }
    )

    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true)
    setFeedError('')

    try {
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(
          'id, user_id, author_name, content, category, language, created_at, post_type, audio_path, audio_duration_seconds, media_path, media_type'
        )
        .order('created_at', { ascending: false })

      if (postError) throw postError

      const loadedPosts = await Promise.all((postData || []).map(async (post) => {
        let audio_url = ''
        let media_url = ''
        if (post.post_type === 'voice' && post.audio_path) {
          const { data, error } = await supabase.storage.from('voice-posts').createSignedUrl(post.audio_path, 60 * 60)
          if (error) console.warn('Voice playback URL could not be created:', error.message)
          else audio_url = data?.signedUrl || ''
        }
        if (post.media_path) {
          const { data, error } = await supabase.storage.from('post-media').createSignedUrl(post.media_path, 60 * 60)
          if (error) console.warn('Post media URL could not be created:', error.message)
          else media_url = data?.signedUrl || ''
        }
        return { ...post, audio_url, media_url }
      }))

      if (loadedPosts.length === 0) {
        setPosts([])
        setLikedPosts([])
        return
      }

      const { data: likeData, error: likeError } = await supabase
        .from('post_likes')
        .select('post_id, user_id')

      if (likeError) throw likeError

      const { data: commentData, error: commentError } = await supabase
        .from('post_comments')
        .select('post_id')

      if (commentError) throw commentError

      const likeCounts = {}
      const commentCounts = {}

      for (const like of likeData || []) {
        likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1
      }

      for (const comment of commentData || []) {
        commentCounts[comment.post_id] =
          (commentCounts[comment.post_id] || 0) + 1
      }

      setPosts(
        loadedPosts.map((post) => ({
          ...post,
          likes: likeCounts[post.id] || 0,
          comments: commentCounts[post.id] || 0,
        }))
      )

      setLikedPosts(
        user
          ? (likeData || [])
              .filter((like) => like.user_id === user.id)
              .map((like) => like.post_id)
          : []
      )
    } catch (error) {
      console.error('Feed loading error:', error)
      setFeedError(error.message || 'Could not load the feed.')
    } finally {
      setLoadingPosts(false)
    }
  }, [user])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  async function handleAuth(event) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthMessage('')

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: displayName.trim() || email.split('@')[0],
            },
          },
        })

        if (error) throw error

        if (data.session) {
          setUser(data.session.user)
          setAuthMessage('Account created successfully!')
        } else {
          setAuthMessage(
            'Signup submitted. Check your email to confirm your account, then log in.'
          )
          setAuthMode('login')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) throw error

        setUser(data.user)
        setAuthMessage('')
      }
    } catch (error) {
      setAuthMessage(error.message || 'Authentication failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setNotice('Could not sign out: ' + error.message)
    } else {
      setNotice('')
      setActiveNav('Home Feed')
    }
  }

  function releaseRecordingStream() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  async function startVoiceRecording() {
    setNotice('')
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setNotice('Voice recording is not supported by this browser. Try the latest Chrome and allow microphone access.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
        window.MediaRecorder.isTypeSupported?.(type)
      )
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const chunks = []
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data)
      }
      recorder.onerror = () => {
        setNotice('Recording stopped because the browser reported an audio error.')
        releaseRecordingStream()
        setIsRecording(false)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size > 0) {
          setRecordedAudio(blob)
          setRecordedAudioUrl((oldUrl) => {
            if (oldUrl) URL.revokeObjectURL(oldUrl)
            return URL.createObjectURL(blob)
          })
        } else {
          setNotice('No audio was captured. Please try recording again.')
        }
        releaseRecordingStream()
        setIsRecording(false)
      }
      mediaRecorderRef.current = recorder
      recordingStartedAtRef.current = Date.now()
      setRecordingSeconds(0)
      setRecordedAudio(null)
      setRecordedAudioUrl((oldUrl) => {
        if (oldUrl) URL.revokeObjectURL(oldUrl)
        return ''
      })
      recorder.start()
      setIsRecording(true)
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000))
      }, 500)
    } catch (error) {
      releaseRecordingStream()
      setIsRecording(false)
      setNotice(error.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow microphone access in Chrome, then try again.'
        : 'Could not start recording: ' + (error.message || 'Please check your microphone.'))
    }
  }

  function stopVoiceRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  function discardVoiceRecording() {
    if (isRecording) stopVoiceRecording()
    releaseRecordingStream()
    setRecordedAudio(null)
    setRecordedAudioUrl((oldUrl) => {
      if (oldUrl) URL.revokeObjectURL(oldUrl)
      return ''
    })
    setRecordingSeconds(0)
  }

  async function publishVoicePost() {
    if (!user) {
      setNotice('Please log in before publishing a voice post.')
      return
    }
    if (!recordedAudio) {
      setNotice('Record a voice note and preview it before publishing.')
      return
    }
    setVoiceBusy(true)
    setNotice('')
    const authorName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'VaaniVerse member'
    const extension = recordedAudio.type.includes('mp4') ? 'm4a' : 'webm'
    const audioPath = `${user.id}/${Date.now()}.${extension}`
    try {
      const { error: uploadError } = await supabase.storage
        .from('voice-posts')
        .upload(audioPath, recordedAudio, {
          contentType: recordedAudio.type || 'audio/webm',
          upsert: false,
        })
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        author_name: authorName,
        content: draft.trim(),
        category: draftCategory,
        language: 'English',
        post_type: 'voice',
        audio_path: audioPath,
        audio_duration_seconds: recordingSeconds,
      })
      if (insertError) {
        await supabase.storage.from('voice-posts').remove([audioPath])
        throw insertError
      }
      setDraft('')
      discardVoiceRecording()
      setComposerMode('text')
      setNotice('Your voice post was published successfully!')
      await loadPosts()
    } catch (error) {
      console.error('Voice post publishing error:', error)
      setNotice('Voice post could not be saved: ' + (error.message || 'Please try again.'))
    } finally {
      setVoiceBusy(false)
    }
  }

  useEffect(() => () => {
    releaseRecordingStream()
  }, [])

  function handleMediaSelection(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setNotice('Please choose an image or video file.')
      return
    }
    const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 15 * 1024 * 1024
    if (file.size > maxSize) {
      setNotice(file.type.startsWith('video/') ? 'Videos must be 100 MB or smaller.' : 'Photos must be 15 MB or smaller.')
      return
    }
    setSelectedMedia(file)
    setSelectedMediaUrl((oldUrl) => { if (oldUrl) URL.revokeObjectURL(oldUrl); return URL.createObjectURL(file) })
    setComposerMode('media')
    setNotice('')
  }

  function discardSelectedMedia() {
    setSelectedMedia(null)
    setSelectedMediaUrl((oldUrl) => { if (oldUrl) URL.revokeObjectURL(oldUrl); return '' })
  }

  async function publishPost() {
    if (!user) {
      setNotice('Please log in before publishing a post.')
      return
    }

    if (composerMode === 'voice') {
      await publishVoicePost()
      return
    }

    const content = draft.trim()
    if (!content && !selectedMedia) {
      setNotice('Write something or attach a photo/video before sharing.')
      return
    }

    setPosting(true)
    setMediaBusy(Boolean(selectedMedia))
    setNotice('')

    const authorName =
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      'VaaniVerse member'

    try {
      let mediaPath = null
      let mediaType = null
      if (selectedMedia) {
        const extension = (selectedMedia.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
        mediaPath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
        mediaType = selectedMedia.type.startsWith('video/') ? 'video' : 'image'
        const { error: uploadError } = await supabase.storage.from('post-media').upload(mediaPath, selectedMedia, {
          contentType: selectedMedia.type,
          upsert: false,
        })
        if (uploadError) throw uploadError
      }
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        author_name: authorName,
        content,
        category: draftCategory,
        language: 'English',
        post_type: selectedMedia ? mediaType : 'text',
        media_path: mediaPath,
        media_type: mediaType,
      })
      if (error) {
        if (mediaPath) await supabase.storage.from('post-media').remove([mediaPath])
        throw error
      }
      setDraft('')
      discardSelectedMedia()
      setComposerMode('text')
      setNotice('Your post was published successfully!')
      await loadPosts()
    } catch (error) {
      console.error('Post publishing error:', error)
      setNotice('Post could not be saved: ' + error.message)
    } finally {
      setPosting(false)
      setMediaBusy(false)
    }
  }

  async function toggleLike(postId) {
    if (!user) {
      setNotice('Please log in to like posts.')
      return
    }

    const alreadyLiked = likedPosts.includes(postId)

    // Update the button immediately for a responsive feel.
    setLikedPosts((current) =>
      alreadyLiked
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    )

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              likes: Math.max(0, post.likes + (alreadyLiked ? -1 : 1)),
            }
          : post
      )
    )

    try {
      if (alreadyLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('post_likes').insert({
          post_id: postId,
          user_id: user.id,
        })

        if (error) throw error
      }

      setNotice('')
    } catch (error) {
      console.error('Like error:', error)
      setNotice('Like could not be saved: ' + error.message)
      await loadPosts()
    }
  }

  async function loadComments(postId) {
    setLoadingComments((current) =>
      current.includes(postId) ? current : [...current, postId]
    )

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, post_id, user_id, author_name, content, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error

      setCommentsByPost((current) => ({
        ...current,
        [postId]: data || [],
      }))
    } catch (error) {
      console.error('Comment loading error:', error)
      setNotice('Could not load comments: ' + error.message)
    } finally {
      setLoadingComments((current) =>
        current.filter((id) => id !== postId)
      )
    }
  }

  async function toggleComments(postId) {
    if (openComments.includes(postId)) {
      setOpenComments((current) => current.filter((id) => id !== postId))
      return
    }

    setOpenComments((current) => [...current, postId])
    await loadComments(postId)
  }

  async function publishComment(postId) {
    if (!user) {
      setNotice('Please log in to comment.')
      return
    }

    const content = (commentDrafts[postId] || '').trim()

    if (!content) {
      setNotice('Write a comment first.')
      return
    }

    setSendingComment((current) => [...current, postId])
    setNotice('')

    const authorName =
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      'VaaniVerse member'

    try {
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        author_name: authorName,
        content,
      })

      if (error) throw error

      setCommentDrafts((current) => ({ ...current, [postId]: '' }))

      await loadComments(postId)
      await loadPosts()
    } catch (error) {
      console.error('Comment publishing error:', error)
      setNotice('Comment could not be saved: ' + error.message)
    } finally {
      setSendingComment((current) =>
        current.filter((id) => id !== postId)
      )
    }
  }

  const currentName =
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    'Community member'

  const filteredPosts = posts.filter((post) => {
    const matchesCategory =
      categoryFilter === 'All' || post.category === categoryFilter

    const searchText = search.trim().toLowerCase()
    const matchesSearch =
      !searchText ||
      (post.content || '').toLowerCase().includes(searchText) ||
      (post.author_name || '').toLowerCase().includes(searchText) ||
      (post.category || '').toLowerCase().includes(searchText)

    return matchesCategory && matchesSearch
  })

  const visiblePosts =
    filter === 'Trending'
      ? [...filteredPosts].sort((a, b) => b.likes - a.likes)
      : filteredPosts

  const navItems = [
    ['⌂', 'Home Feed'],
    ['⌕', 'Explore'],
    ['♧', 'Agri Hub'],
    ['▤', 'Careers & Learning'],
    ['◈', 'Trust Center'],
    ['♧', 'Alerts'],
    ['◎', 'My Profile'],
  ]

  if (!authReady) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand-icon">V</div>
          <h1>VaaniVerse</h1>
          <p>Connecting to your account...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <a className="auth-brand" href="#">
            <span className="brand-icon">V</span>
            <span>
              <strong>VaaniVerse</strong>
              <small>Every Voice. One Universe.</small>
            </span>
          </a>

          <div className="auth-art">
            <span>✳</span>
            <p>
              A billion voices.
              <br />
              One connected India.
            </p>
            <small>YOUR VOICE BELONGS HERE 🇮🇳</small>
          </div>

          <p className="eyebrow">WELCOME TO YOUR COMMUNITY</p>
          <h1>
            {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="auth-description">
            {authMode === 'signup'
              ? 'Join VaaniVerse and share your voice with Bharat.'
              : 'Sign in to share posts and connect with your community.'}
          </p>

          <form className="auth-form" onSubmit={handleAuth}>
            {authMode === 'signup' && (
              <label>
                Display name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="What should we call you?"
                  maxLength={60}
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  authMode === 'signup' ? 'new-password' : 'current-password'
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </label>

            {authMessage && <div className="auth-message">{authMessage}</div>}

            <button className="primary-button auth-submit" disabled={authBusy}>
              {authBusy
                ? 'Please wait...'
                : authMode === 'signup'
                  ? 'Create account →'
                  : 'Log in →'}
            </button>
          </form>

          <p className="auth-switch">
            {authMode === 'signup'
              ? 'Already have an account?'
              : 'New to VaaniVerse?'}{' '}
            <button
              onClick={() => {
                setAuthMode(authMode === 'signup' ? 'login' : 'signup')
                setAuthMessage('')
              }}
            >
              {authMode === 'signup' ? 'Log in' : 'Create an account'}
            </button>
          </p>

          <p className="auth-footnote">
            Your community starts with you. Please use an email you can access.
          </p>
        </section>
      </main>
    )
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault()
            setActiveNav('Home Feed')
          }}
        >
          <span className="brand-icon">V</span>
          <span>
            <strong>VaaniVerse</strong>
            <small>Every Voice. One Universe.</small>
          </span>
        </a>

        <div className="sidebar-label">YOUR SPACE</div>

        <nav className="navigation">
          {navItems.map(([icon, label]) => (
            <button
              key={label}
              className={`nav-item ${activeNav === label ? 'selected' : ''}`}
              onClick={() => setActiveNav(label)}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
              {label === 'Alerts' && <span className="notification-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-label community-label">YOUR COMMUNITIES</div>

        <button
          className="community-item"
          onClick={() => setSearch('student')}
        >
          <span className="community-dot purple" /> Student Corner
        </button>
        <button
          className="community-item"
          onClick={() => setSearch('India')}
        >
          <span className="community-dot orange" /> India Innovates
        </button>
        <button
          className="community-item"
          onClick={() => setSearch('environment')}
        >
          <span className="community-dot green" /> Green Bharat
        </button>

        <button
          className="create-community"
          onClick={() =>
            setNotice('Community creation will be added in a later step.')
          }
        >
          + Discover communities
        </button>

        <div className="sidebar-bottom">
          <div className="profile-mini">
            <div className="avatar avatar-blue">
              {currentName.slice(0, 1).toUpperCase()}
            </div>
            <div className="profile-text">
              <strong>{currentName}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button className="signout-button" onClick={signOut}>
            Sign out ↗
          </button>
          <div className="sidebar-footer">Built for Bharat, with Bharat. 🇮🇳</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-icon">V</span>
            <strong>VaaniVerse</strong>
          </div>

          <div className="search-box">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts, people, topics..."
            />
          </div>

          <div className="topbar-actions">
            <button
              className="language-button"
              onClick={() => setActiveTool('Language translation')}
            >
              文 English <span className="chevron">⌄</span>
            </button>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => setActiveNav('Alerts')}
            >
              ♧
            </button>
            <div className="avatar avatar-blue top-avatar">
              {currentName.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="content-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '22px', width: '100%', maxWidth: '1500px', boxSizing: 'border-box', alignItems: 'flex-start', overflowX: 'clip' }}>
          <section className="feed-column" style={{ minWidth: 0, width: 'auto', flex: '1 1 620px', boxSizing: 'border-box' }}>
            {activeNav === 'Home Feed' ? (
            <>
            <div className="welcome-row">
              <div>
                <p className="eyebrow">YOUR COMMUNITY AWAITS</p>
                <h1>
                  {activeNav === 'Home Feed'
                    ? `Hello, ${currentName} 👋`
                    : activeNav}
                </h1>
                <p className="welcome-subtitle">
                  Your voice matters. Here’s what’s happening across Bharat.
                </p>
              </div>
              <div className="welcome-symbol">✳</div>
            </div>

            <section className="hero-banner">
              <div className="hero-copy">
                <span className="hero-badge">✦ THE BHARAT COMMUNITY</span>
                <h2>
                  A billion voices.
                  <br />
                  One connected India.
                </h2>
                <p>
                  Discover ideas, share your story, and make every voice count.
                </p>
                <button
                  className="hero-button"
                  onClick={() =>
                    document.getElementById('post-composer')?.focus()
                  }
                >
                  Share your story <span>→</span>
                </button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <div className="art-globe">भारत</div>
                <span className="art-star star-one">✦</span>
                <span className="art-star star-two">✳</span>
                <span className="art-star star-three">✧</span>
                <span className="art-pill">एक भारत</span>
              </div>
            </section>

            <section className="composer card" style={{ minWidth: 0, width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
              <div className="avatar avatar-blue">
                {currentName.slice(0, 1).toUpperCase()}
              </div>
              <div className="composer-main" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', width: '100%', minWidth: 0, boxSizing: 'border-box', alignItems: 'stretch' }}>
                <textarea
                  id="post-composer"
                  style={{ flex: '1 1 100%', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={composerMode === 'voice' ? 'Add a caption to your voice note (optional)...' : "What's on your mind? Share it with Bharat..."}
                  maxLength={500}
                  rows={3}
                />
                {selectedMedia && selectedMediaUrl && (
                  <div className="media-preview-panel">
                    <div className="media-preview-heading"><strong>{selectedMedia.type.startsWith('video/') ? 'Video preview' : 'Photo preview'}</strong><button type="button" className="media-remove-button" onClick={discardSelectedMedia}>Remove</button></div>
                    {selectedMedia.type.startsWith('video/') ? <video className="media-preview" src={selectedMediaUrl} controls /> : <img className="media-preview" src={selectedMediaUrl} alt="Selected post preview" />}
                    <small>{selectedMedia.name} · {(selectedMedia.size / (1024 * 1024)).toFixed(1)} MB</small>
                  </div>
                )}
                {composerMode === 'voice' && (
                  <div className="voice-recorder-panel">
                    <div className="voice-recorder-copy">
                      <span className={`voice-record-indicator ${isRecording ? 'is-recording' : ''}`} />
                      <div>
                        <strong>{isRecording ? 'Recording your voice…' : recordedAudio ? 'Voice note ready to preview' : 'Record a voice note'}</strong>
                        <small>{isRecording ? 'Speak clearly. Press Stop when finished.' : 'Allow microphone access when Chrome asks.'}</small>
                      </div>
                      <span className="voice-duration">{Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="voice-recorder-actions">
                      {!isRecording ? (
                        <button type="button" className="primary-button" onClick={startVoiceRecording} disabled={voiceBusy}>● Start recording</button>
                      ) : (
                        <button type="button" className="voice-stop-button" onClick={stopVoiceRecording}>■ Stop recording</button>
                      )}
                      {recordedAudioUrl && !isRecording && <audio className="voice-preview-player" controls src={recordedAudioUrl} />}
                      {recordedAudio && !isRecording && <button type="button" className="secondary-button" onClick={discardVoiceRecording} disabled={voiceBusy}>Discard</button>}
                    </div>
                    <p className="voice-helper">Voice posts are uploaded privately to VaaniVerse storage. Keep this page open while publishing.</p>
                  </div>
                )}

                <div className="composer-bottom">
                  <div className="composer-tools">
                    <input ref={mediaInputRef} type="file" accept="image/*,video/*" hidden onChange={handleMediaSelection} />
                    <button type="button" onClick={() => mediaInputRef.current?.click()} className={selectedMedia ? 'composer-tool-active' : ''}>
                      ▧ <span>Photo / video</span>
                    </button>
                    <button className={composerMode === 'text' ? 'composer-tool-active' : ''} onClick={() => setComposerMode('text')}>
                      ✎ <span>Text post</span>
                    </button>
                    <button className={composerMode === 'voice' ? 'composer-tool-active' : ''} onClick={() => setComposerMode('voice')}>
                      🎙 <span>Voice note</span>
                    </button>
                    <button onClick={() => setActiveTool('Language translation')}>
                      文 <span>Language</span>
                    </button>
                  </div>

                  <div className="publish-group">
                    <select
                      aria-label="Post category"
                      value={draftCategory}
                      onChange={(event) => setDraftCategory(event.target.value)}
                    >
                      {CATEGORIES.filter((category) => category !== 'All').map(
                        (category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        )
                      )}
                    </select>
                    <span className="character-count">{draft.length}/500</span>
                    <button
                      className="primary-button"
                      onClick={publishPost}
                      disabled={posting || voiceBusy || mediaBusy || isRecording}
                    >
                      {composerMode === 'voice' ? (voiceBusy ? 'Publishing voice…' : 'Publish voice ↗') : (posting ? 'Publishing...' : 'Share post ↗')}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {notice && (
              <div className="notice" role="status">
                {notice}
                <button
                  onClick={() => setNotice('')}
                  aria-label="Dismiss message"
                >
                  ×
                </button>
              </div>
            )}

            {feedError && (
              <div className="notice" role="alert">
                {feedError}
                <button onClick={loadPosts}>Try again</button>
              </div>
            )}

            <div className="feed-heading">
              <div>
                <h2>Your community feed</h2>
                <p>{posts.length} posts from your Supabase database</p>
              </div>
              <div className="feed-tabs">
                <button
                  className={filter === 'Latest' ? 'active-tab' : ''}
                  onClick={() => setFilter('Latest')}
                >
                  Latest
                </button>
                <button
                  className={filter === 'Trending' ? 'active-tab' : ''}
                  onClick={() => setFilter('Trending')}
                >
                  Most liked
                </button>
                <button onClick={loadPosts}>↻ Refresh</button>
              </div>
            </div>

            <div className="feed-category-filter">
              <label htmlFor="category-filter">Category</label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {(search || categoryFilter !== 'All') && (
                <button
                  onClick={() => {
                    setSearch('')
                    setCategoryFilter('All')
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {loadingPosts ? (
              <div className="empty-state">Loading posts from Supabase...</div>
            ) : (
              <div className="posts-list">
                {visiblePosts.map((post) => {
                  const isLiked = likedPosts.includes(post.id)
                  const isCommentsOpen = openComments.includes(post.id)
                  const comments = commentsByPost[post.id] || []

                  return (
                    <article className="post-card card" key={post.id}>
                      <div className="post-header">
                        <div className="avatar avatar-blue">
                          {(post.author_name || 'V')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="post-author">
                          <strong>{post.author_name || 'VaaniVerse member'}</strong>
                          <small title={new Date(post.created_at).toLocaleString()}>
                            {timeAgo(post.created_at)}
                          </small>
                        </div>
                        <span className="post-category">{post.post_type === 'voice' ? '🎙 Voice note' : post.category}</span>
                      </div>

                      {post.content && <p className="post-text">{post.content}</p>}
                      {post.post_type === 'voice' && (
                        <div className="voice-post-player">
                          <div className="voice-player-icon">♫</div>
                          <div className="voice-player-main">
                            <strong>Voice note</strong>
                            <small>{post.audio_duration_seconds ? `${Math.floor(post.audio_duration_seconds / 60)}:${String(post.audio_duration_seconds % 60).padStart(2, '0')}` : 'Audio message'}</small>
                            {post.audio_url ? <audio controls preload="none" src={post.audio_url}>Your browser does not support audio playback.</audio> : <small>Audio is unavailable right now. Refresh the feed to try again.</small>}
                          </div>
                        </div>
                      )}
                      {post.media_url && post.media_type === 'image' && <img className="post-media-display" src={post.media_url} alt="Shared by community member" loading="lazy" />}
                      {post.media_url && post.media_type === 'video' && <video className="post-media-display" src={post.media_url} controls preload="metadata" />}
                      <p className="post-tags">#VaaniVerse</p>

                      <div className="post-insight">
                        <span>✦ Vaani Trust</span>
                        <span>Not independently verified</span>
                      </div>

                      <div className="post-actions">
                        <button
                          className={isLiked ? 'liked' : ''}
                          onClick={() => toggleLike(post.id)}
                          aria-pressed={isLiked}
                        >
                          {isLiked ? '♥' : '♡'}{' '}
                          <span>
                            {post.likes} {post.likes === 1 ? 'like' : 'likes'}
                          </span>
                        </button>

                        <button onClick={() => toggleComments(post.id)}>
                          ◯{' '}
                          <span>
                            {post.comments}{' '}
                            {post.comments === 1 ? 'comment' : 'comments'}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            const shareText = `${post.content}\n\n— ${post.author_name} on VaaniVerse`
                            if (navigator.share) {
                              navigator.share({ text: shareText }).catch(() => {})
                            } else if (navigator.clipboard) {
                              navigator.clipboard
                                .writeText(shareText)
                                .then(() => setNotice('Post text copied to clipboard.'))
                                .catch(() => setNotice('Could not copy post text.'))
                            } else {
                              setNotice('Sharing is not available in this browser.')
                            }
                          }}
                        >
                          ↗ <span>Share</span>
                        </button>
                      </div>

                      {isCommentsOpen && (
                        <section className="comments-section">
                          <h3>Comments</h3>

                          {loadingComments.includes(post.id) ? (
                            <p>Loading comments...</p>
                          ) : comments.length === 0 ? (
                            <p className="comments-empty">
                              No comments yet. Start the conversation!
                            </p>
                          ) : (
                            <div className="comments-list">
                              {comments.map((comment) => (
                                <article
                                  className="comment-item"
                                  key={comment.id}
                                >
                                  <div className="avatar avatar-blue comment-avatar">
                                    {(comment.author_name || 'V')
                                      .slice(0, 1)
                                      .toUpperCase()}
                                  </div>
                                  <div className="comment-body">
                                    <div className="comment-meta">
                                      <strong>{comment.author_name}</strong>
                                      <small>{timeAgo(comment.created_at)}</small>
                                    </div>
                                    <p>{comment.content}</p>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}

                          <form
                            className="comment-form"
                            onSubmit={(event) => {
                              event.preventDefault()
                              publishComment(post.id)
                            }}
                          >
                            <input
                              value={commentDrafts[post.id] || ''}
                              onChange={(event) =>
                                setCommentDrafts((current) => ({
                                  ...current,
                                  [post.id]: event.target.value,
                                }))
                              }
                              placeholder="Write a thoughtful comment..."
                              maxLength={500}
                              aria-label="Write a comment"
                            />
                            <button
                              className="primary-button"
                              type="submit"
                              disabled={sendingComment.includes(post.id)}
                            >
                              {sendingComment.includes(post.id)
                                ? 'Sending...'
                                : 'Comment'}
                            </button>
                          </form>
                        </section>
                      )}
                    </article>
                  )
                })}

                {visiblePosts.length === 0 && (
                  <div className="empty-state">
                    {posts.length === 0
                      ? 'No posts yet. Write something above and share your first post!'
                      : 'No posts match your search or category. Try clearing the filters.'}
                  </div>
                )}
              </div>
            )}
            </>
            ) : (
              <section className="section-page">
                <div className="welcome-row">
                  <div>
                    <p className="eyebrow">VAANIVERSE · YOUR SPACE</p>
                    <h1>{activeNav}</h1>
                    <p className="welcome-subtitle">
                      {activeNav === 'Explore' && 'Discover conversations, ideas and people across Bharat.'}
                      {activeNav === 'Agri Hub' && 'A space for farmers, agricultural students and everyone growing a better future.'}
                      {activeNav === 'Careers & Learning' && 'Explore learning, skills and career conversations.'}
                      {activeNav === 'Trust Center' && 'Practical guidance for safer, more responsible online conversations.'}
                      {activeNav === 'Alerts' && 'Updates and activity from your VaaniVerse community.'}
                      {activeNav === 'My Profile' && 'Your VaaniVerse identity and the posts you have shared.'}
                    </p>
                  </div>
                  <div className="welcome-symbol">✳</div>
                </div>

                {activeNav === 'Explore' && <>
                  <section className="card section-feature">
                    <p className="eyebrow">FIND YOUR COMMUNITY</p><h2>Explore what Bharat is talking about</h2>
                    <p>Search posts by topic, author or category using the search bar above.</p>
                    <div className="section-actions">
                      <button className="primary-button" onClick={() => { setSearch(''); setCategoryFilter('All'); setActiveNav('Home Feed') }}>Browse all posts</button>
                      <button className="secondary-button" onClick={() => { setSearch(''); setCategoryFilter('Technology'); setActiveNav('Home Feed') }}>Technology</button>
                      <button className="secondary-button" onClick={() => { setSearch(''); setCategoryFilter('Culture'); setActiveNav('Home Feed') }}>Culture</button>
                    </div>
                  </section>
                  <div className="section-card-grid">{['Technology','Education','Culture','Environment'].map(category => <button className="card section-topic" key={category} onClick={() => { setCategoryFilter(category); setSearch(''); setActiveNav('Home Feed') }}><span className="section-topic-icon">✦</span><strong>{category}</strong><span>View {category.toLowerCase()} posts →</span></button>)}</div>
                </>}

                {activeNav === 'Agri Hub' && <>
                  <section className="card section-feature">
                    <p className="eyebrow">AGRICULTURE · COMMUNITY</p><h2>Knowledge grows when it is shared.</h2>
                    <p>Find agriculture-related discussions shared by the community. Posts are community contributions; independently verify information before making farming or financial decisions.</p>
                    <div className="section-actions">
                      <button className="primary-button" onClick={() => { setDraftCategory('Agriculture'); setActiveNav('Home Feed') }}>Share an agriculture post</button>
                      <button className="secondary-button" onClick={() => { setCategoryFilter('Agriculture'); setSearch(''); setActiveNav('Home Feed') }}>Browse agriculture posts</button>
                    </div>
                  </section>
                  <div className="section-card-grid">
                    <article className="card section-topic"><span className="section-topic-icon">🌱</span><strong>Crop & cultivation discussions</strong><span>Community posts tagged Agriculture.</span></article>
                    <article className="card section-topic"><span className="section-topic-icon">💧</span><strong>Water & soil</strong><span>Share practical experiences and local knowledge.</span></article>
                    <article className="card section-topic"><span className="section-topic-icon">🤝</span><strong>Farmer community</strong><span>Learn from conversations across regions.</span></article>
                  </div>
                </>}

                {activeNav === 'Careers & Learning' && <>
                  <section className="card section-feature">
                    <p className="eyebrow">LEARN · BUILD · GROW</p><h2>Your next opportunity starts with a conversation.</h2>
                    <p>Browse education and career posts shared by members. Verified course, scholarship and internship listings are not connected yet.</p>
                    <div className="section-actions">
                      <button className="primary-button" onClick={() => { setCategoryFilter('Education'); setSearch(''); setActiveNav('Home Feed') }}>Explore education posts</button>
                      <button className="secondary-button" onClick={() => { setCategoryFilter('Careers'); setSearch(''); setActiveNav('Home Feed') }}>Explore careers posts</button>
                      <button className="secondary-button" onClick={() => { setDraftCategory('Careers'); setActiveNav('Home Feed') }}>Share an opportunity</button>
                    </div>
                  </section>
                  <div className="section-card-grid">
                    <article className="card section-topic"><span className="section-topic-icon">📚</span><strong>Learning</strong><span>Study tips, skills and course discussions.</span></article>
                    <article className="card section-topic"><span className="section-topic-icon">🚀</span><strong>Careers</strong><span>Internship, job and career-path conversations.</span></article>
                    <article className="card section-topic"><span className="section-topic-icon">🎓</span><strong>Student Corner</strong><span>Connect through education-related posts.</span></article>
                  </div>
                </>}

                {activeNav === 'Trust Center' && <>
                  <section className="card section-feature"><p className="eyebrow">SAFETY & RESPONSIBILITY</p><h2>Pause. Check. Then share.</h2><p>VaaniVerse does not currently run automated fact-checking or deepfake detection. Treat posts as user-generated content and verify important claims with reliable primary sources.</p></section>
                  <div className="section-card-grid">
                    <article className="card section-topic"><span className="section-topic-icon">✓</span><strong>Check the source</strong><span>Look for the original publisher, author and publication date.</span></article>
                    <article className="card section-topic"><span className="section-topic-icon">⌕</span><strong>Cross-check claims</strong><span>Compare important information with multiple reliable sources.</span></article>
                    <article className="card section-topic"><span className="section-topic-icon">🛡</span><strong>Protect your privacy</strong><span>Never post passwords or sensitive personal information.</span></article>
                  </div>
                </>}

                {activeNav === 'Alerts' && <section className="card section-feature"><p className="eyebrow">YOUR NOTIFICATIONS</p><h2>You're all caught up</h2><p>There are no in-app notifications to show yet. Alerts for likes, comments and mentions need a notifications feature to be connected.</p><button className="primary-button" onClick={() => setActiveNav('Home Feed')}>Return to Home Feed</button></section>}

                {activeNav === 'My Profile' && <div className="profile-page">
                  <section className="profile-cover">
                    <div className="profile-cover-decoration">✦</div>
                    <span className="profile-cover-label">YOUR SPACE · YOUR STORY</span>
                    <h2>Your VaaniVerse</h2>
                    <p>A little space for every voice, thought and story.</p>
                  </section>

                  <section className="card profile-main-card">
                    <div className="profile-avatar-large">{currentName.slice(0, 1).toUpperCase()}</div>
                    <div className="profile-details">
                      <span className="profile-kicker"><span className="profile-status-dot" /> YOUR PROFILE</span>
                      <h2>{currentName}</h2>
                      <p className="profile-email">{user.email}</p>
                      <div className="profile-stats">
                        <div className="profile-stat"><strong>{posts.filter(post => post.user_id === user.id).length}</strong><span>Posts shared</span></div>
                        <div className="profile-stat"><strong>{posts.filter(post => post.user_id === user.id).reduce((sum, post) => sum + (post.likes || 0), 0)}</strong><span>Total likes</span></div>
                      </div>
                    </div>
                    <div className="profile-badge">💜 VaaniVerse member</div>
                  </section>

                  <div className="profile-post-heading">
                    <div><h2>Your stories</h2><p>Your posts, all together in one place.</p></div>
                    <button className="primary-button" onClick={() => setActiveNav('Home Feed')}>+ Create post</button>
                  </div>

                  <div className="posts-list profile-post-list">
                    {posts.filter(post => post.user_id === user.id).map(post => <article className="post-card card" key={post.id}>
                      <div className="post-header">
                        <div className="avatar avatar-blue">{currentName.slice(0, 1).toUpperCase()}</div>
                        <div className="post-author"><strong>{post.author_name}</strong><small>{timeAgo(post.created_at)}</small></div>
                        <span className="post-category">{post.post_type === 'voice' ? '🎙 Voice note' : post.media_type === 'video' ? '🎬 Video' : post.media_type === 'image' ? '📷 Photo' : post.category}</span>
                      </div>
                      {post.content && <p className="post-text">{post.content}</p>}
                      {post.post_type === 'voice' && post.audio_url && <audio controls src={post.audio_url} />}
                      {post.media_url && (post.media_type === 'video' ? <video className="post-media-display" controls playsInline src={post.media_url} /> : <img className="post-media-display" src={post.media_url} alt="Your published post" />)}
                      <div className="post-actions"><span>♥ {post.likes || 0} likes · {post.comments || 0} comments</span></div>
                    </article>)}
                    {posts.filter(post => post.user_id === user.id).length === 0 && <div className="profile-empty-state">
                      <div className="profile-empty-icon">♡</div><h3>Your story starts here</h3>
                      <p>You haven't shared anything yet. Your first post is waiting to happen.</p>
                      <button className="primary-button" onClick={() => setActiveNav('Home Feed')}>Share your first story</button>
                    </div>}
                  </div>
                </div>}
              </section>
            )}
          </section>

          <aside className="right-column" style={{ minWidth: 0, width: '100%', flex: '0 1 270px', maxWidth: '100%', boxSizing: 'border-box', position: 'relative', alignSelf: 'start' }}>
            <section className="ai-panel card">
              <div className="panel-heading">
                <div className="ai-icon">✧</div>
                <div>
                  <h2>Vaani AI</h2>
                  <p>Your intelligent companion</p>
                </div>
                <span className="online-dot" />
              </div>

              <div className="ai-intro">
                <div className="ai-sparkle">✳</div>
                <h3>How can I help you today?</h3>
                <p>
                  Explore trusted information, break language barriers, and stay
                  informed.
                </p>
              </div>

              <div className="ai-tools">
                <button onClick={() => setActiveTool('Fact check')}>
                  <span className="tool-icon fact">✓</span>
                  <span>
                    <strong>Fact check</strong>
                    <small>Check a claim or news story</small>
                  </span>
                  <span className="tool-arrow">→</span>
                </button>
                <button onClick={() => setActiveTool('Language translation')}>
                  <span className="tool-icon translate">文</span>
                  <span>
                    <strong>Translate languages</strong>
                    <small>Connect in your language</small>
                  </span>
                  <span className="tool-arrow">→</span>
                </button>
                <button onClick={() => setActiveTool('Media safety')}>
                  <span className="tool-icon deepfake">◈</span>
                  <span>
                    <strong>Media safety</strong>
                    <small>Learn to spot manipulated media</small>
                  </span>
                  <span className="tool-arrow">→</span>
                </button>
                <button onClick={() => setActiveTool('Find opportunities')}>
                  <span className="tool-icon opportunity">↗</span>
                  <span>
                    <strong>Find opportunities</strong>
                    <small>Discover learning and career paths</small>
                  </span>
                  <span className="tool-arrow">→</span>
                </button>
              </div>
              <div className="ai-disclaimer">
                AI tools are previews and are not connected yet.
              </div>
            </section>

            <section className="trending-panel card">
              <div className="section-title-row">
                <h2>Trending in Bharat</h2>
                <button onClick={() => setFilter('Trending')}>See all</button>
              </div>
              <div className="trend-item">
                <span className="trend-number">01</span>
                <div>
                  <strong>#DigitalIndia</strong>
                  <small>Community topic</small>
                </div>
                <span className="trend-up">↗</span>
              </div>
              <div className="trend-item">
                <span className="trend-number">02</span>
                <div>
                  <strong>#StudentOpportunities</strong>
                  <small>Learning and careers</small>
                </div>
                <span className="trend-up">↗</span>
              </div>
              <div className="trend-item">
                <span className="trend-number">03</span>
                <div>
                  <strong>#LocalToGlobal</strong>
                  <small>Stories from India</small>
                </div>
                <span className="trend-up">↗</span>
              </div>
            </section>

            <section className="trust-banner">
              <div className="trust-shield">◈</div>
              <div>
                <strong>Your voice, your safety.</strong>
                <p>Learn to share responsibly and check information.</p>
                <button onClick={() => setActiveNav('Trust Center')}>
                  Visit Trust Center →
                </button>
              </div>
            </section>

            <footer className="right-footer">
              About · Guidelines · Privacy · Help
              <p>© 2026 VaaniVerse · Made for Bharat 🇮🇳</p>
            </footer>
          </aside>
        </div>
      </main>

      {activeTool && (
        <div className="modal-backdrop" onClick={() => setActiveTool('')}>
          <section
            className="tool-modal card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setActiveTool('')}
            >
              ×
            </button>
            <div className="ai-icon modal-ai-icon">✧</div>
            <p className="eyebrow">VAANIVERSE TOOLS</p>
            <h2>{activeTool}</h2>
            <p>
              This feature is part of the VaaniVerse interface. Its live service
              will be connected in a later development step.
            </p>
            {activeTool === 'Language translation' && (
              <select defaultValue="Telugu">
                <option>Telugu</option>
                <option>Hindi</option>
                <option>Tamil</option>
                <option>Kannada</option>
                <option>Malayalam</option>
                <option>Bengali</option>
                <option>Marathi</option>
                <option>English</option>
              </select>
            )}
            <textarea rows={4} placeholder="Enter text or a question..." />
            <p className="modal-note">
              Preview only — no AI request is sent yet.
            </p>
            <button
              className="primary-button modal-action"
              onClick={() => setActiveTool('')}
            >
              Close
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
