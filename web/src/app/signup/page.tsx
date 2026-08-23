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
  ToggleButtonGroup,
  ToggleButton,
  Link as MuiLink,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '@/context/AuthContext';
import { m3Tokens } from '@/theme/tokens';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signup(email, password, fullName, role);
    setLoading(false);

    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Signup failed');
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
            <Typography variant="h4" sx={{ color: m3Tokens.color.primary, fontWeight: 800, textAlign: 'center', mb: 1 }}>
              ClassPulse
            </Typography>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, textAlign: 'center', mb: 3 }}>
              Create a new account
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="caption" sx={{ color: m3Tokens.color.secondary, fontWeight: 700, mb: 1, display: 'block' }}>
                    SELECT YOUR ROLE
                  </Typography>
                  <ToggleButtonGroup
                    value={role}
                    exclusive
                    onChange={(_, newRole) => newRole && setRole(newRole)}
                    fullWidth
                    color="primary"
                  >
                    <ToggleButton value="student">
                      <PersonIcon sx={{ mr: 1 }} /> Student
                    </ToggleButton>
                    <ToggleButton value="teacher">
                      <SchoolIcon sx={{ mr: 1 }} /> Teacher
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <TextField
                  label="Full Name"
                  type="text"
                  fullWidth
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <TextField
                  label="Email Address"
                  type="email"
                  fullWidth
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  label="Password (min 6 chars)"
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
                  {loading ? 'Creating Account...' : `Sign Up as ${role === 'teacher' ? 'Teacher' : 'Student'}`}
                </Button>
              </Stack>
            </form>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                Already have an account?{' '}
                <MuiLink component={Link} href="/login" underline="hover" sx={{ fontWeight: 700 }}>
                  Sign In
                </MuiLink>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
