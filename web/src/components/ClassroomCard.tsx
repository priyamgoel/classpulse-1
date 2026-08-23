'use client';

import React from 'react';
import { Card, CardContent, Typography, Box, Chip, Stack } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import PeopleIcon from '@mui/icons-material/People';
import { m3Tokens } from '@/theme/tokens';

export interface ClassroomCardProps {
  id: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  teacherName: string;
  studentCount?: number;
  joinCode?: string;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export const ClassroomCard: React.FC<ClassroomCardProps> = ({
  id,
  courseCode,
  courseName,
  sectionName,
  teacherName,
  studentCount = 0,
  joinCode,
  selected = false,
  onSelect,
}) => {
  return (
    <Card
      onClick={() => onSelect && onSelect(id)}
      sx={{
        cursor: onSelect ? 'pointer' : 'default',
        borderRadius: `${m3Tokens.shape.large}px`,
        border: selected
          ? `2px solid ${m3Tokens.color.primary}`
          : `1px solid ${m3Tokens.color.outlineVariant}`,
        overflow: 'hidden',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        '&:hover': onSelect
          ? {
              transform: 'translateY(-2px)',
              boxShadow: '0px 4px 12px rgba(0,0,0,0.1)',
            }
          : {},
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 1.5 }}>
          <Box>
            <Chip
              label={courseCode}
              size="small"
              sx={{
                backgroundColor: m3Tokens.color.primaryContainer,
                color: m3Tokens.color.onPrimaryContainer,
                fontWeight: 700,
                mb: 1,
              }}
            />
            <Typography variant="h6" component="div" sx={{ color: m3Tokens.color.onSurface }}>
              {courseName}
            </Typography>
            <Typography variant="subtitle2" sx={{ color: m3Tokens.color.secondary }}>
              {sectionName}
            </Typography>
          </Box>
          <SchoolIcon sx={{ color: m3Tokens.color.primary }} />
        </Stack>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 1.5, borderTop: `1px solid ${m3Tokens.color.outlineVariant}` }}>
          <Typography variant="body2" sx={{ color: m3Tokens.color.onSurfaceVariant }}>
            Instructor: <strong>{teacherName}</strong>
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {joinCode && (
              <Chip
                label={`Code: ${joinCode}`}
                size="small"
                variant="outlined"
                sx={{ borderColor: m3Tokens.color.outline }}
              />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: m3Tokens.color.secondary }}>
              <PeopleIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {studentCount}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};
