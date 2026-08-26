const ExcelJS = require('exceljs');
const db = require('../db');

/**
 * Fetches attendance matrix data for a classroom.
 * Returns { classroom, sessions, students, matrix }
 */
async function getAttendanceMatrixData(classroomId) {
  // 1. Classroom info
  const classRes = await db.query(
    `SELECT c.id, c.section_name, co.course_code, co.course_name, u.full_name as teacher_name
     FROM classrooms c
     JOIN courses co ON c.course_id = co.id
     JOIN users u ON c.teacher_id = u.id
     WHERE c.id = $1`,
    [classroomId]
  );

  if (classRes.rows.length === 0) {
    throw new Error('Classroom not found');
  }

  const classroom = classRes.rows[0];

  // 2. All conducted sessions in chronological order
  const sessionsRes = await db.query(
    `SELECT id, started_at, ended_at
     FROM sessions
     WHERE classroom_id = $1
     ORDER BY started_at ASC`,
    [classroomId]
  );
  const sessions = sessionsRes.rows;

  // 3. All enrolled students
  const studentsRes = await db.query(
    `SELECT u.id as student_id, u.full_name, u.email, en.joined_at
     FROM enrollments en
     JOIN users u ON en.student_id = u.id
     WHERE en.classroom_id = $1
     ORDER BY u.full_name ASC`,
    [classroomId]
  );
  const students = studentsRes.rows;

  // 4. All attendance records for this classroom
  const recordsRes = await db.query(
    `SELECT ar.session_id, ar.student_id, ar.status, ar.validated_at,
            EXTRACT(MILLISECONDS FROM (ar.validated_at - ar.scan_started_at))::int as acl_ms
     FROM attendance_records ar
     JOIN sessions s ON ar.session_id = s.id
     WHERE s.classroom_id = $1`,
    [classroomId]
  );

  // Map attendance by `${session_id}_${student_id}`
  const attendanceMap = new Map();
  recordsRes.rows.forEach((rec) => {
    attendanceMap.set(`${rec.session_id}_${rec.student_id}`, rec);
  });

  // 5. Build matrix rows
  const totalSessions = sessions.length;
  const rows = students.map((student, idx) => {
    let attendedCount = 0;
    const sessionStatuses = sessions.map((session) => {
      const rec = attendanceMap.get(`${session.id}_${student.student_id}`);
      if (rec && rec.status === 'PRESENT') {
        attendedCount++;
        return 'P';
      }
      return 'A';
    });

    const percentage = totalSessions > 0
      ? Math.round((attendedCount / totalSessions) * 1000) / 10
      : 100.0;

    const status = percentage >= 75 ? 'Eligible' : 'Shortage Warning';

    return {
      srNo: idx + 1,
      studentId: student.student_id,
      fullName: student.full_name,
      email: student.email,
      sessionStatuses,
      attendedCount,
      totalSessions,
      percentage,
      status,
    };
  });

  return {
    classroom,
    sessions,
    students,
    rows,
  };
}

/**
 * Generates CSV string representation of attendance matrix.
 */
async function generateCsv(classroomId) {
  const data = await getAttendanceMatrixData(classroomId);

  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '';
    const val = String(str);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [];

  // Metadata headers
  lines.push(`ClassPulse Attendance Report`);
  lines.push(`Course,${escapeCsv(data.classroom.course_code + ' - ' + data.classroom.course_name)}`);
  lines.push(`Section,${escapeCsv(data.classroom.section_name)}`);
  lines.push(`Instructor,${escapeCsv(data.classroom.teacher_name)}`);
  lines.push(`Exported At,${escapeCsv(new Date().toISOString())}`);
  lines.push(''); // blank separator

  // Table Column Headers
  const headers = ['Sr No', 'Student Name', 'Email'];
  data.sessions.forEach((s, idx) => {
    const d = new Date(s.started_at);
    const dateFormatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    headers.push(`S${idx + 1} (${dateFormatted})`);
  });
  headers.push('Attended', 'Total Sessions', 'Attendance %', 'Eligibility');
  lines.push(headers.map(escapeCsv).join(','));

  // Data Rows
  data.rows.forEach((row) => {
    const rowValues = [
      row.srNo,
      row.fullName,
      row.email,
      ...row.sessionStatuses,
      row.attendedCount,
      row.totalSessions,
      `${row.percentage}%`,
      row.status,
    ];
    lines.push(rowValues.map(escapeCsv).join(','));
  });

  return lines.join('\r\n');
}

/**
 * Generates formatted Excel (.xlsx) buffer representation of attendance matrix.
 */
async function generateExcel(classroomId) {
  const data = await getAttendanceMatrixData(classroomId);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ClassPulse Platform';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Attendance Matrix', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }],
  });

  // 1. Report Title & Info Rows
  worksheet.mergeCells('A1', 'E1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'ClassPulse — Classroom Attendance Matrix';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E1B16' } };
  titleCell.alignment = { vertical: 'middle' };

  worksheet.getCell('A2').value = 'Course:';
  worksheet.getCell('B2').value = `${data.classroom.course_code} — ${data.classroom.course_name}`;
  worksheet.getCell('A2').font = { bold: true };

  worksheet.getCell('A3').value = 'Section:';
  worksheet.getCell('B3').value = data.classroom.section_name;
  worksheet.getCell('A3').font = { bold: true };

  worksheet.getCell('A4').value = 'Instructor:';
  worksheet.getCell('B4').value = data.classroom.teacher_name;
  worksheet.getCell('A4').font = { bold: true };

  worksheet.getCell('D2').value = 'Total Sessions:';
  worksheet.getCell('E2').value = data.sessions.length;
  worksheet.getCell('D2').font = { bold: true };

  worksheet.getCell('D3').value = 'Total Enrolled:';
  worksheet.getCell('E3').value = data.students.length;
  worksheet.getCell('D3').font = { bold: true };

  worksheet.getCell('D4').value = 'Export Date:';
  worksheet.getCell('E4').value = new Date().toLocaleDateString();
  worksheet.getCell('D4').font = { bold: true };

  // Row 5 is empty spacer
  worksheet.addRow([]);

  // 2. Table Column Headers (Row 6)
  const headerCols = ['#', 'Student Name', 'Email'];
  data.sessions.forEach((s, idx) => {
    const d = new Date(s.started_at);
    const dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    headerCols.push(`S${idx + 1} (${dateFormatted})`);
  });
  headerCols.push('Attended', 'Total', 'Attendance %', 'Status');

  const headerRow = worksheet.addRow(headerCols);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6750A4' }, // ClassPulse M3 Primary
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0BCFF' } },
      bottom: { style: 'medium', color: { argb: 'FF4F378B' } },
      left: { style: 'thin', color: { argb: 'FFD0BCFF' } },
      right: { style: 'thin', color: { argb: 'FFD0BCFF' } },
    };
  });
  worksheet.getCell('B6').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getCell('C6').alignment = { vertical: 'middle', horizontal: 'left' };

  // 3. Populate Student Rows
  data.rows.forEach((row) => {
    const rowValues = [
      row.srNo,
      row.fullName,
      row.email,
      ...row.sessionStatuses,
      row.attendedCount,
      row.totalSessions,
      `${row.percentage}%`,
      row.status,
    ];

    const excelRow = worksheet.addRow(rowValues);
    excelRow.height = 20;

    // Formatting individual cells in student row
    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE7E0EC' } },
        bottom: { style: 'thin', color: { argb: 'FFE7E0EC' } },
        left: { style: 'thin', color: { argb: 'FFE7E0EC' } },
        right: { style: 'thin', color: { argb: 'FFE7E0EC' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Student Name & Email left aligned
      if (colNumber === 2 || colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      // Session status styling (P vs A)
      if (colNumber > 3 && colNumber <= 3 + data.sessions.length) {
        if (cell.value === 'P') {
          cell.font = { name: 'Calibri', bold: true, color: { argb: 'FF1B5E20' } }; // Dark Green
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        } else if (cell.value === 'A') {
          cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFB71C1C' } }; // Dark Red
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
        }
      }

      // Status column highlight (Last column)
      if (colNumber === headerCols.length) {
        if (row.percentage >= 75) {
          cell.font = { name: 'Calibri', bold: true, color: { argb: 'FF1B5E20' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        } else {
          cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFB71C1C' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
        }
      }
    });
  });

  // 4. Auto-fit column widths
  worksheet.getColumn(1).width = 6;  // #
  worksheet.getColumn(2).width = 24; // Name
  worksheet.getColumn(3).width = 28; // Email
  for (let i = 4; i <= 3 + data.sessions.length; i++) {
    worksheet.getColumn(i).width = 13; // Session columns
  }
  const summaryColStart = 4 + data.sessions.length;
  worksheet.getColumn(summaryColStart).width = 12;     // Attended
  worksheet.getColumn(summaryColStart + 1).width = 10; // Total
  worksheet.getColumn(summaryColStart + 2).width = 15; // Percentage
  worksheet.getColumn(summaryColStart + 3).width = 18; // Status

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  getAttendanceMatrixData,
  generateCsv,
  generateExcel,
};
