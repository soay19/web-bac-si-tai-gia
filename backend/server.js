require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomUUID } = require('crypto');
const { pool, initDb, isDbDisabled } = require('./db');
const openApiSpec = require('./openapi');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..')));

const allowedKeyRegex = /^[a-zA-Z0-9_-]{1,120}$/;

const normalizeValue = (value) => {
  if (typeof value === 'undefined') {
    return null;
  }
  return value;
};

const parseStateValue = (value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }
  return value;
};

const parseCookies = (cookieHeader) => {
  const cookieString = String(cookieHeader || '').trim();
  if (!cookieString) {
    return {};
  }

  return cookieString.split(';').reduce((acc, segment) => {
    const [rawKey, ...rest] = segment.split('=');
    const key = String(rawKey || '').trim();
    if (!key) {
      return acc;
    }
    const rawValue = rest.join('=');
    acc[key] = decodeURIComponent(String(rawValue || '').trim());
    return acc;
  }, {});
};

const setCookieHeader = (name, value, maxAgeSeconds = 60 * 60 * 24 * 7) => {
  const encodedValue = encodeURIComponent(String(value || ''));
  return `${name}=${encodedValue}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax`;
};

const clearCookieHeader = (name) => `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

const isDbReady = () => !isDbDisabled && !!pool;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = new Set(['user', 'doctor', 'admin']);
const ROLE_REDIRECTS = {
  user: '/user/my-appointments.html',
  doctor: '/doctor/my-appointments.html',
  admin: '/admin/view-appointments.html'
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizePhone = (phone) => String(phone || '').trim();
const normalizeRole = (role) => {
  const roleValue = String(role || '').trim().toLowerCase();
  if (roleValue === 'patient') {
    return 'user';
  }
  return roleValue;
};

const normalizePassword = (password) => String(password || '').trim();
const normalizeNullableText = (value) => {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
};

const normalizeNullableNumber = (value) => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
};

const getConsultationFeeFromRating = (ratingValue) => {
  const rating = Number(ratingValue);
  const safeRating = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;
  return Math.round((250000 + safeRating * 150000) / 1000) * 1000;
};

const getInitialsFromName = (value) => {
  const cleaned = String(value || '')
    .replace(/\b(bs\.?|dr\.?|bac\s*si)\b/gi, '')
    .trim();

  if (!cleaned) {
    return 'BS';
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const toSeed = (input) => {
  let hash = 0;
  const text = String(input || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const buildGeneratedDoctorAvatar = (name, doctorId) => {
  const seed = toSeed(`${doctorId || ''}:${name || ''}`);
  const gender = inferDoctorGenderFromName(name) === 'female' ? 'women' : 'men';
  const index = (seed % 99) + 1;
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
};

const getDoctorAvatar = (doctor) => {
  const avatarUrl = String(doctor?.avatarUrl || '').trim();
  if (avatarUrl) {
    return avatarUrl;
  }

  return buildGeneratedDoctorAvatar(doctor?.name || '', doctor?.id || doctor?.doctorId || '');
};

const FEMALE_NAME_HINTS = new Set([
  'anh',
  'chi',
  'dung',
  'duyen',
  'ha',
  'hang',
  'hien',
  'huong',
  'khanh',
  'lan',
  'linh',
  'mai',
  'my',
  'ngoc',
  'nhung',
  'phuong',
  'quynh',
  'thao',
  'thu',
  'thuy',
  'trang',
  'trinh',
  'vy',
  'yen'
]);

const removeVietnameseAccents = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const inferDoctorGenderFromName = (name) => {
  const normalized = removeVietnameseAccents(name)
    .toLowerCase()
    .replace(/\b(bs\.?|dr\.?|bac\s*si)\b/g, '')
    .trim();

  if (!normalized) {
    return 'male';
  }

  if (/\bthi\b/.test(normalized)) {
    return 'female';
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  const lastToken = parts[parts.length - 1] || '';
  if (FEMALE_NAME_HINTS.has(lastToken)) {
    return 'female';
  }

  return 'male';
};

const ensureUserProfile = async (userId) => {
  await pool.query(
    `
    INSERT IGNORE INTO user_profiles (
      user_id,
      gender,
      bank_name,
      bank_account
    )
    VALUES (?, 'not-say', 'Vietcombank', '0123456789')
    `,
    [userId]
  );
};

const getSessionUser = async (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = String(cookies.thatClinicSession || '').trim();
  if (!token) {
    return null;
  }

  const [rows] = await pool.query(
    `
    SELECT
      us.id AS sessionId,
      us.user_id AS userId,
      us.expires_at AS expiresAt,
      u.email,
      u.phone,
      u.full_name AS fullName,
      u.user_type AS role,
      u.is_active AS isActive
    FROM user_sessions us
    INNER JOIN users u ON u.id = us.user_id
    WHERE us.token = ?
    LIMIT 1
    `,
    [token]
  );

  if (!rows.length) {
    return null;
  }

  const sessionUser = rows[0];
  const isExpired = sessionUser.expiresAt && new Date(sessionUser.expiresAt).getTime() <= Date.now();
  if (isExpired || !sessionUser.isActive) {
    await pool.query('DELETE FROM user_sessions WHERE token = ?', [token]);
    return null;
  }

  return {
    token,
    userId: sessionUser.userId,
    sessionId: sessionUser.sessionId,
    fullName: sessionUser.fullName,
    email: sessionUser.email,
    phone: sessionUser.phone,
    role: normalizeRole(sessionUser.role)
  };
};

const getUserScopedStateKey = (userId, key) => `${userId}:${key}`;

app.get('/api/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

app.get('/api/docs', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Clinic API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html, body { margin: 0; padding: 0; background: #0f172a; }
    #swagger-ui { background: white; min-height: 100vh; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'BaseLayout'
      });
    };
  </script>
</body>
</html>`);
});

app.get('/api/health', async (_req, res) => {
  if (!isDbReady()) {
    return res.json({ ok: true, database: 'disabled' });
  }

  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true, database: 'connected' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Database unavailable' });
  }
});

app.get('/api/state', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const keysParam = String(req.query.keys || '').trim();

    if (!keysParam) {
      const [rows] = await pool.query('SELECT state_key, state_value FROM app_state');
      const data = {};
      rows.forEach((row) => {
        data[row.state_key] = parseStateValue(row.state_value);
      });
      return res.json({ data });
    }

    const keys = keysParam
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((key) => allowedKeyRegex.test(key));

    if (!keys.length) {
      return res.json({ data: {} });
    }

    const placeholders = keys.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT state_key, state_value FROM app_state WHERE state_key IN (${placeholders})`,
      keys
    );

    const rowMap = new Map(rows.map((row) => [row.state_key, parseStateValue(row.state_value)]));
    const data = {};
    keys.forEach((key) => {
      data[key] = rowMap.has(key) ? rowMap.get(key) : null;
    });

    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ message: 'Cannot fetch state', error: error.message });
  }
});

app.get('/api/doctors', async (_req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        d.id,
        u.full_name AS name,
        d.specialty_id AS specialtyId,
        s.name AS specialty,
        d.avatar_url AS avatarUrl,
        d.rating,
        d.consultation_fee AS consultationFee,
        d.experience_years AS experienceYears,
        COALESCE(stats.pendingConfirmedAppointments, 0) AS pendingConfirmedAppointments,
        COALESCE(stats.proposedCurrentAppointments, 0) AS proposedCurrentAppointments,
        COALESCE(revenue.totalRevenue, 0) AS totalRevenue
      FROM doctors d
      INNER JOIN users u ON u.id = d.user_id
      INNER JOIN specialties s ON s.id = d.specialty_id
      LEFT JOIN (
        SELECT
          doctor_id,
          SUM(CASE WHEN status IN ('chờ_xác_nhận', 'đã_xác_nhận') THEN 1 ELSE 0 END) AS pendingConfirmedAppointments,
          SUM(CASE WHEN status IN ('chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận') THEN 1 ELSE 0 END) AS proposedCurrentAppointments
        FROM appointments
        WHERE status IN ('chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận')
          AND appointment_date >= NOW()
        GROUP BY doctor_id
      ) stats ON stats.doctor_id = d.id
      LEFT JOIN (
        SELECT
          a.doctor_id,
          SUM(CASE WHEN p.payment_status = 'completed' THEN p.amount ELSE 0 END) AS totalRevenue
        FROM appointments a
        INNER JOIN payments p ON p.appointment_id = a.id
        GROUP BY a.doctor_id
      ) revenue ON revenue.doctor_id = d.id
      WHERE d.is_active = TRUE
      ORDER BY s.name ASC, u.full_name ASC
      `
    );

    const doctors = rows.map((row) => ({
      id: row.id,
      name: row.name,
      gender: inferDoctorGenderFromName(row.name),
      specialtyId: row.specialtyId,
      specialty: row.specialty,
      avatarUrl: getDoctorAvatar(row),
      rating: Number(row.rating || 0),
      consultationFee: Number(row.consultationFee || getConsultationFeeFromRating(row.rating)),
      experienceYears: Number(row.experienceYears || 0),
      pendingConfirmedAppointments: Number(row.pendingConfirmedAppointments || 0),
      proposedCurrentAppointments: Number(row.proposedCurrentAppointments || 0),
      totalRevenue: Number(row.totalRevenue || 0)
    }));

    return res.json({ data: doctors });
  } catch (error) {
    return res.status(500).json({ message: 'Cannot fetch doctors', error: error.message });
  }
});

app.get('/api/doctors/me/profile', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    if (sessionUser.role !== 'doctor') {
      return res.status(403).json({ message: 'Chỉ bác sĩ mới có quyền xem hồ sơ này' });
    }

    const [rows] = await pool.query(
      `
      SELECT
        d.id AS doctorId,
        u.full_name AS name,
        u.phone,
        d.avatar_url AS avatarUrl,
        d.specialty_id AS specialtyId,
        s.name AS specialty,
        d.rating,
        d.consultation_fee AS consultationFee,
        d.experience_years AS experienceYears,
        COALESCE(SUM(CASE WHEN a.status = 'đã_xác_nhận' AND a.appointment_date >= NOW() THEN 1 ELSE 0 END), 0) AS confirmedAppointments,
        COALESCE(SUM(CASE WHEN a.status IN ('chưa_thanh_toán', 'chờ_xác_nhận') AND a.appointment_date >= NOW() THEN 1 ELSE 0 END), 0) AS unconfirmedAppointments,
        COALESCE(SUM(CASE WHEN a.status IN ('chờ_xác_nhận', 'đã_xác_nhận') AND a.appointment_date >= NOW() THEN 1 ELSE 0 END), 0) AS pendingConfirmedAppointments,
        COALESCE(SUM(CASE WHEN a.status IN ('chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận') AND a.appointment_date >= NOW() THEN 1 ELSE 0 END), 0) AS proposedCurrentAppointments
      FROM doctors d
      INNER JOIN users u ON u.id = d.user_id
      INNER JOIN specialties s ON s.id = d.specialty_id
      LEFT JOIN appointments a ON a.doctor_id = d.id
      WHERE d.user_id = ? AND d.is_active = TRUE
      GROUP BY d.id, u.full_name, u.phone, d.avatar_url, d.specialty_id, s.name, d.rating, d.experience_years
      LIMIT 1
      `,
      [sessionUser.userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ bác sĩ' });
    }

    const doctor = rows[0];

    // --- VIP: top 5 doctors by total revenue (ties included) ---
    const [revenueRows] = await pool.query(
      `
      SELECT
        d.id AS doctorId,
        COALESCE(SUM(CASE WHEN p.payment_status = 'completed' THEN p.amount ELSE 0 END), 0) AS totalRevenue
      FROM doctors d
      LEFT JOIN appointments a ON a.doctor_id = d.id
      LEFT JOIN payments p ON p.appointment_id = a.id
      WHERE d.is_active = TRUE
      GROUP BY d.id
      ORDER BY totalRevenue DESC
      `
    );

    const revenueList = revenueRows.map((r) => ({
      doctorId: r.doctorId,
      totalRevenue: Number(r.totalRevenue || 0)
    }));

    // Find the revenue threshold: the 5th doctor's revenue by position (ties included)
    const sortedRevenues = revenueList.map((r) => r.totalRevenue)
      .filter((v) => v > 0)
      .sort((a, b) => b - a);
    const top5Threshold = sortedRevenues.length >= 5 ? sortedRevenues[4] : (sortedRevenues[sortedRevenues.length - 1] || 0);
    const vipDoctorIds = new Set(
      revenueList
        .filter((r) => r.totalRevenue > 0 && r.totalRevenue >= top5Threshold)
        .map((r) => r.doctorId)
    );

    const myRevenue = revenueList.find((r) => r.doctorId === doctor.doctorId);
    const myTotalRevenue = myRevenue ? myRevenue.totalRevenue : 0;
    const isFeatured = vipDoctorIds.has(doctor.doctorId);

    const pendingConfirmedAppointments = Number(doctor.pendingConfirmedAppointments || 0);
    const proposedCurrentAppointments = Number(doctor.proposedCurrentAppointments || 0);

    return res.json({
      data: {
        doctorId: doctor.doctorId,
        name: doctor.name,
        gender: inferDoctorGenderFromName(doctor.name),
        phone: doctor.phone || '',
        avatarUrl: getDoctorAvatar({
          id: doctor.doctorId,
          name: doctor.name,
          avatarUrl: doctor.avatarUrl
        }),
        specialtyId: doctor.specialtyId,
        specialty: doctor.specialty,
        rating: Number(doctor.rating || 0),
        consultationFee: Number(doctor.consultationFee || getConsultationFeeFromRating(doctor.rating)),
        experienceYears: Number(doctor.experienceYears || 0),
        confirmedAppointments: Number(doctor.confirmedAppointments || 0),
        unconfirmedAppointments: Number(doctor.unconfirmedAppointments || 0),
        pendingConfirmedAppointments,
        proposedCurrentAppointments,
        totalRevenue: myTotalRevenue,
        isFeatured,
        featuredReason: isFeatured
          ? 'Bác sĩ nằm trong top 5 thu nhập cao nhất.'
          : 'Bác sĩ chưa nằm trong nhóm VIP.'
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể lấy hồ sơ bác sĩ', error: error.message });
  }
});

app.put('/api/doctors/me/profile', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    if (sessionUser.role !== 'doctor') {
      return res.status(403).json({ message: 'Chỉ bác sĩ mới có quyền cập nhật hồ sơ này' });
    }

    const hasPhone = Object.prototype.hasOwnProperty.call(req.body || {}, 'phone');
    const hasAvatarUrl = Object.prototype.hasOwnProperty.call(req.body || {}, 'avatarUrl');

    if (!hasPhone && !hasAvatarUrl) {
      return res.status(400).json({ message: 'Cần cung cấp số điện thoại hoặc ảnh đại diện để cập nhật' });
    }

    const phone = normalizePhone(req.body.phone);
    const avatarUrl = String(req.body.avatarUrl || '').trim();

    if (hasPhone && !phone) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
    }

    if (hasAvatarUrl && avatarUrl.length > 500000) {
      return res.status(400).json({ message: 'Ảnh đại diện quá lớn, vui lòng chọn ảnh nhỏ hơn' });
    }

    const [users] = await pool.query(
      'SELECT id FROM users WHERE id = ? AND is_active = TRUE LIMIT 1',
      [sessionUser.userId]
    );

    if (!users.length) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản bác sĩ' });
    }

    if (hasPhone) {
      const [duplicatePhoneRows] = await pool.query(
        'SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1',
        [phone, sessionUser.userId]
      );

      if (duplicatePhoneRows.length) {
        return res.status(409).json({ message: 'Số điện thoại đã được sử dụng bởi tài khoản khác' });
      }
    }

    if (hasPhone) {
      await pool.query('UPDATE users SET phone = ? WHERE id = ?', [phone, sessionUser.userId]);
    }

    if (hasAvatarUrl) {
      await pool.query(
        `
        UPDATE doctors
        SET avatar_url = ?
        WHERE user_id = ?
        `,
        [avatarUrl || null, sessionUser.userId]
      );
    }

    return res.json({
      ok: true,
      message: 'Cập nhật hồ sơ bác sĩ thành công',
      data: {
        ...(hasPhone ? { phone } : {}),
        ...(hasAvatarUrl ? { avatarUrl } : {})
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể cập nhật hồ sơ bác sĩ', error: error.message });
  }
});

app.post('/api/doctors', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  const connection = await pool.getConnection();

  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || '');
    const specialtyId = String(req.body.specialtyId || '').trim();
    const avatarUrlInput = String(req.body.avatarUrl || '').trim();

    if (!fullName || !email || !phone || !password || !specialtyId) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc để tạo bác sĩ' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu cần tối thiểu 6 ký tự' });
    }

    if (avatarUrlInput.length > 500000) {
      return res.status(400).json({ message: 'Ảnh đại diện quá lớn, vui lòng chọn ảnh nhỏ hơn' });
    }

    const [specialties] = await connection.query(
      'SELECT id, name FROM specialties WHERE id = ? AND is_active = TRUE LIMIT 1',
      [specialtyId]
    );

    if (!specialties.length) {
      return res.status(404).json({ message: 'Không tìm thấy chuyên khoa đã chọn' });
    }

    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE LOWER(email) = ? OR phone = ? LIMIT 1',
      [email, phone]
    );

    if (existingUsers.length) {
      return res.status(409).json({ message: 'Email hoặc số điện thoại đã tồn tại' });
    }

    const userId = randomUUID();
    const doctorId = randomUUID();
    const defaultAvatarUrl = buildGeneratedDoctorAvatar(fullName, doctorId);
    const avatarUrl = avatarUrlInput || defaultAvatarUrl;

    const passwordHash = normalizePassword(password);
    const licenseNumber = `LIC-AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await connection.beginTransaction();

    await connection.query(
      `
      INSERT INTO users (id, email, password_hash, full_name, phone, user_type, is_active)
      VALUES (?, ?, ?, ?, ?, 'doctor', TRUE)
      `,
      [userId, email, passwordHash, fullName, phone]
    );

    await connection.query(
      `
      INSERT INTO doctors (id, user_id, specialty_id, license_number, experience_years, bio, rating, consultation_fee, avatar_url, is_active)
      VALUES (?, ?, ?, ?, 0, NULL, 0, ?, ?, TRUE)
      `,
      [doctorId, userId, specialtyId, licenseNumber, getConsultationFeeFromRating(0), avatarUrl]
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: 'Thêm bác sĩ thành công',
      data: {
        doctorId,
        userId,
        fullName,
        gender: inferDoctorGenderFromName(fullName),
        email,
        phone,
        specialty: specialties[0].name,
        avatarUrl
      }
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_rollbackError) {
      // Ignore rollback failure.
    }

    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Dữ liệu bác sĩ bị trùng, vui lòng thử lại' });
    }

    return res.status(500).json({ message: 'Không thể thêm bác sĩ', error: error.message });
  } finally {
    connection.release();
  }
});

app.put('/api/doctors/:id', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const doctorId = String(req.params.id || '').trim();
    const fullName = String(req.body.fullName || '').trim();
    const specialtyId = String(req.body.specialtyId || '').trim();
    const rating = Number(req.body.rating);
    const experienceYears = Number(req.body.experienceYears);

    if (!doctorId || !fullName || !specialtyId || Number.isNaN(rating) || Number.isNaN(experienceYears)) {
      return res.status(400).json({ message: 'Thiếu thông tin để cập nhật bác sĩ' });
    }

    if (rating < 0 || rating > 5) {
      return res.status(400).json({ message: 'Đánh giá phải nằm trong khoảng từ 0 đến 5' });
    }

    if (experienceYears < 0) {
      return res.status(400).json({ message: 'Số năm kinh nghiệm không hợp lệ' });
    }

    const [doctors] = await pool.query(
      'SELECT id, user_id FROM doctors WHERE id = ? AND is_active = TRUE LIMIT 1',
      [doctorId]
    );

    if (!doctors.length) {
      return res.status(404).json({ message: 'Không tìm thấy bác sĩ cần cập nhật' });
    }

    const [specialties] = await pool.query(
      'SELECT id FROM specialties WHERE id = ? AND is_active = TRUE LIMIT 1',
      [specialtyId]
    );

    if (!specialties.length) {
      return res.status(404).json({ message: 'Không tìm thấy chuyên khoa đã chọn' });
    }

    const userId = doctors[0].user_id;
    const consultationFee = getConsultationFeeFromRating(rating);
    await pool.query('UPDATE users SET full_name = ? WHERE id = ?', [fullName, userId]);
    await pool.query('UPDATE doctors SET specialty_id = ?, rating = ?, consultation_fee = ?, experience_years = ? WHERE id = ?', [
      specialtyId,
      rating,
      consultationFee,
      Math.floor(experienceYears),
      doctorId
    ]);

    return res.json({ ok: true, message: 'Cập nhật bác sĩ thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể cập nhật bác sĩ', error: error.message });
  }
});

app.delete('/api/doctors/:id', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  const connection = await pool.getConnection();

  try {
    const doctorId = String(req.params.id || '').trim();
    if (!doctorId) {
      return res.status(400).json({ message: 'ID bác sĩ không hợp lệ' });
    }

    const [doctors] = await connection.query(
      'SELECT id, user_id FROM doctors WHERE id = ? AND is_active = TRUE LIMIT 1',
      [doctorId]
    );

    if (!doctors.length) {
      return res.status(404).json({ message: 'Không tìm thấy bác sĩ cần xoá' });
    }

    const userId = doctors[0].user_id;

    await connection.beginTransaction();
    await connection.query('UPDATE doctors SET is_active = FALSE WHERE id = ?', [doctorId]);
    await connection.query('UPDATE users SET is_active = FALSE WHERE id = ?', [userId]);
    await connection.commit();

    return res.json({ ok: true, message: 'Xoá bác sĩ thành công' });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_rollbackError) {
      // Ignore rollback failure.
    }

    return res.status(500).json({ message: 'Không thể xoá bác sĩ', error: error.message });
  } finally {
    connection.release();
  }
});

app.get('/api/specialties', async (_req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT id, name, description
      FROM specialties
      WHERE is_active = TRUE
      ORDER BY name ASC
      `
    );

    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Cannot fetch specialties', error: error.message });
  }
});

app.post('/api/specialties', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();

    if (!name || !description) {
      return res.status(400).json({ message: 'Tên và mô tả chuyên khoa là bắt buộc' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM specialties WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [name]
    );

    if (existing.length) {
      return res.status(409).json({ message: 'Chuyên khoa này đã tồn tại' });
    }

    const id = randomUUID();
    await pool.query(
      `
      INSERT INTO specialties (id, name, description, is_active)
      VALUES (?, ?, ?, TRUE)
      `,
      [id, name, description]
    );

    return res.status(201).json({
      ok: true,
      message: 'Thêm chuyên khoa thành công',
      data: {
        id,
        name,
        description
      }
    });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Chuyên khoa này đã tồn tại' });
    }

    return res.status(500).json({ message: 'Không thể thêm chuyên khoa', error: error.message });
  }
});

app.put('/api/specialties/:id', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const id = String(req.params.id || '').trim();
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();

    if (!id) {
      return res.status(400).json({ message: 'ID chuyên khoa không hợp lệ' });
    }

    if (!name || !description) {
      return res.status(400).json({ message: 'Tên và mô tả chuyên khoa là bắt buộc' });
    }

    const [specialtyRows] = await pool.query(
      'SELECT id FROM specialties WHERE id = ? LIMIT 1',
      [id]
    );

    if (!specialtyRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy chuyên khoa cần cập nhật' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM specialties WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
      [name, id]
    );

    if (existing.length) {
      return res.status(409).json({ message: 'Tên chuyên khoa đã tồn tại' });
    }

    await pool.query(
      'UPDATE specialties SET name = ?, description = ? WHERE id = ?',
      [name, description, id]
    );

    return res.json({
      ok: true,
      message: 'Cập nhật chuyên khoa thành công',
      data: {
        id,
        name,
        description
      }
    });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Tên chuyên khoa đã tồn tại' });
    }

    return res.status(500).json({ message: 'Không thể cập nhật chuyên khoa', error: error.message });
  }
});

app.delete('/api/specialties/:id', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ message: 'ID chuyên khoa không hợp lệ' });
    }

    const [specialtyRows] = await pool.query(
      'SELECT id, name FROM specialties WHERE id = ? LIMIT 1',
      [id]
    );

    if (!specialtyRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy chuyên khoa cần xoá' });
    }

    const specialty = specialtyRows[0];

    const [doctorRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM doctors WHERE specialty_id = ?',
      [id]
    );

    if (Number(doctorRows[0]?.total || 0) > 0) {
      return res.status(409).json({
        message: 'Không thể xoá chuyên khoa đang có bác sĩ liên kết'
      });
    }

    await pool.query('DELETE FROM specialties WHERE id = ?', [id]);

    return res.json({
      ok: true,
      message: `Đã xoá chuyên khoa ${specialty.name} thành công`
    });
  } catch (error) {
    if (error && error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: 'Không thể xoá chuyên khoa đang được sử dụng' });
    }

    return res.status(500).json({ message: 'Không thể xoá chuyên khoa', error: error.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không trùng khớp' });
    }

    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
      [email]
    );

    if (existingUsers.length) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    const id = randomUUID();
    const passwordHash = normalizePassword(password);

    await pool.query(
      `
      INSERT INTO users (id, email, password_hash, full_name, phone, user_type, is_active)
      VALUES (?, ?, ?, ?, ?, 'user', TRUE)
      `,
      [id, email, passwordHash, fullName, phone || null]
    );

    return res.status(201).json({
      ok: true,
      message: 'Đăng ký thành công',
      user: {
        id,
        email,
        fullName,
        phone: phone || null,
        role: 'user'
      }
    });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }
    return res.status(500).json({ message: 'Đăng ký thất bại', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const identifier = String(req.body.identifier || '').trim();
    const password = String(req.body.password || '');
    const requestedRole = normalizeRole(req.body.role);

    if (!identifier || !password || !requestedRole) {
      return res.status(400).json({ message: 'Thiếu thông tin đăng nhập' });
    }

    if (!ALLOWED_ROLES.has(requestedRole)) {
      return res.status(400).json({ message: 'Role không hợp lệ' });
    }

    const [rows] = await pool.query(
      `
      SELECT id, email, phone, full_name AS fullName, user_type, password_hash, is_active
      FROM users
      WHERE LOWER(email) = ? OR phone = ?
      LIMIT 1
      `,
      [identifier.toLowerCase(), identifier]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
    }

    const user = rows[0];
    const userRole = normalizeRole(user.user_type);

    if (!user.is_active) {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa' });
    }

    if (userRole !== requestedRole) {
      return res.status(403).json({ message: 'Không đúng role đăng nhập' });
    }

    if (String(password) !== String(user.password_hash || '')) {
      return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
    }

    const sessionId = randomUUID();
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `
      INSERT INTO user_sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
      `,
      [sessionId, user.id, sessionToken, expiresAt]
    );

    res.setHeader('Set-Cookie', setCookieHeader('thatClinicSession', sessionToken));

    return res.json({
      ok: true,
      message: 'Đăng nhập thành công',
      redirectTo: ROLE_REDIRECTS[userRole] || ROLE_REDIRECTS.user,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: userRole
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Đăng nhập thất bại', error: error.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    return res.json({
      ok: true,
      user: {
        id: sessionUser.userId,
        fullName: sessionUser.fullName,
        email: sessionUser.email,
        phone: sessionUser.phone,
        role: sessionUser.role
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể kiểm tra đăng nhập', error: error.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = String(cookies.thatClinicSession || '').trim();
    if (token) {
      await pool.query('DELETE FROM user_sessions WHERE token = ?', [token]);
    }

    res.setHeader('Set-Cookie', clearCookieHeader('thatClinicSession'));
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể đăng xuất', error: error.message });
  }
});

app.get('/api/user/app-state', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    const keysParam = String(req.query.keys || '').trim();
    const allowedKeys = [
      'thatClinicAppointmentDraft',
      'thatClinicPendingRequests',
      'thatClinicConfirmedAppointments',
      'thatClinicRefundNotices'
    ];

    const requestedKeys = keysParam
      ? keysParam
          .split(',')
          .map((item) => item.trim())
          .filter((item) => allowedKeys.includes(item))
      : allowedKeys;

    if (!requestedKeys.length) {
      return res.json({ data: {} });
    }

    const scopedKeys = requestedKeys.map((key) => getUserScopedStateKey(sessionUser.userId, key));
    const placeholders = scopedKeys.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT state_key, state_value FROM app_state WHERE state_key IN (${placeholders})`,
      scopedKeys
    );

    const rowMap = new Map(rows.map((row) => [row.state_key, parseStateValue(row.state_value)]));
    const data = {};

    requestedKeys.forEach((key) => {
      const scopedKey = getUserScopedStateKey(sessionUser.userId, key);
      data[key] = rowMap.has(scopedKey)
        ? rowMap.get(scopedKey)
        : key === 'thatClinicAppointmentDraft'
        ? null
        : [];
    });

    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể lấy app state', error: error.message });
  }
});

app.put('/api/user/app-state/:key', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    const key = String(req.params.key || '').trim();
    const allowedKeys = new Set([
      'thatClinicAppointmentDraft',
      'thatClinicPendingRequests',
      'thatClinicConfirmedAppointments',
      'thatClinicRefundNotices'
    ]);

    if (!allowedKeys.has(key)) {
      return res.status(400).json({ message: 'Khóa app state không hợp lệ' });
    }

    const scopedKey = getUserScopedStateKey(sessionUser.userId, key);
    const value = normalizeValue(req.body.value);

    await pool.query(
      `
      INSERT INTO app_state (state_key, state_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE state_value = VALUES(state_value)
      `,
      [scopedKey, JSON.stringify(value)]
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể lưu app state', error: error.message });
  }
});

app.get('/api/admin/appointment-overview', async (_req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        a.id,
        a.title,
        a.status,
        DATE_FORMAT(a.appointment_date, '%d/%m/%Y %H:%i') AS date,
        COALESCE(a.appointment_location, 'Chưa cập nhật') AS location,
        COALESCE(du.full_name, 'BS. Chưa cập nhật') AS doctorName,
        COALESCE(du.email, 'Chưa cập nhật') AS doctorEmail,
        COALESCE(pu.full_name, 'Chưa cập nhật') AS userName,
        COALESCE(up.bank_name, 'Chưa cập nhật') AS bankName,
        COALESCE(up.bank_account, 'Chưa cập nhật') AS bankAccount,
        COALESCE(
          pay.completed_amount,
          pay.latest_amount,
          CASE WHEN a.status = 'đã_huỷ' THEN COALESCE(d.consultation_fee, 0) ELSE 0 END
        ) AS amount
      FROM appointments a
      LEFT JOIN doctors d ON d.id = a.doctor_id
      LEFT JOIN users du ON du.id = d.user_id
      LEFT JOIN users pu ON pu.id = a.patient_id
      LEFT JOIN user_profiles up ON up.user_id = a.patient_id
      LEFT JOIN (
        SELECT
          appointment_id,
          MAX(CASE WHEN payment_status = 'completed' THEN amount END) AS completed_amount,
          MAX(amount) AS latest_amount
        FROM payments
        GROUP BY appointment_id
      ) pay ON pay.appointment_id = a.id
      ORDER BY a.appointment_date DESC
      `
    );

    const pending = rows.filter((row) => row.status === 'chờ_xác_nhận' || row.status === 'chưa_thanh_toán');
    const confirmed = rows.filter((row) => row.status === 'đã_xác_nhận');
    const refunds = rows.filter((row) => row.status === 'đã_huỷ');

    return res.json({ data: { pending, confirmed, refunds } });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể lấy danh sách lịch hẹn', error: error.message });
  }
});

app.get('/api/admin/doctor-stats', async (_req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        d.id AS doctorId,
        u.full_name AS doctorName,
        d.specialty_id AS specialtyId,
        s.name AS specialty,
        d.rating,
        d.experience_years AS experienceYears,
        d.consultation_fee AS consultationFee,
        d.avatar_url AS avatarUrl,
        COALESCE(stats.totalAppointments, 0) AS totalAppointments,
        COALESCE(stats.confirmedAppointments, 0) AS confirmedAppointments,
        COALESCE(stats.pendingAppointments, 0) AS pendingAppointments,
        COALESCE(stats.cancelledAppointments, 0) AS cancelledAppointments,
        COALESCE(stats.unpaidAppointments, 0) AS unpaidAppointments,
        COALESCE(active_stats.proposedCurrentAppointments, 0) AS proposedCurrentAppointments,
        COALESCE(revenue.totalRevenue, 0) AS totalRevenue,
        COALESCE(revenue.completedPayments, 0) AS completedPayments,
        COALESCE(patient_stats.activePatientCount, 0) AS activePatientCount
      FROM doctors d
      INNER JOIN users u ON u.id = d.user_id
      INNER JOIN specialties s ON s.id = d.specialty_id
      LEFT JOIN (
        SELECT
          doctor_id,
          COUNT(*) AS totalAppointments,
          SUM(CASE WHEN status = 'đã_xác_nhận' THEN 1 ELSE 0 END) AS confirmedAppointments,
          SUM(CASE WHEN status = 'chờ_xác_nhận' THEN 1 ELSE 0 END) AS pendingAppointments,
          SUM(CASE WHEN status = 'đã_huỷ' THEN 1 ELSE 0 END) AS cancelledAppointments,
          SUM(CASE WHEN status = 'chưa_thanh_toán' THEN 1 ELSE 0 END) AS unpaidAppointments
        FROM appointments
        GROUP BY doctor_id
      ) stats ON stats.doctor_id = d.id
      LEFT JOIN (
        SELECT
          doctor_id,
          SUM(CASE WHEN status IN ('chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận') THEN 1 ELSE 0 END) AS proposedCurrentAppointments
        FROM appointments
        WHERE status IN ('chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận')
          AND appointment_date >= NOW()
        GROUP BY doctor_id
      ) active_stats ON active_stats.doctor_id = d.id
      LEFT JOIN (
        SELECT
          a.doctor_id,
          SUM(CASE WHEN p.payment_status = 'completed' THEN p.amount ELSE 0 END) AS totalRevenue,
          COUNT(CASE WHEN p.payment_status = 'completed' THEN 1 END) AS completedPayments
        FROM appointments a
        INNER JOIN payments p ON p.appointment_id = a.id
        GROUP BY a.doctor_id
      ) revenue ON revenue.doctor_id = d.id
      LEFT JOIN (
        SELECT
          doctor_id,
          COUNT(DISTINCT patient_id) AS activePatientCount
        FROM appointments
        WHERE status IN ('chờ_xác_nhận', 'đã_xác_nhận')
          AND appointment_date >= NOW()
        GROUP BY doctor_id
      ) patient_stats ON patient_stats.doctor_id = d.id
      WHERE d.is_active = TRUE
      ORDER BY COALESCE(revenue.totalRevenue, 0) DESC, u.full_name ASC
      `
    );

    const doctors = rows.map((row) => ({
      doctorId: row.doctorId,
      doctorName: row.doctorName,
      gender: inferDoctorGenderFromName(row.doctorName),
      specialtyId: row.specialtyId,
      specialty: row.specialty,
      rating: Number(row.rating || 0),
      experienceYears: Number(row.experienceYears || 0),
      consultationFee: Number(row.consultationFee || 0),
      avatarUrl: getDoctorAvatar({ id: row.doctorId, name: row.doctorName, avatarUrl: row.avatarUrl }),
      totalAppointments: Number(row.totalAppointments || 0),
      confirmedAppointments: Number(row.confirmedAppointments || 0),
      pendingAppointments: Number(row.pendingAppointments || 0),
      cancelledAppointments: Number(row.cancelledAppointments || 0),
      unpaidAppointments: Number(row.unpaidAppointments || 0),
      proposedCurrentAppointments: Number(row.proposedCurrentAppointments || 0),
      totalRevenue: Number(row.totalRevenue || 0),
      completedPayments: Number(row.completedPayments || 0),
      activePatientCount: Number(row.activePatientCount || 0)
    }));

    return res.json({ data: doctors });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể lấy thống kê bác sĩ', error: error.message });
  }
});

app.get('/api/admin/paid-refunds', async (_req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT state_value FROM app_state WHERE state_key = '__admin_paid_refunds' LIMIT 1`
    );

    if (!rows.length) {
      return res.json({ data: [] });
    }

    const parsed = parseStateValue(rows[0].state_value);
    return res.json({ data: Array.isArray(parsed) ? parsed : [] });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể lấy danh sách hoàn tiền', error: error.message });
  }
});

app.put('/api/admin/paid-refunds', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const list = Array.isArray(req.body.value) ? req.body.value : [];
    await pool.query(
      `
      INSERT INTO app_state (state_key, state_value)
      VALUES ('__admin_paid_refunds', CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE state_value = VALUES(state_value)
      `,
      [JSON.stringify(list)]
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể lưu danh sách hoàn tiền', error: error.message });
  }
});

app.get('/api/users/:id/profile', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const paramId = String(req.params.id || '').trim();
    let userId = paramId;
    if (paramId === 'me') {
      const sessionUser = await getSessionUser(req);
      if (!sessionUser) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }
      userId = sessionUser.userId;
    }

    if (!userId) {
      return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
    }

    await ensureUserProfile(userId);

    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.full_name AS fullName,
        u.email,
        u.phone,
        up.date_of_birth AS dateOfBirth,
        up.gender,
        up.address,
        up.height_cm AS heightCm,
        up.weight_kg AS weightKg,
        up.blood_type AS bloodType,
        up.insurance_provider AS insuranceProvider,
        up.insurance_id AS insuranceId,
        up.bank_name AS bankName,
        up.bank_account AS bankAccount
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = ? AND u.is_active = TRUE
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const row = rows[0];

    return res.json({
      ok: true,
      data: {
        id: row.id,
        fullName: row.fullName || '',
        email: row.email || '',
        phone: row.phone || '',
        dateOfBirth: row.dateOfBirth || null,
        gender: row.gender || 'not-say',
        address: row.address || '',
        heightCm: row.heightCm || null,
        weightKg: row.weightKg || null,
        bloodType: row.bloodType || '',
        insuranceProvider: row.insuranceProvider || '',
        insuranceId: row.insuranceId || '',
        bankName: row.bankName || '',
        bankAccount: row.bankAccount || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể lấy hồ sơ người dùng', error: error.message });
  }
});

app.put('/api/users/:id/profile', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  const connection = await pool.getConnection();

  try {
    const paramId = String(req.params.id || '').trim();
    let userId = paramId;

    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    if (paramId === 'me') {
      userId = sessionUser.userId;
    }

    if (sessionUser.role !== 'admin' && userId !== sessionUser.userId) {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật hồ sơ này' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
    }

    const fullName = normalizeNullableText(req.body.fullName);
    const email = normalizeNullableText(req.body.email)?.toLowerCase() || null;
    const phone = normalizeNullableText(req.body.phone);

    const dateOfBirth = normalizeNullableText(req.body.dateOfBirth);
    const genderRaw = normalizeNullableText(req.body.gender) || 'not-say';
    const allowedGenders = new Set(['male', 'female', 'other', 'not-say']);
    const gender = allowedGenders.has(genderRaw) ? genderRaw : 'not-say';

    const address = normalizeNullableText(req.body.address);
    const heightCm = normalizeNullableNumber(req.body.heightCm);
    const weightKg = normalizeNullableNumber(req.body.weightKg);
    const bloodType = normalizeNullableText(req.body.bloodType);
    const insuranceProvider = normalizeNullableText(req.body.insuranceProvider);
    const insuranceId = normalizeNullableText(req.body.insuranceId);
    const bankName = normalizeNullableText(req.body.bankName);
    const bankAccount = normalizeNullableText(req.body.bankAccount);

    if (!fullName || !email || !phone) {
      return res.status(400).json({ message: 'Họ tên, email và số điện thoại là bắt buộc' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    const [users] = await connection.query(
      'SELECT id FROM users WHERE id = ? AND is_active = TRUE LIMIT 1',
      [userId]
    );
    if (!users.length) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const [duplicateEmailRows] = await connection.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ? LIMIT 1',
      [email, userId]
    );
    if (duplicateEmailRows.length) {
      return res.status(409).json({ message: 'Email đã được sử dụng bởi tài khoản khác' });
    }

    const [duplicatePhoneRows] = await connection.query(
      'SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1',
      [phone, userId]
    );
    if (duplicatePhoneRows.length) {
      return res.status(409).json({ message: 'Số điện thoại đã được sử dụng bởi tài khoản khác' });
    }

    await connection.beginTransaction();

    await connection.query(
      'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
      [fullName, email, phone, userId]
    );

    await connection.query(
      `
      INSERT INTO user_profiles (
        user_id,
        date_of_birth,
        gender,
        address,
        height_cm,
        weight_kg,
        blood_type,
        insurance_provider,
        insurance_id,
        bank_name,
        bank_account
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        date_of_birth = VALUES(date_of_birth),
        gender = VALUES(gender),
        address = VALUES(address),
        height_cm = VALUES(height_cm),
        weight_kg = VALUES(weight_kg),
        blood_type = VALUES(blood_type),
        insurance_provider = VALUES(insurance_provider),
        insurance_id = VALUES(insurance_id),
        bank_name = VALUES(bank_name),
        bank_account = VALUES(bank_account)
      `,
      [
        userId,
        dateOfBirth,
        gender,
        address,
        heightCm,
        weightKg,
        bloodType,
        insuranceProvider,
        insuranceId,
        bankName,
        bankAccount
      ]
    );

    await connection.commit();

    return res.json({ ok: true, message: 'Đã cập nhật hồ sơ thành công' });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_rollbackError) {
      // Ignore rollback failure.
    }

    return res.status(500).json({ message: 'Không thể cập nhật hồ sơ', error: error.message });
  } finally {
    connection.release();
  }
});

app.put('/api/state/:key', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const key = String(req.params.key || '').trim();
    if (!allowedKeyRegex.test(key)) {
      return res.status(400).json({ message: 'Invalid key format' });
    }

    const value = normalizeValue(req.body.value);
    await pool.query(
      `
      INSERT INTO app_state (state_key, state_value)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE state_value = VALUES(state_value)
      `,
      [key, JSON.stringify(value)]
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Cannot store state', error: error.message });
  }
});

app.delete('/api/state/:key', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const key = String(req.params.key || '').trim();
    if (!allowedKeyRegex.test(key)) {
      return res.status(400).json({ message: 'Invalid key format' });
    }

    await pool.query('DELETE FROM app_state WHERE state_key = ?', [key]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Cannot delete state', error: error.message });
  }
});

// ===== APPOINTMENT ENDPOINTS =====
app.post('/api/appointments', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    const doctorId = String(req.body.doctorId || '').trim();
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const appointmentDate = String(req.body.appointmentDate || '').trim();
    const appointmentLocation = String(req.body.appointmentLocation || '').trim();
    const durationMinutes = Number(req.body.durationMinutes || 30);

    if (!doctorId || !title || !appointmentDate) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const appointmentDateObj = new Date(appointmentDate);
    if (Number.isNaN(appointmentDateObj.getTime())) {
      return res.status(400).json({ message: 'Thời gian lịch hẹn không hợp lệ' });
    }

    if (appointmentDateObj.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Không thể tạo lịch hẹn trong quá khứ' });
    }

    // Verify doctor exists
    const [doctorRows] = await pool.query(
      'SELECT id, rating, consultation_fee FROM doctors WHERE id = ? AND is_active = TRUE LIMIT 1',
      [doctorId]
    );

    if (!doctorRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy bác sĩ' });
    }

    // Check for overlapping appointments with this doctor using local DATETIME strings
    const [conflictRows] = await pool.query(
      `
      SELECT COUNT(*) AS conflictCount
      FROM appointments
      WHERE doctor_id = ?
        AND status IN ('chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận')
        AND appointment_date < DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s'), INTERVAL ? MINUTE)
        AND DATE_ADD(appointment_date, INTERVAL duration_minutes MINUTE) > STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s')
      `,
      [doctorId, appointmentDate, durationMinutes, appointmentDate]
    );

    if (conflictRows[0]?.conflictCount > 0) {
      return res.status(409).json({
        message: 'Bác sĩ này đã có lịch hẹn khác trong khung thời gian này. Vui lòng chọn thời gian khác.'
      });
    }

    // Create appointment with unpaid status
    const appointmentId = randomUUID();
    const doctorRow = doctorRows[0];
    const consultationFee = Number(doctorRow.consultation_fee || getConsultationFeeFromRating(doctorRow.rating));
    await pool.query(
      `
      INSERT INTO appointments (
        id,
        patient_id,
        doctor_id,
        title,
        description,
        appointment_date,
        appointment_location,
        duration_minutes,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'chưa_thanh_toán')
      `,
      [
        appointmentId,
        sessionUser.userId,
        doctorId,
        title,
        description || null,
        appointmentDate,
        appointmentLocation || null,
        durationMinutes
      ]
    );

    return res.status(201).json({
      ok: true,
      message: 'Tạo lịch hẹn thành công',
      data: {
        id: appointmentId,
        doctorId,
        title,
        description,
        appointmentDate,
        appointmentLocation,
        durationMinutes,
        status: 'chưa_thanh_toán',
        amount: consultationFee
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể tạo lịch hẹn', error: error.message });
  }
});

// Get booked time slots for a doctor
app.get('/api/doctors/:doctorId/booked-slots', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const doctorId = String(req.params.doctorId || '').trim();
    const appointmentDate = String(req.query.appointmentDate || '').trim();
    const durationMinutes = Number(req.query.durationMinutes || 15);

    if (!doctorId || !appointmentDate || !Number.isFinite(durationMinutes) || durationMinutes < 1) {
      return res.status(400).json({ message: 'Thiếu tham số: doctorId, appointmentDate, durationMinutes' });
    }

    // Verify doctor exists
    const [doctorRows] = await pool.query(
      'SELECT id FROM doctors WHERE id = ? AND is_active = TRUE LIMIT 1',
      [doctorId]
    );

    if (!doctorRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy bác sĩ' });
    }

    // Get all appointments that overlap with the requested time slot
    const [appointments] = await pool.query(
      `
      SELECT
        id,
        DATE_FORMAT(appointment_date, '%Y-%m-%d %H:%i:%s') AS startTime,
        DATE_FORMAT(DATE_ADD(appointment_date, INTERVAL duration_minutes MINUTE), '%Y-%m-%d %H:%i:%s') AS endTime,
        duration_minutes AS durationMinutes,
        status,
        title
      FROM appointments
      WHERE doctor_id = ?
        AND status IN ('chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận')
        AND appointment_date < DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s'), INTERVAL ? MINUTE)
        AND DATE_ADD(appointment_date, INTERVAL duration_minutes MINUTE) > STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s')
      ORDER BY appointment_date ASC
      `,
      [doctorId, appointmentDate, durationMinutes, appointmentDate]
    );

    return res.json({ ok: true, data: appointments });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể lấy danh sách lịch bận', error: error.message });
  }
});

// Get appointments for current user
app.get('/api/appointments', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    const userRole = sessionUser.role;
    const filterDoctorId = String(req.query.doctorId || '').trim();
    const filterUserId = String(req.query.userId || '').trim();
    const filterStatus = String(req.query.status || '').trim();
    const validStatuses = ['chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận', 'đã_huỷ'];
    let query, params;

    if (filterStatus && !validStatuses.includes(filterStatus)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }

    if (userRole === 'doctor') {
      // Doctor sees appointments where they are the doctor
      // Primary lookup: doctors.user_id = session user id
      // Fallback: lookup doctor by user email if primary lookup fails (handles mismatched ids)
      const [doctorRows] = await pool.query(
        'SELECT id FROM doctors WHERE user_id = ? LIMIT 1',
        [sessionUser.userId]
      );

      let doctorId = null;
      if (doctorRows.length) {
        doctorId = doctorRows[0].id;
      } else if (sessionUser.email) {
        const [byEmailRows] = await pool.query(
          `SELECT d.id FROM doctors d INNER JOIN users u ON u.id = d.user_id WHERE u.email = ? LIMIT 1`,
          [sessionUser.email]
        );
        if (byEmailRows.length) {
          doctorId = byEmailRows[0].id;
        }
      }

      if (!doctorId) {
        return res.json({ data: [] });
      }

      if (filterDoctorId && filterDoctorId !== doctorId) {
        return res.status(403).json({ message: 'Không có quyền xem lịch hẹn của bác sĩ khác' });
      }

      const whereClauses = ['a.doctor_id = ?'];
      params = [doctorId];

      // Doctor pages only show upcoming appointments to match "đề xuất" và "sắp tới".
      whereClauses.push('a.appointment_date >= NOW()');

      if (filterUserId) {
        whereClauses.push('a.patient_id = ?');
        params.push(filterUserId);
      }

      if (filterStatus) {
        whereClauses.push('a.status = ?');
        params.push(filterStatus);
      }

      query = `
        SELECT
          a.id,
          a.patient_id AS patientId,
          a.doctor_id AS doctorId,
          a.title,
          a.description,
          a.appointment_date AS appointmentDate,
          a.appointment_location AS appointmentLocation,
          a.duration_minutes AS durationMinutes,
          d.consultation_fee AS consultationFee,
          d.rating AS doctorRating,
          a.status,
          u.full_name AS patientName,
          u.phone AS patientPhone,
          a.created_at AS createdAt,
          a.updated_at AS updatedAt
        FROM appointments a
        LEFT JOIN doctors d ON d.id = a.doctor_id
        INNER JOIN users u ON u.id = a.patient_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY a.appointment_date ASC
      `;
    } else if (userRole === 'admin') {
      const whereClauses = [];
      params = [];

      if (filterDoctorId) {
        whereClauses.push('a.doctor_id = ?');
        params.push(filterDoctorId);
      }

      if (filterUserId) {
        whereClauses.push('a.patient_id = ?');
        params.push(filterUserId);
      }

      if (filterStatus) {
        whereClauses.push('a.status = ?');
        params.push(filterStatus);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
      query = `
        SELECT
          a.id,
          a.patient_id AS patientId,
          a.doctor_id AS doctorId,
          a.title,
          a.description,
          a.appointment_date AS appointmentDate,
          a.appointment_location AS appointmentLocation,
          a.duration_minutes AS durationMinutes,
          d.consultation_fee AS consultationFee,
          d.rating AS doctorRating,
          a.status,
          up.full_name AS patientName,
          up.phone AS patientPhone,
          ud.full_name AS doctorName,
          ud.phone AS doctorPhone,
          d.specialty_id AS specialtyId,
          s.name AS specialtyName,
          a.created_at AS createdAt,
          a.updated_at AS updatedAt
        FROM appointments a
        LEFT JOIN users up ON up.id = a.patient_id
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN users ud ON ud.id = d.user_id
        LEFT JOIN specialties s ON s.id = d.specialty_id
        ${whereSql}
        ORDER BY a.appointment_date DESC
      `;
    } else {
      // Patient/User sees their own appointments
      if (filterUserId && filterUserId !== sessionUser.userId) {
        return res.status(403).json({ message: 'Không có quyền xem lịch hẹn của người dùng khác' });
      }

      const whereClauses = ['a.patient_id = ?'];
      params = [sessionUser.userId];

      if (filterDoctorId) {
        whereClauses.push('a.doctor_id = ?');
        params.push(filterDoctorId);
      }

      if (filterStatus) {
        whereClauses.push('a.status = ?');
        params.push(filterStatus);
      }

      query = `
        SELECT
          a.id,
          a.patient_id AS patientId,
          a.doctor_id AS doctorId,
          a.title,
          a.description,
          a.appointment_date AS appointmentDate,
          a.appointment_location AS appointmentLocation,
          a.duration_minutes AS durationMinutes,
          d.consultation_fee AS consultationFee,
          d.rating AS doctorRating,
          a.status,
          u.full_name AS doctorName,
          u.phone AS doctorPhone,
          d.specialty_id AS specialtyId,
          s.name AS specialtyName,
          a.created_at AS createdAt,
          a.updated_at AS updatedAt
        FROM appointments a
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN users u ON u.id = d.user_id
        LEFT JOIN specialties s ON s.id = d.specialty_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY a.appointment_date DESC
      `;
    }

    const [rows] = await pool.query(query, params);
    const data = rows.map((row) => {
      if (!row?.doctorName) {
        return row;
      }

      return {
        ...row,
        doctorGender: inferDoctorGenderFromName(row.doctorName),
        consultationFee: Number(row.consultationFee || getConsultationFeeFromRating(row.doctorRating))
      };
    });

    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể lấy danh sách lịch hẹn', error: error.message });
  }
});

// Update appointment status (mark as paid/confirmed)
app.put('/api/appointments/:id/status', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    const appointmentId = String(req.params.id || '').trim();
    const newStatus = String(req.body.status || '').trim();
    const validStatuses = ['chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận', 'đã_huỷ'];

    if (!appointmentId || !newStatus || !validStatuses.includes(newStatus)) {
      return res.status(400).json({ message: 'Thông tin không hợp lệ' });
    }

    // Get appointment
    const [appointmentRows] = await pool.query(
      'SELECT id, patient_id, doctor_id FROM appointments WHERE id = ? LIMIT 1',
      [appointmentId]
    );

    if (!appointmentRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn' });
    }

    const appointment = appointmentRows[0];

    // Check permission - patient can update their own appointments, doctor can update appointments involving them as doctor
    const isOwnAppointment = appointment.patient_id === sessionUser.userId;
    let isDoctorAppointment = false;

    if (sessionUser.role === 'doctor') {
      const [doctorRows] = await pool.query(
        'SELECT id FROM doctors WHERE user_id = ? LIMIT 1',
        [sessionUser.userId]
      );
      isDoctorAppointment =
        doctorRows.length > 0 && appointment.doctor_id === doctorRows[0].id;
    }

    if (!isOwnAppointment && !isDoctorAppointment) {
      return res.status(403).json({ message: 'Không có quyền cập nhật lịch hẹn này' });
    }

    // Update status
    await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [newStatus, appointmentId]);

    return res.json({
      ok: true,
      message: 'Cập nhật trạng thái lịch hẹn thành công',
      data: {
        id: appointmentId,
        status: newStatus
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể cập nhật lịch hẹn', error: error.message });
  }
});

// Delete appointment (cancel/remove)
app.delete('/api/appointments/:id', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    const appointmentId = String(req.params.id || '').trim();

    if (!appointmentId) {
      return res.status(400).json({ message: 'ID lịch hẹn không hợp lệ' });
    }

    // Get appointment
    const [appointmentRows] = await pool.query(
      'SELECT id, patient_id, status FROM appointments WHERE id = ? LIMIT 1',
      [appointmentId]
    );

    if (!appointmentRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn' });
    }

    const appointment = appointmentRows[0];

    // Admin can delete any appointment, patient can only delete their own
    const isAdmin = sessionUser.role === 'admin';
    const isOwnAppointment = appointment.patient_id === sessionUser.userId;

    if (!isAdmin && !isOwnAppointment) {
      return res.status(403).json({ message: 'Không có quyền xoá lịch hẹn này' });
    }

    // Non-admin users can only delete unpaid or cancelled appointments
    if (!isAdmin && appointment.status !== 'chưa_thanh_toán' && appointment.status !== 'đã_huỷ') {
      return res.status(400).json({ message: 'Chỉ có thể xoá lịch hẹn chưa thanh toán hoặc đã huỷ' });
    }

    // Delete appointment
    await pool.query('DELETE FROM appointments WHERE id = ?', [appointmentId]);

    return res.json({
      ok: true,
      message: 'Xoá lịch hẹn thành công'
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể xoá lịch hẹn', error: error.message });
  }
});

// Doctor marks confirmed appointment as completed and removes it from DB
app.delete('/api/appointments/:id/complete', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    if (sessionUser.role !== 'doctor') {
      return res.status(403).json({ message: 'Chỉ bác sĩ mới có quyền hoàn thành lịch hẹn' });
    }

    const appointmentId = String(req.params.id || '').trim();
    if (!appointmentId) {
      return res.status(400).json({ message: 'ID lịch hẹn không hợp lệ' });
    }

    const [doctorRows] = await pool.query(
      'SELECT id FROM doctors WHERE user_id = ? LIMIT 1',
      [sessionUser.userId]
    );

    if (!doctorRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ bác sĩ' });
    }

    const doctorId = doctorRows[0].id;

    const [appointmentRows] = await pool.query(
      'SELECT id, doctor_id, status FROM appointments WHERE id = ? LIMIT 1',
      [appointmentId]
    );

    if (!appointmentRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn' });
    }

    const appointment = appointmentRows[0];

    if (appointment.doctor_id !== doctorId) {
      return res.status(403).json({ message: 'Không có quyền hoàn thành lịch hẹn này' });
    }

    if (appointment.status !== 'đã_xác_nhận') {
      return res.status(400).json({ message: 'Chỉ có thể hoàn thành lịch hẹn đã xác nhận' });
    }

    await pool.query('DELETE FROM appointments WHERE id = ?', [appointmentId]);

    return res.json({
      ok: true,
      message: 'Đã hoàn thành và xoá lịch hẹn thành công'
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể hoàn thành lịch hẹn', error: error.message });
  }
});

// ===== VNPAY PAYMENT ENDPOINTS =====
app.post('/api/payment/vnpay/create', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    const appointmentId = String(req.body.appointmentId || '').trim();
    if (!appointmentId) {
      return res.status(400).json({ message: 'Thông tin không hợp lệ' });
    }

    // Get appointment
    const [appointmentRows] = await pool.query(
      `
      SELECT
        a.id,
        a.patient_id,
        a.title,
        a.appointment_date,
        d.rating AS doctor_rating,
        d.consultation_fee AS consultation_fee
      FROM appointments a
      INNER JOIN doctors d ON d.id = a.doctor_id
      WHERE a.id = ?
      LIMIT 1
      `,
      [appointmentId]
    );

    if (!appointmentRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn' });
    }

    const appointment = appointmentRows[0];
    if (appointment.patient_id !== sessionUser.userId) {
      return res.status(403).json({ message: 'Không có quyền thanh toán lịch hẹn này' });
    }

    const amount = Number(appointment.consultation_fee || getConsultationFeeFromRating(appointment.doctor_rating));
    if (amount <= 0) {
      return res.status(400).json({ message: 'Không xác định được số tiền thanh toán của bác sĩ này' });
    }

    // Generate transaction ID
    const transactionId = `THAT${Date.now()}`;
    
    // Create payment record
    const paymentId = randomUUID();
    await pool.query(
      `
      INSERT INTO payments (id, appointment_id, amount, currency, payment_method, payment_status, transaction_id)
      VALUES (?, ?, ?, 'VND', 'bank_transfer', 'pending', ?)
      `,
      [paymentId, appointmentId, amount, transactionId]
    );

    // Build VNPAY redirect URL
    const returnUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/payment/vnpay/return`;
    
    const vnpayUrl = new URL('http://sandbox.vnpayment.vn/paygate/pay');
    vnpayUrl.searchParams.append('vnp_Version', '2.1.0');
    vnpayUrl.searchParams.append('vnp_Command', 'pay');
    vnpayUrl.searchParams.append('vnp_TmnCode', process.env.VNPAY_TMN_CODE || 'THATCLINIC');
    vnpayUrl.searchParams.append('vnp_Amount', (amount * 100).toString()); // VNPAY uses amount * 100
    vnpayUrl.searchParams.append('vnp_CurrCode', 'VND');
    vnpayUrl.searchParams.append('vnp_TxnRef', transactionId);
    vnpayUrl.searchParams.append('vnp_OrderInfo', `Thanh toan lich hen: ${appointment.title}`);
    vnpayUrl.searchParams.append('vnp_OrderType', 'appointment');
    vnpayUrl.searchParams.append('vnp_Locale', 'vn');
    vnpayUrl.searchParams.append('vnp_ReturnUrl', returnUrl);
    vnpayUrl.searchParams.append('vnp_IpAddr', req.ip || '127.0.0.1');
    vnpayUrl.searchParams.append('vnp_CreateDate', new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14));

    return res.json({
      ok: true,
      paymentId,
      transactionId,
      redirectUrl: vnpayUrl.toString(),
      message: 'Payment initiated'
    });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể khởi tạo thanh toán', error: error.message });
  }
});

// VNPAY return/callback endpoint - simulated VNPay gateway response
app.get('/api/payment/vnpay/return', async (req, res) => {
  if (!isDbReady()) {
    return res.status(503).json({ message: 'Database is temporarily disabled' });
  }

  try {
    const transactionId = String(req.query.vnp_TxnRef || '').trim();
    const responseCode = String(req.query.vnp_ResponseCode || '').trim();

    if (!transactionId) {
      return res.status(400).send('Invalid transaction');
    }

    // Get payment by transaction ID
    const [paymentRows] = await pool.query(
      'SELECT id, appointment_id, amount FROM payments WHERE transaction_id = ? LIMIT 1',
      [transactionId]
    );

    if (!paymentRows.length) {
      return res.status(404).send('Payment not found');
    }

    const payment = paymentRows[0];

    // Check response code - 00 means success in VNPAY
    // For simulation: any response_code that's not 99 is treated as success
    const isSuccess = responseCode === '00' || (responseCode && responseCode !== '99');

    if (isSuccess) {
      // Mark payment as completed
      await pool.query(
        `UPDATE payments SET payment_status = 'completed', paid_at = NOW() WHERE id = ?`,
        [payment.id]
      );

      // Update appointment status to pending confirmation
      await pool.query(
        `UPDATE appointments SET status = 'chờ_xác_nhận' WHERE id = ?`,
        [payment.appointment_id]
      );

      // Send the user back to their appointments page after payment succeeds.
      // The UI can show a one-time success message from the query string.
      return res.redirect(`/user/my-appointments.html?payment=success&appointmentId=${payment.appointment_id}`);
    } else {
      // Mark payment as failed
      await pool.query(
        `UPDATE payments SET payment_status = 'failed' WHERE id = ?`,
        [payment.id]
      );

      // Send user back to checkout page so they can retry payment.
      return res.redirect(`/user/checkout.html?payment=failed&appointmentId=${payment.appointment_id}`);
    }
  } catch (error) {
    console.error('VNPAY return error:', error);
    return res.status(500).send('Payment processing error');
  }
});

// Simulate VNPAY payment gateway - for testing purposes
app.get('/api/payment/vnpay/simulate', async (req, res) => {
  try {
    const transactionId = String(req.query.vnp_TxnRef || '').trim();
    const amount = String(req.query.vnp_Amount || '').trim();
    const orderInfo = String(req.query.vnp_OrderInfo || '').trim();
    const returnUrl = String(req.query.vnp_ReturnUrl || '').trim();

    // Return a simple HTML form to simulate VNPAY payment page
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mô phỏng VNPAY</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .payment-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 500px;
      width: 100%;
    }
    .vnpay-logo {
      text-align: center;
      font-size: 28px;
      font-weight: bold;
      color: #1f5fb2;
      margin-bottom: 30px;
    }
    .info-block {
      background: #f8f9fa;
      border-left: 4px solid #1f5fb2;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    .info-block label {
      display: block;
      color: #666;
      font-size: 12px;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    .info-block p {
      color: #333;
      font-size: 16px;
      font-weight: 500;
    }
    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 30px;
    }
    button {
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .btn-success {
      background: #28a745;
      color: white;
    }
    .btn-success:hover {
      background: #218838;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(40, 167, 69, 0.3);
    }
    .btn-error {
      background: #dc3545;
      color: white;
    }
    .btn-error:hover {
      background: #c82333;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(220, 53, 69, 0.3);
    }
    .note {
      margin-top: 20px;
      padding: 12px;
      background: #e7f3ff;
      border-radius: 4px;
      font-size: 13px;
      color: #004085;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="payment-card">
    <div class="vnpay-logo">🏦 VNPAY (Mô phỏng)</div>
    
    <div class="info-block">
      <label>Mã giao dịch</label>
      <p>${transactionId}</p>
    </div>
    
    <div class="info-block">
      <label>Số tiền thanh toán</label>
      <p>${(Number(amount) / 100).toLocaleString('vi-VN')}đ</p>
    </div>
    
    <div class="info-block">
      <label>Mô tả đơn hàng</label>
      <p>${orderInfo}</p>
    </div>

    <div class="actions">
      <form action="${returnUrl}" method="GET" style="flex: 1;">
        <input type="hidden" name="vnp_TxnRef" value="${transactionId}">
        <input type="hidden" name="vnp_ResponseCode" value="00">
        <input type="hidden" name="vnp_Amount" value="${amount}">
        <button type="submit" class="btn-success">✓ Thanh toán thành công</button>
      </form>
      
      <form action="${returnUrl}" method="GET" style="flex: 1;">
        <input type="hidden" name="vnp_TxnRef" value="${transactionId}">
        <input type="hidden" name="vnp_ResponseCode" value="99">
        <input type="hidden" name="vnp_Amount" value="${amount}">
        <button type="submit" class="btn-error">✗ Thanh toán thất bại</button>
      </form>
    </div>

  </div>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
});

initDb()
  .then(() => {
    app.listen(port, () => {
      if (isDbDisabled) {
        console.log(`THAT Clinic backend listening on http://localhost:${port} (MySQL disabled)`);
      } else {
        console.log(`THAT Clinic backend listening on http://localhost:${port}`);
      }
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  });

const closePool = async () => {
  if (pool) {
    await pool.end();
  }
};

process.on('SIGINT', () => {
  closePool().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  closePool().finally(() => process.exit(0));
});
