'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Link from 'next/link';
import { m3Tokens } from '@/theme/tokens';

export default function JoinPage() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('code');
    setCode(raw ? raw.trim() : '');
  }, []);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the code is still visible to type manually.
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
        px: 2,
      }}
    >
      <Container maxWidth="sm">
        <Card sx={{ borderRadius: m3Tokens.shape.large }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: m3Tokens.color.primaryContainer,
                color: m3Tokens.color.onPrimaryContainer,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <PhoneAndroidIcon sx={{ fontSize: 38 }} />
            </Box>

            <Typography variant="h4" sx={{ color: m3Tokens.color.primary, fontWeight: 800, mb: 0.5 }}>
              ClassPulse
            </Typography>
            <Typography variant="subtitle1" sx={{ color: m3Tokens.color.onSurface, fontWeight: 700, mb: 0.5 }}>
              Join a classroom on Android
            </Typography>
            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, mb: 3 }}>
              Enter this code in the ClassPulse Android app to enrol in your instructor&apos;s section.
            </Typography>

            {code === null ? null : code ? (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontWeight: 700,
                    color: m3Tokens.color.onSurfaceVariant,
                    mb: 1,
                  }}
                >
                  Your classroom join code
                </Typography>

                <Box
                  sx={{
                    p: { xs: 2.5, sm: 3 },
                    borderRadius: m3Tokens.shape.large,
                    backgroundColor: m3Tokens.color.primaryContainer,
                    color: m3Tokens.color.onPrimaryContainer,
                    mb: 3,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: { xs: '2rem', sm: '2.75rem' },
                      fontWeight: 900,
                      letterSpacing: '8px',
                      fontFamily: 'monospace',
                      lineHeight: 1.2,
                      wordBreak: 'break-all',
                    }}
                  >
                    {code}
                  </Typography>
                </Box>

                <Button
                  variant={copied ? 'outlined' : 'contained'}
                  color={copied ? 'success' : 'primary'}
                  startIcon={copied ? <CheckCircleIcon /> : <ContentCopyIcon />}
                  onClick={handleCopy}
                  sx={{ mb: 3, fontWeight: 700, textTransform: 'none', px: 3 }}
                >
                  {copied ? 'Copied!' : 'Copy Code'}
                </Button>
              </>
            ) : (
              <Alert severity="warning" sx={{ mb: 3, textAlign: 'left', borderRadius: '10px' }}>
                <strong>No join code found.</strong> Ask your instructor for the 6-character classroom code, then
                reopen the link they shared with you.
              </Alert>
            )}

            <Divider sx={{ mb: 3 }} />

            <Stack spacing={1.5} sx={{ textAlign: 'left', mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: m3Tokens.color.onSurface }}>
                How to join
              </Typography>
              {[
                'Install and open the ClassPulse Android app.',
                'Sign in with your student account.',
                'Tap “Join Classroom” and enter the code above.',
              ].map((step, index) => (
                <Stack key={step} direction="row" spacing={1.5} alignItems="flex-start">
                  <Chip
                    label={index + 1}
                    size="small"
                    sx={{
                      height: 22,
                      minWidth: 22,
                      fontWeight: 800,
                      bgcolor: m3Tokens.color.secondaryContainer,
                      color: m3Tokens.color.onSecondaryContainer,
                    }}
                  />
                  <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
                    {step}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
              Are you an instructor?{' '}
              <MuiLink component={Link} href="/login" underline="hover" sx={{ fontWeight: 700 }}>
                Sign in to the web dashboard
              </MuiLink>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
