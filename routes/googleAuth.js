import React, { useEffect, useState, useRef } from 'react';
import { modernTheme } from '../theme-modern';

const T = modernTheme;
const ALLOWED_EMAIL = 'isowekesa@gmail.com';
const GOOGLE_LOAD_TIMEOUT_MS = 10000;
const GOOGLE_POLL_INTERVAL_MS = 200;

export function GoogleAuthComponent({ onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userIP, setUserIP] = useState(null);
  const [googleFailed, setGoogleFailed] = useState(false);
  const googleButtonRef = useRef(null);

  useEffect(() => {
    // Fetch user IP address
    fetch('https://api.ipify.org?format=json')
      .then((res) => res.json())
      .then((data) => setUserIP(data.ip))
      .catch(() => setUserIP('unknown'));

    if (!process.env.REACT_APP_GOOGLE_CLIENT_ID) {
      console.error('REACT_APP_GOOGLE_CLIENT_ID is missing — check .env / Vercel env vars.');
      setError('Google Sign-In is not configured. Missing client ID.');
      setGoogleFailed(true);
      return;
    }

    let cancelled = false;
    let elapsed = 0;

    // index.html loads the GSI script with async/defer, so window.google
    // may not exist yet on first render. Poll until it's actually ready
    // instead of checking once and giving up.
    const tryInitGoogle = () => {
      if (cancelled) return;

      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
            callback: handleGoogleAuth,
          });

          if (googleButtonRef.current) {
            window.google.accounts.id.renderButton(googleButtonRef.current, {
              theme: 'dark',
              size: 'large',
              width: '100%',
              text: 'signin_with',
            });
          }
        } catch (err) {
          console.error('Google initialization error:', err);
          setError('Failed to load Google Sign-In. Please refresh.');
          setGoogleFailed(true);
        }
        return;
      }

      elapsed += GOOGLE_POLL_INTERVAL_MS;
      if (elapsed >= GOOGLE_LOAD_TIMEOUT_MS) {
        console.error('Google Identity Services script never became available.');
        setGoogleFailed(true);
        return;
      }
      setTimeout(tryInitGoogle, GOOGLE_POLL_INTERVAL_MS);
    };

    tryInitGoogle();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoogleAuth = async (response) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!response.credential) {
        setError('Google authentication failed. Please try again.');
        setIsLoading(false);
        return;
      }

      // Decode JWT token
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const userData = JSON.parse(jsonPayload);

      // Verify email
      if (userData.email !== ALLOWED_EMAIL) {
        setError(`Access denied. Only ${ALLOWED_EMAIL} is authorized.`);
        setIsLoading(false);
        return;
      }

      // Store auth data
      const authData = {
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        token: response.credential,
        ipAddress: userIP,
        firstLoginIP: userIP,
        loginTimestamp: new Date().toISOString(),
        isNewIP: true,
      };

      // Check if IP is new (would need backend verification)
      const previousLogins = JSON.parse(localStorage.getItem('loginHistory') || '[]');
      const isNewIP = !previousLogins.some((login) => login.ipAddress === userIP);

      authData.isNewIP = isNewIP;

      // Store securely
      localStorage.setItem('authToken', response.credential);
      localStorage.setItem('userData', JSON.stringify(authData));
      localStorage.setItem('lastIP', userIP);
      previousLogins.push({
        timestamp: authData.loginTimestamp,
        ipAddress: userIP,
      });
      localStorage.setItem('loginHistory', JSON.stringify(previousLogins.slice(-10)));

      onSuccess(authData);
    } catch (err) {
      setError('Authentication failed. Please try again.');
      console.error('Auth error:', err);
    }

    setIsLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', width: '100%' }}>
      {/* Official Google Sign-In Button */}
      <div
        ref={googleButtonRef}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}
      />

      {/* Custom Fallback Button (shown only once Google is confirmed unavailable) */}
      {googleFailed && (
        <button
          onClick={() => window.location.href = 'https://accounts.google.com/'}
          style={{
            width: '100%',
            padding: '0.875rem 1.5rem',
            background: T.colors.gradients.primaryGradient,
            color: 'white',
            border: 'none',
            borderRadius: T.borderRadius.lg,
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            transition: 'all 0.3s ease',
            boxShadow: T.shadows.lg,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = T.shadows.xl;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = T.shadows.lg;
          }}
        >
          <span>🔑</span>
          <span>Sign In with Google</span>
        </button>
      )}

      {error && (
        <div
          style={{
            padding: '1rem',
            background: T.colors.error[900],
            border: `1px solid ${T.colors.error[500]}`,
            borderRadius: T.borderRadius.lg,
            color: T.colors.error[200],
            fontSize: '0.875rem',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {isLoading && (
        <div
          style={{
            color: T.colors.text.secondary,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
          Verifying your credentials...
        </div>
      )}

      {userIP && (
        <p style={{ fontSize: '0.75rem', color: T.colors.text.disabled, marginTop: '1rem' }}>
          Your IP: {userIP}
        </p>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export function IPVerificationModal({ isOpen, currentIP, onVerify, onSkip }) {
  const [code, setCode] = useState('');

  // In development, auto-skip IP verification after 2 seconds
  React.useEffect(() => {
    if (isOpen && process.env.REACT_APP_ENV === 'development') {
      const timer = setTimeout(() => {
        onSkip();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onSkip]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: T.colors.dark.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          background: T.colors.dark.surface,
          borderRadius: T.borderRadius['2xl'],
          border: `1px solid ${T.colors.dark.border}`,
          padding: '2rem',
          maxWidth: '500px',
          width: '90%',
          boxShadow: T.shadows.xl,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ marginBottom: '1rem', color: T.colors.text.primary }}>
          Verifying Your Login
        </h2>
        <p style={{ color: T.colors.text.secondary, marginBottom: '0.5rem' }}>
          New location detected: <strong>{currentIP}</strong>
        </p>
        <p style={{ color: T.colors.text.hint, marginBottom: '2rem', fontSize: '0.875rem' }}>
          Auto-verifying in development mode...
        </p>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => onSkip()}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: T.colors.gradients.primaryGradient,
              border: 'none',
              borderRadius: T.borderRadius.lg,
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = T.shadows.lg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Continue Now
          </button>
        </div>

        <p style={{ color: T.colors.text.disabled, fontSize: '0.7rem', marginTop: '1.5rem' }}>
          🔒 In production, verification codes will be sent to your email.
        </p>
      </div>
    </div>
  );
}