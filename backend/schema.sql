CREATE DATABASE IF NOT EXISTS that_clinic
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE that_clinic;

-- ===== USERS & AUTHENTICATION =====
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

CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- ===== MEDICAL DATA =====
CREATE TABLE IF NOT EXISTS specialties (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doctors (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  specialty_id VARCHAR(36) NOT NULL,
  license_number VARCHAR(50) NOT NULL UNIQUE,
  experience_years INT NOT NULL,
  bio TEXT,
  rating DECIMAL(3, 2) DEFAULT 0.00,
  consultation_fee DECIMAL(10, 2) NOT NULL DEFAULT 850000.00,
  avatar_url LONGTEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE RESTRICT,
  INDEX idx_specialty (specialty_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== APPOINTMENTS =====
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
  INDEX idx_appointment_date (appointment_date),
  CHECK (duration_minutes BETWEEN 15 AND 480)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== PAYMENTS & REFUNDS =====
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  appointment_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'VND',
  payment_method ENUM('bank_transfer', 'credit_card', 'cash') NOT NULL,
  payment_status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(100),
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  INDEX idx_appointment (appointment_id),
  INDEX idx_status (payment_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refunds (
  id VARCHAR(36) PRIMARY KEY,
  payment_id VARCHAR(36) NOT NULL,
  appointment_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  refund_reason TEXT NOT NULL,
  refund_status ENUM('pending', 'processing', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  bank_account_holder VARCHAR(255),
  refunded_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  INDEX idx_appointment (appointment_id),
  INDEX idx_status (refund_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== AUDIT & LOGS =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(36),
  changes JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== SEED SPECIALTIES & DOCTORS =====
INSERT IGNORE INTO specialties (id, name, description, is_active)
VALUES
  ('sp-tong-quat', 'Tổng quát', 'Khám và tư vấn sức khỏe tổng quát', TRUE),
  ('sp-nhi-khoa', 'Nhi khoa', 'Khám và điều trị cho trẻ em', TRUE),
  ('sp-dinh-duong', 'Dinh dưỡng', 'Tư vấn và điều trị liên quan dinh dưỡng', TRUE),
  ('sp-tim-mach', 'Tim mạch', 'Khám và điều trị bệnh tim mạch', TRUE),
  ('sp-da-lieu', 'Da liễu', 'Khám và điều trị bệnh da liễu', TRUE),
  ('sp-chinh-hinh', 'Chỉnh hình', 'Khám và điều trị cơ xương khớp', TRUE);

INSERT IGNORE INTO users (id, email, password_hash, full_name, phone, user_type, is_active)
VALUES
  ('udoc-001', 'doctor001@thatclinic.vn', '123456', 'BS. Nguyễn Minh Anh', '0900000001', 'doctor', TRUE),
  ('udoc-002', 'doctor002@thatclinic.vn', '123456', 'BS. Trần Gia Huy', '0900000002', 'doctor', TRUE),
  ('udoc-003', 'doctor003@thatclinic.vn', '123456', 'BS. Lê Quốc Thịnh', '0900000003', 'doctor', TRUE),
  ('udoc-004', 'doctor004@thatclinic.vn', '123456', 'BS. Phạm Đức Long', '0900000004', 'doctor', TRUE),
  ('udoc-005', 'doctor005@thatclinic.vn', '123456', 'BS. Bùi Thuỳ Linh', '0900000005', 'doctor', TRUE),
  ('udoc-006', 'doctor006@thatclinic.vn', '123456', 'BS. Phạm Văn Tâm', '0900000006', 'doctor', TRUE),
  ('udoc-007', 'doctor007@thatclinic.vn', '123456', 'BS. Đặng Tuấn Kiệt', '0900000007', 'doctor', TRUE),
  ('udoc-008', 'doctor008@thatclinic.vn', '123456', 'BS. Vũ Hoàng Yến', '0900000008', 'doctor', TRUE),
  ('udoc-009', 'doctor009@thatclinic.vn', '123456', 'BS. Nguyễn Gia Bảo', '0900000009', 'doctor', TRUE),
  ('udoc-010', 'doctor010@thatclinic.vn', '123456', 'BS. Lương Khánh Linh', '0900000010', 'doctor', TRUE),
  ('udoc-011', 'doctor011@thatclinic.vn', '123456', 'BS. Lê Thanh Hà', '0900000011', 'doctor', TRUE),
  ('udoc-012', 'doctor012@thatclinic.vn', '123456', 'BS. Nguyễn Thu Trang', '0900000012', 'doctor', TRUE),
  ('udoc-013', 'doctor013@thatclinic.vn', '123456', 'BS. Phạm Quốc Bảo', '0900000013', 'doctor', TRUE),
  ('udoc-014', 'doctor014@thatclinic.vn', '123456', 'BS. Trần Mỹ Duyên', '0900000014', 'doctor', TRUE),
  ('udoc-015', 'doctor015@thatclinic.vn', '123456', 'BS. Vũ Nhật Nam', '0900000015', 'doctor', TRUE),
  ('udoc-016', 'doctor016@thatclinic.vn', '123456', 'BS. Trần Đức Minh', '0900000016', 'doctor', TRUE),
  ('udoc-017', 'doctor017@thatclinic.vn', '123456', 'BS. Phan Hồng An', '0900000017', 'doctor', TRUE),
  ('udoc-018', 'doctor018@thatclinic.vn', '123456', 'BS. Lê Phương Thảo', '0900000018', 'doctor', TRUE),
  ('udoc-019', 'doctor019@thatclinic.vn', '123456', 'BS. Đỗ Anh Quân', '0900000019', 'doctor', TRUE),
  ('udoc-020', 'doctor020@thatclinic.vn', '123456', 'BS. Nguyễn Tường Vy', '0900000020', 'doctor', TRUE),
  ('udoc-021', 'doctor021@thatclinic.vn', '123456', 'BS. Vũ Thị Yến', '0900000021', 'doctor', TRUE),
  ('udoc-022', 'doctor022@thatclinic.vn', '123456', 'BS. Trịnh Minh Khôi', '0900000022', 'doctor', TRUE),
  ('udoc-023', 'doctor023@thatclinic.vn', '123456', 'BS. Nguyễn Hồng Nhung', '0900000023', 'doctor', TRUE),
  ('udoc-024', 'doctor024@thatclinic.vn', '123456', 'BS. Lê Hoài An', '0900000024', 'doctor', TRUE),
  ('udoc-025', 'doctor025@thatclinic.vn', '123456', 'BS. Phạm Khánh Chi', '0900000025', 'doctor', TRUE),
  ('udoc-026', 'doctor026@thatclinic.vn', '123456', 'BS. Hoàng Minh Tuấn', '0900000026', 'doctor', TRUE),
  ('udoc-027', 'doctor027@thatclinic.vn', '123456', 'BS. Trần Anh Tuấn', '0900000027', 'doctor', TRUE),
  ('udoc-028', 'doctor028@thatclinic.vn', '123456', 'BS. Nguyễn Bảo Ngọc', '0900000028', 'doctor', TRUE),
  ('udoc-029', 'doctor029@thatclinic.vn', '123456', 'BS. Đinh Quang Huy', '0900000029', 'doctor', TRUE),
  ('udoc-030', 'doctor030@thatclinic.vn', '123456', 'BS. Lâm Gia Khánh', '0900000030', 'doctor', TRUE);

INSERT IGNORE INTO users (id, email, password_hash, full_name, phone, user_type, is_active)
VALUES
  ('uadm-001', 'admin001@thatclinic.vn', '123456', 'Quản trị viên 01', '0910000001', 'admin', TRUE),
  ('uadm-002', 'admin002@thatclinic.vn', '123456', 'Quản trị viên 02', '0910000002', 'admin', TRUE),
  ('uusr-001', 'user001@thatclinic.vn', '123456', 'Người dùng 01', '0920000001', 'user', TRUE),
  ('uusr-002', 'user002@thatclinic.vn', '123456', 'Người dùng 02', '0920000002', 'user', TRUE),
  ('uusr-003', 'user003@thatclinic.vn', '123456', 'Người dùng 03', '0920000003', 'user', TRUE),
  ('uusr-004', 'user004@thatclinic.vn', '123456', 'Người dùng 04', '0920000004', 'user', TRUE),
  ('uusr-005', 'user005@thatclinic.vn', '123456', 'Người dùng 05', '0920000005', 'user', TRUE),
  ('uusr-006', 'user006@thatclinic.vn', '123456', 'Người dùng 06', '0920000006', 'user', TRUE),
  ('uusr-007', 'user007@thatclinic.vn', '123456', 'Người dùng 07', '0920000007', 'user', TRUE),
  ('uusr-008', 'user008@thatclinic.vn', '123456', 'Người dùng 08', '0920000008', 'user', TRUE),
  ('uusr-009', 'user009@thatclinic.vn', '123456', 'Người dùng 09', '0920000009', 'user', TRUE),
  ('uusr-010', 'user010@thatclinic.vn', '123456', 'Người dùng 10', '0920000010', 'user', TRUE),
  ('uusr-011', 'user011@thatclinic.vn', '123456', 'Trần Thị Hương', '0920000011', 'user', TRUE),
  ('uusr-012', 'user012@thatclinic.vn', '123456', 'Nguyễn Văn Đức', '0920000012', 'user', TRUE),
  ('uusr-013', 'user013@thatclinic.vn', '123456', 'Lê Thị Mai', '0920000013', 'user', TRUE),
  ('uusr-014', 'user014@thatclinic.vn', '123456', 'Phạm Minh Tuấn', '0920000014', 'user', TRUE),
  ('uusr-015', 'user015@thatclinic.vn', '123456', 'Vũ Thị Lan', '0920000015', 'user', TRUE),
  ('uusr-016', 'user016@thatclinic.vn', '123456', 'Hoàng Quốc Việt', '0920000016', 'user', TRUE),
  ('uusr-017', 'user017@thatclinic.vn', '123456', 'Đặng Thị Ngọc', '0920000017', 'user', TRUE),
  ('uusr-018', 'user018@thatclinic.vn', '123456', 'Bùi Văn Hải', '0920000018', 'user', TRUE),
  ('uusr-019', 'user019@thatclinic.vn', '123456', 'Trịnh Thị Phương', '0920000019', 'user', TRUE),
  ('uusr-020', 'user020@thatclinic.vn', '123456', 'Ngô Đình Khoa', '0920000020', 'user', TRUE),
  ('uusr-021', 'user021@thatclinic.vn', '123456', 'Đinh Thị Thanh', '0920000021', 'user', TRUE),
  ('uusr-022', 'user022@thatclinic.vn', '123456', 'Lương Văn Sơn', '0920000022', 'user', TRUE),
  ('uusr-023', 'user023@thatclinic.vn', '123456', 'Phan Thị Yến', '0920000023', 'user', TRUE),
  ('uusr-024', 'user024@thatclinic.vn', '123456', 'Dương Minh Hoàng', '0920000024', 'user', TRUE),
  ('uusr-025', 'user025@thatclinic.vn', '123456', 'Tạ Thị Kim', '0920000025', 'user', TRUE),
  ('uusr-026', 'user026@thatclinic.vn', '123456', 'Hà Văn Trung', '0920000026', 'user', TRUE),
  ('uusr-027', 'user027@thatclinic.vn', '123456', 'Mai Thị Liên', '0920000027', 'user', TRUE),
  ('uusr-028', 'user028@thatclinic.vn', '123456', 'Cao Quang Minh', '0920000028', 'user', TRUE),
  ('uusr-029', 'user029@thatclinic.vn', '123456', 'Lý Thị Hồng', '0920000029', 'user', TRUE),
  ('uusr-030', 'user030@thatclinic.vn', '123456', 'Đoàn Văn Phúc', '0920000030', 'user', TRUE);

INSERT IGNORE INTO user_profiles (
  user_id,
  gender,
  bank_name,
  bank_account
)
SELECT
  u.id,
  'not-say',
  'Vietcombank',
  CONCAT('1', RIGHT(CONCAT('0000000000', ABS(CRC32(u.id))), 9))
FROM users u;

INSERT IGNORE INTO doctors (id, user_id, specialty_id, license_number, experience_years, bio, rating, is_active)
VALUES
  ('doc-001', 'udoc-001', 'sp-tong-quat', 'LIC-THAT-0001', 10, 'Bác sĩ tổng quát.', 5.00, TRUE),
  ('doc-002', 'udoc-002', 'sp-tong-quat', 'LIC-THAT-0002', 15, 'Bác sĩ tổng quát.', 4.00, TRUE),
  ('doc-003', 'udoc-003', 'sp-tong-quat', 'LIC-THAT-0003', 9, 'Bác sĩ tổng quát.', 5.00, TRUE),
  ('doc-004', 'udoc-004', 'sp-tong-quat', 'LIC-THAT-0004', 8, 'Bác sĩ tổng quát.', 4.00, TRUE),
  ('doc-005', 'udoc-005', 'sp-tong-quat', 'LIC-THAT-0005', 13, 'Bác sĩ tổng quát.', 5.00, TRUE),
  ('doc-006', 'udoc-006', 'sp-nhi-khoa', 'LIC-THAT-0006', 8, 'Bác sĩ nhi khoa.', 4.00, TRUE),
  ('doc-007', 'udoc-007', 'sp-nhi-khoa', 'LIC-THAT-0007', 10, 'Bác sĩ nhi khoa.', 5.00, TRUE),
  ('doc-008', 'udoc-008', 'sp-nhi-khoa', 'LIC-THAT-0008', 7, 'Bác sĩ nhi khoa.', 4.00, TRUE),
  ('doc-009', 'udoc-009', 'sp-nhi-khoa', 'LIC-THAT-0009', 11, 'Bác sĩ nhi khoa.', 5.00, TRUE),
  ('doc-010', 'udoc-010', 'sp-nhi-khoa', 'LIC-THAT-0010', 9, 'Bác sĩ nhi khoa.', 4.00, TRUE),
  ('doc-011', 'udoc-011', 'sp-dinh-duong', 'LIC-THAT-0011', 12, 'Bác sĩ dinh dưỡng.', 5.00, TRUE),
  ('doc-012', 'udoc-012', 'sp-dinh-duong', 'LIC-THAT-0012', 9, 'Bác sĩ dinh dưỡng.', 4.00, TRUE),
  ('doc-013', 'udoc-013', 'sp-dinh-duong', 'LIC-THAT-0013', 11, 'Bác sĩ dinh dưỡng.', 5.00, TRUE),
  ('doc-014', 'udoc-014', 'sp-dinh-duong', 'LIC-THAT-0014', 8, 'Bác sĩ dinh dưỡng.', 4.00, TRUE),
  ('doc-015', 'udoc-015', 'sp-dinh-duong', 'LIC-THAT-0015', 10, 'Bác sĩ dinh dưỡng.', 5.00, TRUE),
  ('doc-016', 'udoc-016', 'sp-tim-mach', 'LIC-THAT-0016', 13, 'Bác sĩ tim mạch.', 5.00, TRUE),
  ('doc-017', 'udoc-017', 'sp-tim-mach', 'LIC-THAT-0017', 11, 'Bác sĩ tim mạch.', 4.00, TRUE),
  ('doc-018', 'udoc-018', 'sp-tim-mach', 'LIC-THAT-0018', 12, 'Bác sĩ tim mạch.', 5.00, TRUE),
  ('doc-019', 'udoc-019', 'sp-tim-mach', 'LIC-THAT-0019', 9, 'Bác sĩ tim mạch.', 4.00, TRUE),
  ('doc-020', 'udoc-020', 'sp-tim-mach', 'LIC-THAT-0020', 12, 'Bác sĩ tim mạch.', 5.00, TRUE),
  ('doc-021', 'udoc-021', 'sp-da-lieu', 'LIC-THAT-0021', 11, 'Bác sĩ da liễu.', 5.00, TRUE),
  ('doc-022', 'udoc-022', 'sp-da-lieu', 'LIC-THAT-0022', 8, 'Bác sĩ da liễu.', 4.00, TRUE),
  ('doc-023', 'udoc-023', 'sp-da-lieu', 'LIC-THAT-0023', 10, 'Bác sĩ da liễu.', 5.00, TRUE),
  ('doc-024', 'udoc-024', 'sp-da-lieu', 'LIC-THAT-0024', 9, 'Bác sĩ da liễu.', 4.00, TRUE),
  ('doc-025', 'udoc-025', 'sp-da-lieu', 'LIC-THAT-0025', 11, 'Bác sĩ da liễu.', 5.00, TRUE),
  ('doc-026', 'udoc-026', 'sp-chinh-hinh', 'LIC-THAT-0026', 14, 'Bác sĩ chỉnh hình.', 4.00, TRUE),
  ('doc-027', 'udoc-027', 'sp-chinh-hinh', 'LIC-THAT-0027', 12, 'Bác sĩ chỉnh hình.', 4.00, TRUE),
  ('doc-028', 'udoc-028', 'sp-chinh-hinh', 'LIC-THAT-0028', 10, 'Bác sĩ chỉnh hình.', 5.00, TRUE),
  ('doc-029', 'udoc-029', 'sp-chinh-hinh', 'LIC-THAT-0029', 9, 'Bác sĩ chỉnh hình.', 4.00, TRUE),
  ('doc-030', 'udoc-030', 'sp-chinh-hinh', 'LIC-THAT-0030', 12, 'Bác sĩ chỉnh hình.', 5.00, TRUE);

UPDATE doctors AS d
SET d.consultation_fee = ROUND((250000 + LEAST(GREATEST(COALESCE(d.rating, 0), 0), 5) * 150000) / 1000) * 1000
WHERE d.consultation_fee IS NULL OR d.consultation_fee <= 0 OR d.consultation_fee = 850000.00;

-- ===== SEED APPOINTMENTS FOR FEATURED LOGIC =====
INSERT IGNORE INTO appointments (
  id,
  patient_id,
  doctor_id,
  title,
  description,
  appointment_date,
  appointment_location,
  duration_minutes,
  status,
  notes
)
VALUES
  ('app-seed-001', 'uusr-001', 'doc-001', 'Lịch khám tổng quát', 'Khám sức khỏe định kỳ', '2026-06-15 09:00:00', 'Quận Hoàn Kiếm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-002', 'uusr-002', 'doc-001', 'Lịch khám tổng quát', 'Theo dõi huyết áp', '2026-06-16 10:00:00', 'Quận Hoàn Kiếm, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-003', 'uusr-003', 'doc-001', 'Lịch khám tổng quát', 'Tư vấn sức khỏe', '2026-06-17 14:00:00', 'Quận Ba Đình, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-004', 'uusr-004', 'doc-003', 'Lịch khám tổng quát', 'Khám triệu chứng ho', '2026-06-18 08:30:00', 'Quận Cầu Giấy, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-005', 'uusr-005', 'doc-007', 'Lịch khám nhi khoa', 'Khám sốt nhẹ cho bé', '2026-06-14 09:30:00', 'Quận Long Biên, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-006', 'uusr-006', 'doc-007', 'Lịch khám nhi khoa', 'Tái khám viêm họng', '2026-06-14 15:00:00', 'Quận Long Biên, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-007', 'uusr-007', 'doc-007', 'Lịch khám nhi khoa', 'Theo dõi tăng trưởng', '2026-06-15 10:30:00', 'Quận Hai Bà Trưng, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-008', 'uusr-008', 'doc-009', 'Lịch khám nhi khoa', 'Tư vấn dinh dưỡng trẻ', '2026-06-16 08:00:00', 'Quận Hai Bà Trưng, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-009', 'uusr-009', 'doc-011', 'Lịch khám dinh dưỡng', 'Xây dựng thực đơn', '2026-06-17 11:00:00', 'Quận Hà Đông, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-010', 'uusr-010', 'doc-011', 'Lịch khám dinh dưỡng', 'Theo dõi giảm cân', '2026-06-17 16:00:00', 'Quận Hà Đông, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-011', 'uusr-001', 'doc-013', 'Lịch khám dinh dưỡng', 'Tư vấn ăn uống lành mạnh', '2026-06-18 09:00:00', 'Quận Đống Đa, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-012', 'uusr-002', 'doc-016', 'Lịch khám tim mạch', 'Khám đau ngực', '2026-06-19 07:30:00', 'Quận Tây Hồ, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-013', 'uusr-003', 'doc-016', 'Lịch khám tim mạch', 'Theo dõi rối loạn nhịp tim', '2026-06-19 09:30:00', 'Quận Tây Hồ, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-014', 'uusr-004', 'doc-016', 'Lịch khám tim mạch', 'Kiểm tra huyết áp cao', '2026-06-20 13:00:00', 'Quận Thanh Xuân, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-015', 'uusr-005', 'doc-018', 'Lịch khám tim mạch', 'Tái khám tim mạch', '2026-06-20 15:00:00', 'Quận Thanh Xuân, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-016', 'uusr-006', 'doc-021', 'Lịch khám da liễu', 'Khám dị ứng da', '2026-06-21 08:00:00', 'Quận Nam Từ Liêm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-017', 'uusr-007', 'doc-021', 'Lịch khám da liễu', 'Điều trị mụn', '2026-06-21 10:00:00', 'Quận Nam Từ Liêm, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-018', 'uusr-008', 'doc-023', 'Lịch khám da liễu', 'Tái khám viêm da', '2026-06-22 14:30:00', 'Quận Bắc Từ Liêm, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-019', 'uusr-009', 'doc-028', 'Lịch khám chỉnh hình', 'Khám đau lưng', '2026-06-23 09:15:00', 'Quận Hoàng Mai, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-020', 'uusr-010', 'doc-028', 'Lịch khám chỉnh hình', 'Tái khám xương khớp', '2026-06-23 11:15:00', 'Quận Hoàng Mai, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-021', 'uusr-001', 'doc-030', 'Lịch khám chỉnh hình', 'Vật lý trị liệu', '2026-06-24 15:45:00', 'Quận Cầu Giấy, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-022', 'uusr-002', 'doc-001', 'Lịch khám tổng quát', 'Tái khám sau điều trị', '2026-06-25 08:30:00', 'Quận Hoàn Kiếm, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-023', 'uusr-003', 'doc-001', 'Lịch khám tổng quát', 'Tư vấn huyết áp', '2026-06-25 10:30:00', 'Quận Hoàn Kiếm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-024', 'uusr-004', 'doc-001', 'Lịch khám tổng quát', 'Khám tiền sử bệnh', '2026-06-25 14:30:00', 'Quận Ba Đình, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-025', 'uusr-005', 'doc-007', 'Lịch khám nhi khoa', 'Khám ho kéo dài', '2026-06-26 09:00:00', 'Quận Long Biên, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-026', 'uusr-006', 'doc-007', 'Lịch khám nhi khoa', 'Theo dõi miễn dịch', '2026-06-26 11:00:00', 'Quận Long Biên, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-027', 'uusr-007', 'doc-007', 'Lịch khám nhi khoa', 'Tư vấn dinh dưỡng trẻ', '2026-06-26 15:00:00', 'Quận Hai Bà Trưng, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-028', 'uusr-008', 'doc-016', 'Lịch khám tim mạch', 'Tái khám sau can thiệp', '2026-06-27 08:30:00', 'Quận Tây Hồ, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-029', 'uusr-009', 'doc-016', 'Lịch khám tim mạch', 'Đo điện tim', '2026-06-27 10:30:00', 'Quận Tây Hồ, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-030', 'uusr-010', 'doc-016', 'Lịch khám tim mạch', 'Theo dõi nhịp tim', '2026-06-27 14:00:00', 'Quận Thanh Xuân, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-031', 'uusr-001', 'doc-002', 'Lịch khám tổng quát', 'Khám tiền phẫu', '2026-06-28 09:00:00', 'Quận Hoàn Kiếm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-032', 'uusr-002', 'doc-004', 'Lịch khám tổng quát', 'Theo dõi bệnh mãn tính', '2026-06-28 10:30:00', 'Quận Ba Đình, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-033', 'uusr-003', 'doc-005', 'Lịch khám tổng quát', 'Khám sức khỏe gia đình', '2026-06-28 14:00:00', 'Quận Cầu Giấy, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-034', 'uusr-004', 'doc-006', 'Lịch khám nhi khoa', 'Khám thường kỳ trẻ', '2026-06-29 08:30:00', 'Quận Long Biên, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-035', 'uusr-005', 'doc-008', 'Lịch khám nhi khoa', 'Tái khám sau bệnh', '2026-06-29 11:00:00', 'Quận Hai Bà Trưng, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-036', 'uusr-006', 'doc-010', 'Lịch khám nhi khoa', 'Khám phát triển', '2026-06-29 15:30:00', 'Quận Hoàng Mai, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-037', 'uusr-007', 'doc-012', 'Lịch khám dinh dưỡng', 'Tư vấn cân bằng dinh dưỡng', '2026-06-30 09:00:00', 'Quận Hà Đông, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-038', 'uusr-008', 'doc-014', 'Lịch khám dinh dưỡng', 'Xây dựng kế hoạch ăn', '2026-06-30 11:00:00', 'Quận Đống Đa, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-039', 'uusr-009', 'doc-015', 'Lịch khám dinh dưỡng', 'Theo dõi bệnh tiểu đường', '2026-06-30 14:00:00', 'Quận Nam Từ Liêm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-040', 'uusr-010', 'doc-017', 'Lịch khám tim mạch', 'Kiểm tra sốc tim', '2026-07-01 08:00:00', 'Quận Tây Hồ, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-041', 'uusr-001', 'doc-019', 'Lịch khám tim mạch', 'Khám bệnh tim bẩm sinh', '2026-07-01 10:00:00', 'Quận Thanh Xuân, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-042', 'uusr-002', 'doc-020', 'Lịch khám tim mạch', 'Tái khám điều trị tim', '2026-07-01 13:00:00', 'Quận Ba Đình, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-043', 'uusr-003', 'doc-022', 'Lịch khám da liễu', 'Khám sẹo da', '2026-07-02 09:00:00', 'Quận Nam Từ Liêm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-044', 'uusr-004', 'doc-024', 'Lịch khám da liễu', 'Điều trị nếp nhăn', '2026-07-02 11:00:00', 'Quận Bắc Từ Liêm, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-045', 'uusr-005', 'doc-025', 'Lịch khám da liễu', 'Khám bệnh vảy nến', '2026-07-02 14:00:00', 'Quận Hoàng Mai, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-046', 'uusr-006', 'doc-026', 'Lịch khám chỉnh hình', 'Khám thoái hóa khớp', '2026-07-03 08:30:00', 'Quận Cầu Giấy, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-047', 'uusr-007', 'doc-027', 'Lịch khám chỉnh hình', 'Khám gãy xương', '2026-07-03 10:00:00', 'Quận Long Biên, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-048', 'uusr-008', 'doc-029', 'Lịch khám chỉnh hình', 'Vật lý trị liệu nâng cao', '2026-07-03 15:00:00', 'Quận Hai Bà Trưng, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-049', 'uusr-009', 'doc-001', 'Lịch khám tổng quát', 'Khám gây mê', '2026-07-04 09:00:00', 'Quận Hoàn Kiếm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-050', 'uusr-010', 'doc-003', 'Lịch khám tổng quát', 'Khám huyết học', '2026-07-04 11:00:00', 'Quận Ba Đình, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-051', 'uusr-001', 'doc-007', 'Lịch khám nhi khoa', 'Tư vấn cá nhân hóa', '2026-07-04 14:00:00', 'Quận Long Biên, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-052', 'uusr-002', 'doc-009', 'Lịch khám nhi khoa', 'Khám phát triển tâm thần', '2026-07-05 08:00:00', 'Quận Hai Bà Trưng, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-053', 'uusr-003', 'doc-011', 'Lịch khám dinh dưỡng', 'Khám dị ứng thực phẩm', '2026-07-05 10:00:00', 'Quận Hà Đông, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-054', 'uusr-004', 'doc-013', 'Lịch khám dinh dưỡng', 'Tư vấn ăn kiêng', '2026-07-05 13:00:00', 'Quận Đống Đa, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-055', 'uusr-005', 'doc-016', 'Lịch khám tim mạch', 'Khám suy tim', '2026-07-06 09:00:00', 'Quận Tây Hồ, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-056', 'uusr-006', 'doc-018', 'Lịch khám tim mạch', 'Khám cao huyết áp', '2026-07-06 11:00:00', 'Quận Thanh Xuân, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-057', 'uusr-007', 'doc-021', 'Lịch khám da liễu', 'Khám mẩn đỏ', '2026-07-06 14:00:00', 'Quận Nam Từ Liêm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-058', 'uusr-008', 'doc-023', 'Lịch khám da liễu', 'Khám lão hóa da', '2026-07-07 08:30:00', 'Quận Bắc Từ Liêm, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-059', 'uusr-009', 'doc-028', 'Lịch khám chỉnh hình', 'Khám cơ lưng yếu', '2026-07-07 10:00:00', 'Quận Hoàng Mai, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-060', 'uusr-010', 'doc-030', 'Lịch khám chỉnh hình', 'Khám cứng cột sống', '2026-07-07 15:00:00', 'Quận Cầu Giấy, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-061', 'uusr-001', 'doc-002', 'Lịch khám tổng quát', 'Khám xét nghiệm máu', '2026-07-08 09:00:00', 'Quận Hoàn Kiếm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-062', 'uusr-002', 'doc-004', 'Lịch khám tổng quát', 'Khám nha khoa', '2026-07-08 11:00:00', 'Quận Ba Đình, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-063', 'uusr-003', 'doc-005', 'Lịch khám tổng quát', 'Khám mắt', '2026-07-08 14:00:00', 'Quận Cầu Giấy, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-064', 'uusr-004', 'doc-006', 'Lịch khám nhi khoa', 'Khám tai mũi họng', '2026-07-09 08:30:00', 'Quận Long Biên, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-065', 'uusr-005', 'doc-008', 'Lịch khám nhi khoa', 'Khám tiêu hóa', '2026-07-09 11:00:00', 'Quận Hai Bà Trưng, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-066', 'uusr-006', 'doc-010', 'Lịch khám nhi khoa', 'Khám hô hấp', '2026-07-09 14:00:00', 'Quận Hoàng Mai, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-067', 'uusr-007', 'doc-012', 'Lịch khám dinh dưỡng', 'Khám thể chất định kỳ', '2026-07-10 09:00:00', 'Quận Hà Đông, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-068', 'uusr-008', 'doc-014', 'Lịch khám dinh dưỡng', 'Khám tuổi thọ', '2026-07-10 11:00:00', 'Quận Đống Đa, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-069', 'uusr-009', 'doc-015', 'Lịch khám dinh dưỡng', 'Khám sức khỏe tâm thần', '2026-07-10 14:00:00', 'Quận Nam Từ Liêm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-070', 'uusr-010', 'doc-017', 'Lịch khám tim mạch', 'Khám mạch máu', '2026-07-11 08:00:00', 'Quận Tây Hồ, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-071', 'uusr-001', 'doc-019', 'Lịch khám tim mạch', 'Khám cơ tim', '2026-07-11 10:00:00', 'Quận Thanh Xuân, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-072', 'uusr-002', 'doc-020', 'Lịch khám tim mạch', 'Khám bệnh lý tim', '2026-07-11 13:00:00', 'Quận Ba Đình, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-073', 'uusr-003', 'doc-022', 'Lịch khám da liễu', 'Khám viêm da tiếp xúc', '2026-07-12 09:00:00', 'Quận Nam Từ Liêm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-074', 'uusr-004', 'doc-024', 'Lịch khám da liễu', 'Khám ung thư da', '2026-07-12 11:00:00', 'Quận Bắc Từ Liêm, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-075', 'uusr-005', 'doc-025', 'Lịch khám da liễu', 'Khám sân bay', '2026-07-12 14:00:00', 'Quận Hoàng Mai, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-076', 'uusr-006', 'doc-026', 'Lịch khám chỉnh hình', 'Khám khúc xạ cột sống', '2026-07-13 08:30:00', 'Quận Cầu Giấy, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-077', 'uusr-007', 'doc-027', 'Lịch khám chỉnh hình', 'Khám đau vai gáy', '2026-07-13 10:00:00', 'Quận Long Biên, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-078', 'uusr-008', 'doc-029', 'Lịch khám chỉnh hình', 'Khám cứng khớp', '2026-07-13 15:00:00', 'Quận Hai Bà Trưng, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-079', 'uusr-009', 'doc-001', 'Lịch khám tổng quát', 'Khám quán tính', '2026-07-14 09:00:00', 'Quận Hoàn Kiếm, Hà Nội', 30, 'đã_xác_nhận', NULL),
  ('app-seed-080', 'uusr-010', 'doc-003', 'Lịch khám tổng quát', 'Khám phòng ngừa', '2026-07-14 11:00:00', 'Quận Ba Đình, Hà Nội', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-081', 'uusr-011', 'doc-001', 'Khám tổng quát', 'Khám định kỳ', '2026-07-15 08:00:00', 'Quận Hoàn Kiếm', 30, 'đã_xác_nhận', NULL),
  ('app-seed-082', 'uusr-012', 'doc-001', 'Khám tổng quát', 'Tư vấn sức khỏe', '2026-07-15 10:00:00', 'Quận Ba Đình', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-083', 'uusr-013', 'doc-002', 'Khám tổng quát', 'Khám tiêu hóa', '2026-07-15 14:00:00', 'Quận Cầu Giấy', 30, 'đã_xác_nhận', NULL),
  ('app-seed-084', 'uusr-014', 'doc-003', 'Khám tổng quát', 'Khám phổi', '2026-07-16 08:30:00', 'Quận Đống Đa', 30, 'đã_huỷ', NULL),
  ('app-seed-085', 'uusr-015', 'doc-004', 'Khám tổng quát', 'Khám mắt', '2026-07-16 10:00:00', 'Quận Thanh Xuân', 30, 'đã_xác_nhận', NULL),
  ('app-seed-086', 'uusr-016', 'doc-005', 'Khám tổng quát', 'Khám tai', '2026-07-16 14:00:00', 'Quận Tây Hồ', 30, 'chưa_thanh_toán', NULL),
  ('app-seed-087', 'uusr-017', 'doc-006', 'Khám nhi khoa', 'Khám trẻ sơ sinh', '2026-07-17 08:00:00', 'Quận Long Biên', 30, 'đã_xác_nhận', NULL),
  ('app-seed-088', 'uusr-018', 'doc-007', 'Khám nhi khoa', 'Tiêm chủng', '2026-07-17 10:00:00', 'Quận Hai Bà Trưng', 30, 'đã_xác_nhận', NULL),
  ('app-seed-089', 'uusr-019', 'doc-008', 'Khám nhi khoa', 'Khám ho', '2026-07-17 14:00:00', 'Quận Hoàng Mai', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-090', 'uusr-020', 'doc-009', 'Khám nhi khoa', 'Khám sốt', '2026-07-18 08:30:00', 'Quận Hà Đông', 30, 'đã_huỷ', NULL),
  ('app-seed-091', 'uusr-021', 'doc-010', 'Khám nhi khoa', 'Khám dị ứng', '2026-07-18 10:00:00', 'Quận Nam Từ Liêm', 30, 'đã_xác_nhận', NULL),
  ('app-seed-092', 'uusr-022', 'doc-011', 'Khám dinh dưỡng', 'Tư vấn ăn uống', '2026-07-18 14:00:00', 'Quận Bắc Từ Liêm', 30, 'chưa_thanh_toán', NULL),
  ('app-seed-093', 'uusr-023', 'doc-012', 'Khám dinh dưỡng', 'Giảm cân', '2026-07-19 08:00:00', 'Quận Đống Đa', 30, 'đã_xác_nhận', NULL),
  ('app-seed-094', 'uusr-024', 'doc-013', 'Khám dinh dưỡng', 'Tăng cân', '2026-07-19 10:00:00', 'Quận Thanh Xuân', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-095', 'uusr-025', 'doc-014', 'Khám dinh dưỡng', 'Dinh dưỡng thai kỳ', '2026-07-19 14:00:00', 'Quận Tây Hồ', 30, 'đã_xác_nhận', NULL),
  ('app-seed-096', 'uusr-026', 'doc-015', 'Khám dinh dưỡng', 'Tư vấn vitamin', '2026-07-20 08:30:00', 'Quận Cầu Giấy', 30, 'đã_huỷ', NULL),
  ('app-seed-097', 'uusr-027', 'doc-016', 'Khám tim mạch', 'Đo huyết áp', '2026-07-20 10:00:00', 'Quận Hoàn Kiếm', 30, 'đã_xác_nhận', NULL),
  ('app-seed-098', 'uusr-028', 'doc-017', 'Khám tim mạch', 'Siêu âm tim', '2026-07-20 14:00:00', 'Quận Ba Đình', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-099', 'uusr-029', 'doc-018', 'Khám tim mạch', 'Khám van tim', '2026-07-21 08:00:00', 'Quận Long Biên', 30, 'đã_xác_nhận', NULL),
  ('app-seed-100', 'uusr-030', 'doc-019', 'Khám tim mạch', 'Điện tâm đồ', '2026-07-21 10:00:00', 'Quận Hai Bà Trưng', 30, 'chưa_thanh_toán', NULL),
  ('app-seed-101', 'uusr-011', 'doc-020', 'Khám tim mạch', 'Khám mạch máu', '2026-07-21 14:00:00', 'Quận Hoàng Mai', 30, 'đã_xác_nhận', NULL),
  ('app-seed-102', 'uusr-012', 'doc-021', 'Khám da liễu', 'Khám mụn', '2026-07-22 08:30:00', 'Quận Hà Đông', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-103', 'uusr-013', 'doc-022', 'Khám da liễu', 'Khám nám da', '2026-07-22 10:00:00', 'Quận Nam Từ Liêm', 30, 'đã_xác_nhận', NULL),
  ('app-seed-104', 'uusr-014', 'doc-023', 'Khám da liễu', 'Điều trị sẹo', '2026-07-22 14:00:00', 'Quận Bắc Từ Liêm', 30, 'đã_huỷ', NULL),
  ('app-seed-105', 'uusr-015', 'doc-024', 'Khám da liễu', 'Khám dị ứng da', '2026-07-23 08:00:00', 'Quận Đống Đa', 30, 'đã_xác_nhận', NULL),
  ('app-seed-106', 'uusr-016', 'doc-025', 'Khám da liễu', 'Khám vảy nến', '2026-07-23 10:00:00', 'Quận Thanh Xuân', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-107', 'uusr-017', 'doc-026', 'Khám chỉnh hình', 'Khám cột sống', '2026-07-23 14:00:00', 'Quận Tây Hồ', 30, 'đã_xác_nhận', NULL),
  ('app-seed-108', 'uusr-018', 'doc-027', 'Khám chỉnh hình', 'Khám đau khớp', '2026-07-24 08:30:00', 'Quận Cầu Giấy', 30, 'chưa_thanh_toán', NULL),
  ('app-seed-109', 'uusr-019', 'doc-028', 'Khám chỉnh hình', 'Vật lý trị liệu', '2026-07-24 10:00:00', 'Quận Hoàn Kiếm', 30, 'đã_xác_nhận', NULL),
  ('app-seed-110', 'uusr-020', 'doc-029', 'Khám chỉnh hình', 'Khám gối', '2026-07-24 14:00:00', 'Quận Ba Đình', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-111', 'uusr-021', 'doc-030', 'Khám chỉnh hình', 'Khám vai', '2026-07-25 08:00:00', 'Quận Long Biên', 30, 'đã_xác_nhận', NULL),
  ('app-seed-112', 'uusr-022', 'doc-001', 'Khám tổng quát', 'Khám máu', '2026-07-25 10:00:00', 'Quận Hai Bà Trưng', 30, 'đã_huỷ', NULL),
  ('app-seed-113', 'uusr-023', 'doc-007', 'Khám nhi khoa', 'Khám da bé', '2026-07-25 14:00:00', 'Quận Hoàng Mai', 30, 'đã_xác_nhận', NULL),
  ('app-seed-114', 'uusr-024', 'doc-011', 'Khám dinh dưỡng', 'Béo phì', '2026-07-26 08:30:00', 'Quận Hà Đông', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-115', 'uusr-025', 'doc-016', 'Khám tim mạch', 'Khám rối loạn nhịp', '2026-07-26 10:00:00', 'Quận Nam Từ Liêm', 30, 'đã_xác_nhận', NULL),
  ('app-seed-116', 'uusr-026', 'doc-021', 'Khám da liễu', 'Khám tàn nhang', '2026-07-26 14:00:00', 'Quận Bắc Từ Liêm', 30, 'chưa_thanh_toán', NULL),
  ('app-seed-117', 'uusr-027', 'doc-028', 'Khám chỉnh hình', 'Khám cổ tay', '2026-07-27 08:00:00', 'Quận Đống Đa', 30, 'đã_xác_nhận', NULL),
  ('app-seed-118', 'uusr-028', 'doc-001', 'Khám tổng quát', 'Khám tổng quát', '2026-07-27 10:00:00', 'Quận Thanh Xuân', 30, 'chờ_xác_nhận', NULL),
  ('app-seed-119', 'uusr-029', 'doc-016', 'Khám tim mạch', 'Khám hở van', '2026-07-27 14:00:00', 'Quận Tây Hồ', 30, 'đã_xác_nhận', NULL),
  ('app-seed-120', 'uusr-030', 'doc-007', 'Khám nhi khoa', 'Khám viêm phổi bé', '2026-07-28 08:30:00', 'Quận Cầu Giấy', 30, 'đã_huỷ', NULL);

INSERT IGNORE INTO payments (
  id,
  appointment_id,
  amount,
  currency,
  payment_method,
  payment_status,
  transaction_id,
  paid_at
)
SELECT
  CONCAT('pay-seed-', RIGHT(a.id, 3)) AS id,
  a.id AS appointment_id,
  COALESCE(d.consultation_fee, 850000.00) AS amount,
  'VND' AS currency,
  'bank_transfer' AS payment_method,
  'completed' AS payment_status,
  CONCAT('SEEDTXN-', RIGHT(a.id, 3)) AS transaction_id,
  NOW() AS paid_at
FROM appointments a
INNER JOIN doctors d ON d.id = a.doctor_id
WHERE a.id LIKE 'app-seed-%'
  AND a.status IN ('chờ_xác_nhận', 'đã_xác_nhận', 'đã_huỷ');
