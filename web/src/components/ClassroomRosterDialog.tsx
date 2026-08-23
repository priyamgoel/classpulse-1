'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { m3Tokens } from '@/theme/tokens';

interface RosterStudent {
  student_id: string;
  full_name: string;
  email: string;
  joined_at: string;
}

interface ClassroomRosterDialogProps {
  open: boolean;
  onClose: () => void;
  classroom: {
    id: string;
    course_code: string;
    course_name: string;
    section_name: string;
  } | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const ClassroomRosterDialog: React.FC<ClassroomRosterDialogProps> = ({
  open,
  onClose,
  classroom,
}) => {
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && classroom) {
      fetchRoster();
    }
  }, [open, classroom]);

  const fetchRoster = async () => {
    if (!classroom) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('classpulse_token');
      const response = await fetch(`${API_BASE_URL}/classrooms/${classroom.id}/roster`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setRoster(data.roster || []);
      } else {
        setError(data.error || 'Failed to fetch roster');
      }
    } catch {
      setError('Network error fetching student roster');
    } finally {
      setLoading(false);
    }
  };

  if (!classroom) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: m3Tokens.color.onSurface }}>
        Enrolled Roster — {classroom.course_code} ({classroom.section_name})
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : roster.length === 0 ? (
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant, py: 3, textAlign: 'center' }}>
            No students enrolled in this section yet. Share the 6-character join code with your class!
          </Typography>
        ) : (
          <List>
            {roster.map((student, idx) => (
              <React.Fragment key={student.student_id}>
                <ListItem alignItems="flex-start">
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: m3Tokens.color.primary }}>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={student.full_name}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary">
                          {student.email}
                        </Typography>
                        {` — Joined ${new Date(student.joined_at).toLocaleDateString()}`}
                      </>
                    }
                  />
                </ListItem>
                {idx < roster.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
