'use client';

import React, { useState } from 'react';
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
  Link as MuiLink,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import { useAuth } from '@/context/AuthContext';
import { m3Tokens } from '@/theme/tokens';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, logout } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      // Check if user is a student attempting to access Web Dashboard
      const storedUser = localStorage.getItem('classpulse_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser.role === 'student') {
            logout();
            setError(
              'Student accounts access ClassPulse via the Android mobile app. Please open the ClassPulse Android App on your phone to log in.'
            );
            return;
          }
        } catch {
          // ignore error
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
              <Stack spacing={2.5}>
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
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  disabled={loading}
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
