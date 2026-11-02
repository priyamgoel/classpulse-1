'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Container,
  FormControlLabel,
  Checkbox,
  Link as MuiLink,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import { useAuth } from '@/context/AuthContext';
import { getAuthToken, getStoredUser, isTokenExpired } from '@/lib/authStorage';
import { m3Tokens } from '@/theme/tokens';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Surface redirect reasons from apiFetch/session guards.
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'session_expired') {
      setNotice('Your session expired. Please sign in again.');
    } else if (reason === 'instructor_only') {
      setNotice(
        'The web dashboard is for instructors only. Student accounts should use the ClassPulse Android app.'
      );
    }

    // A valid teacher session should skip the form entirely.
    const storedToken = getAuthToken();
    const storedUser = getStoredUser<{ role?: string }>();
    if (storedToken && !isTokenExpired(storedToken) && storedUser?.role === 'teacher') {
      router.replace('/');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password, rememberMe);
    setLoading(false);

    if (result.success) {
      // Check if user is a student attempting to access Web Dashboard
      const storedUser = getStoredUser<{ role: string }>();
      if (storedUser) {
        if (storedUser.role === 'student') {
          logout();
          setError(
            'Student accounts access ClassPulse via the Android mobile app. Please open the ClassPulse Android App on your phone to log in.'
          );
          return;
        }
      }
      router.push('/');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: m3Tokens.color.background,
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Card sx={{ p: 2, borderRadius: m3Tokens.shape.large }}>
          <CardContent>
            <Typography variant="h4" sx={{ color: m3Tokens.color.primary, fontWeight: 800, textAlign: 'center', mb: 0.5 }}>
              ClassPulse
            </Typography>
            <Typography variant="subtitle2" sx={{ color: m3Tokens.color.secondary, fontWeight: 700, textAlign: 'center', mb: 3, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Instructor Dashboard
            </Typography>

            {notice && (
              <Alert severity="info" sx={{ mb: 2.5 }}>
                {notice}
              </Alert>
            )}

            {error && (
              <Alert
                severity={error.includes('Android mobile app') ? 'info' : 'error'}
                icon={error.includes('Android mobile app') ? <PhoneAndroidIcon fontSize="inherit" /> : undefined}
                sx={{ mb: 2.5 }}
              >
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Instructor Email"
                  type="email"
                  fullWidth
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, fontWeight: 500 }}>
                      Keep me signed in
                    </Typography>
                  }
                  sx={{ mt: -0.5, mb: 0.5 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  disabled={loading}
                  sx={{ py: 1.25 }}
                >
                  {loading ? 'Signing in...' : 'Sign In as Instructor'}
                </Button>
              </Stack>
            </form>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                New Instructor?{' '}
                <MuiLink component={Link} href="/signup" underline="hover" sx={{ fontWeight: 700 }}>
                  Register Instructor Account
                </MuiLink>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
