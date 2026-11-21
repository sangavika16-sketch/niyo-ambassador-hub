
import { useState } from 'react'
import { supabase } from './supabaseClient'
import './Auth.css'

function Auth({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name }
          }
        })

        if (error) throw error

        if (data.session) {
          onLogin(data.session.user)
        } else {
          setMessage('Account created! Please check your email to confirm your account.')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error
        onLogin(data.user)
      }
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>NIYO Ambassador Hub</h1>
        <p>{isSignup ? 'Create your ambassador account' : 'Welcome back!'}</p>

        {isSignup && (
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password (minimum 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Login'}
        </button>

        {message && <p className="auth-message">{message}</p>}

        <p>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          <button
            type="button"
            className="auth-toggle"
            onClick={() => {
              setIsSignup(!isSignup)
              setMessage('')
            }}
          >
            {isSignup ? 'Login' : 'Sign Up'}
          </button>
        </p>
      </form>
    </div>
  )
}

export default Auth
