(function () {
  const KEYS = {
    profile: 'thatClinicUserProfile',
    draft: 'thatClinicAppointmentDraft',
    pending: 'thatClinicPendingRequests',
    confirmed: 'thatClinicConfirmedAppointments',
    refunds: 'thatClinicRefundNotices',
    seeded: 'thatClinicSeededRequests',
    seedVersion: 'thatClinicSeedVersion'
  };

  const DEMO_SEED_VERSION = '2026-03-05-v3';

  const defaultProfile = {
    fullName: 'Nguyễn Văn A',
    phone: '+84 234 567 8910',
    bankName: 'Vietcombank',
    bankAccount: '0123456789'
  };

  const specialtyMap = {
    'tong-quat': 'Tổng quát',
    'tim-mach': 'Tim mạch',
    'than-kinh': 'Thần kinh',
    'nhi': 'Nhi khoa'
  };

  const safeParse = (value, fallback) => {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  };

  const getArray = (key) => safeParse(localStorage.getItem(key), []);
  const setArray = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const getProfile = () => {
    const stored = safeParse(localStorage.getItem(KEYS.profile), null);
    return { ...defaultProfile, ...(stored || {}) };
  };

  const formatCurrency = (amount) =>
    `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;

  const formatDateFromInput = (dateInput) => {
    if (!dateInput) {
      return '12/03/2026';
    }

    const [year, month, day] = dateInput.split('-');
    return `${day}/${month}/${year}`;
  };

  const toDateLabel = (value) => {
    const [day, month, year] = value.split('/');
    return `${day} Thg ${month}, ${year}`;
  };

  const seedInitialPendingRequests = () => {
    const storedVersion = localStorage.getItem(KEYS.seedVersion);
    const needsRefresh = storedVersion !== DEMO_SEED_VERSION;

    if (needsRefresh) {
      localStorage.removeItem(KEYS.pending);
      localStorage.removeItem(KEYS.confirmed);
      localStorage.removeItem(KEYS.refunds);
      localStorage.removeItem(KEYS.draft);
      localStorage.removeItem(KEYS.seeded);
    }

    const alreadySeeded = localStorage.getItem(KEYS.seeded) === 'true';
    const pending = getArray(KEYS.pending);

    if (alreadySeeded || pending.length > 0) {
      if (needsRefresh) {
        localStorage.setItem(KEYS.seedVersion, DEMO_SEED_VERSION);
      }
      return;
    }

    const profile = getProfile();
    const baseRequests = [
      {
        title: 'Khám tổng quát tại nhà',
        doctorName: 'BS. Nguyễn Minh Anh',
        specialty: 'Tổng quát',
        location: 'Q. Thanh Xuân, Hà Nội',
        date: '12/03/2026',
        timeRange: '09:00 - 09:30',
        amount: 850000,
        desc: 'Khám sức khỏe định kỳ, kiểm tra huyết áp và tư vấn chế độ sinh hoạt.'
      },
      {
        title: 'Tư vấn dinh dưỡng',
        doctorName: 'BS. Lê Thanh Hà',
        specialty: 'Dinh dưỡng',
        location: 'Q. Cầu Giấy, Hà Nội',
        date: '13/03/2026',
        timeRange: '14:00 - 14:30',
        amount: 750000,
        desc: 'Tư vấn thực đơn cá nhân hóa và theo dõi chỉ số cơ thể tại nhà.'
      },
      {
        title: 'Khám tim mạch',
        doctorName: 'BS. Trần Đức Minh',
        specialty: 'Tim mạch',
        location: 'Q. Hai Bà Trưng, Hà Nội',
        date: '14/03/2026',
        timeRange: '16:00 - 16:30',
        amount: 950000,
        desc: 'Theo dõi nhịp tim, đánh giá triệu chứng hồi hộp và tư vấn điều trị.'
      }
    ];

    const baseConfirmed = [
      {
        title: 'Khám tổng quát sau điều trị',
        doctorName: 'BS. Nguyễn Minh Anh',
        specialty: 'Tổng quát',
        location: 'Q. Đống Đa, Hà Nội',
        date: '15/03/2026',
        timeRange: '08:30 - 09:00',
        amount: 850000,
        desc: 'Tái khám tổng quát và rà soát đơn thuốc hiện tại.'
      },
      {
        title: 'Theo dõi tim mạch định kỳ',
        doctorName: 'BS. Trần Đức Minh',
        specialty: 'Tim mạch',
        location: 'Q. Long Biên, Hà Nội',
        date: '16/03/2026',
        timeRange: '10:00 - 10:30',
        amount: 950000,
        desc: 'Kiểm tra huyết áp, nhịp tim và tư vấn sinh hoạt phù hợp.'
      },
      {
        title: 'Tư vấn dinh dưỡng cho người lớn tuổi',
        doctorName: 'BS. Lê Thanh Hà',
        specialty: 'Dinh dưỡng',
        location: 'Q. Tây Hồ, Hà Nội',
        date: '16/03/2026',
        timeRange: '14:00 - 14:30',
        amount: 780000,
        desc: 'Tư vấn chế độ ăn kiểm soát đường huyết tại nhà.'
      },
      {
        title: 'Khám nhi tái phát ho kéo dài',
        doctorName: 'BS. Đặng Tuấn Kiệt',
        specialty: 'Nhi khoa',
        location: 'Q. Cầu Giấy, Hà Nội',
        date: '17/03/2026',
        timeRange: '09:30 - 10:00',
        amount: 800000,
        desc: 'Khám lại triệu chứng ho kéo dài cho bé và điều chỉnh thuốc.'
      },
      {
        title: 'Khám da liễu theo liệu trình',
        doctorName: 'BS. Vũ Thị Yến',
        specialty: 'Da liễu',
        location: 'Q. Ba Đình, Hà Nội',
        date: '17/03/2026',
        timeRange: '15:00 - 15:30',
        amount: 820000,
        desc: 'Đánh giá đáp ứng da và điều chỉnh liệu trình chăm sóc.'
      },
      {
        title: 'Khám cơ xương khớp sau chấn thương',
        doctorName: 'BS. Hoàng Minh Tuấn',
        specialty: 'Chỉnh hình',
        location: 'Q. Hà Đông, Hà Nội',
        date: '18/03/2026',
        timeRange: '13:30 - 14:00',
        amount: 900000,
        desc: 'Đánh giá vận động sau chấn thương và hướng dẫn phục hồi.'
      }
    ];

    const seededRequests = baseRequests.map((item, index) => ({
      id: `seed-${Date.now()}-${index}`,
      ...item,
      status: 'Đang chờ bác sĩ xác nhận',
      userName: profile.fullName,
      userPhone: profile.phone,
      transferBankName: profile.bankName,
      transferBankAccount: profile.bankAccount
    }));

    const seededConfirmed = baseConfirmed.map((item, index) => ({
      id: `seed-confirmed-${Date.now()}-${index}`,
      ...item,
      status: 'Đã xác nhận',
      userName: profile.fullName,
      userPhone: profile.phone,
      transferBankName: profile.bankName,
      transferBankAccount: profile.bankAccount
    }));

    setArray(KEYS.pending, seededRequests);
    setArray(KEYS.confirmed, seededConfirmed);
    localStorage.setItem(KEYS.seeded, 'true');
    localStorage.setItem(KEYS.seedVersion, DEMO_SEED_VERSION);
  };

  const setupSettingsPage = () => {
    const fullnameInput = document.getElementById('fullname');
    const phoneInput = document.getElementById('phone');
    const bankNameInput = document.getElementById('bank-name');
    const bankAccountInput = document.getElementById('bank-account');
    const saveButton = document.querySelector('.btn-save');

    if (!fullnameInput || !phoneInput || !bankNameInput || !bankAccountInput || !saveButton) {
      return;
    }

    const profile = getProfile();
    fullnameInput.value = profile.fullName;
    phoneInput.value = profile.phone;
    bankNameInput.value = profile.bankName;
    bankAccountInput.value = profile.bankAccount;

    saveButton.addEventListener('click', () => {
      const updatedProfile = {
        fullName: fullnameInput.value.trim() || defaultProfile.fullName,
        phone: phoneInput.value.trim() || defaultProfile.phone,
        bankName: bankNameInput.value.trim() || defaultProfile.bankName,
        bankAccount: bankAccountInput.value.trim() || defaultProfile.bankAccount
      };

      localStorage.setItem(KEYS.profile, JSON.stringify(updatedProfile));
      alert('Đã lưu thông tin hồ sơ và tài khoản hoàn tiền.');
    });
  };

  const setupCreateAppointmentPage = () => {
    const submitButton = document.querySelector('.create-submit-btn');
    if (!submitButton) {
      return;
    }

    submitButton.addEventListener('click', () => {
      const doctor = document.getElementById('doctor')?.value.trim() || 'BS. Nguyễn Hữu Trí';
      const specialtyValue = document.getElementById('specialty')?.value || 'tong-quat';
      const specialty = specialtyMap[specialtyValue] || 'Tổng quát';
      const location = document.getElementById('location')?.value.trim() || 'Khám tại nhà';
      const dateValue = document.getElementById('date')?.value || '2026-03-12';
      const fromTime = document.getElementById('from-time')?.value || '13:00';
      const toTime = document.getElementById('to-time')?.value || '13:15';

      const draft = {
        title: `Khám ${specialty.toLowerCase()}`,
        doctorName: doctor,
        specialty,
        location,
        date: formatDateFromInput(dateValue),
        timeRange: `${fromTime} - ${toTime}`,
        amount: 850000,
        desc: `Lịch khám ${specialty.toLowerCase()} tại ${location}.`
      };

      localStorage.setItem(KEYS.draft, JSON.stringify(draft));
    });
  };

  const setupCheckoutPage = () => {
    const paidButton = document.querySelector('.paid-btn');
    if (!paidButton) {
      return;
    }

    const draft = safeParse(localStorage.getItem(KEYS.draft), null);
    if (draft) {
      const invoiceRows = document.querySelectorAll('.invoice-table tbody tr td:first-child');
      if (invoiceRows[0]) {
        invoiceRows[0].textContent = `Tên bác sĩ: ${draft.doctorName}`;
      }
      if (invoiceRows[1]) {
        invoiceRows[1].textContent = `Chuyên khoa: ${draft.specialty}`;
      }
    }

    paidButton.addEventListener('click', () => {
      const profile = getProfile();
      const finalDraft = safeParse(localStorage.getItem(KEYS.draft), null) || {
        title: 'Khám tổng quát',
        doctorName: 'BS. Nguyễn Hữu Trí',
        specialty: 'Tổng quát',
        location: 'Khám tại nhà',
        date: '12/03/2026',
        timeRange: '13:00 - 13:15',
        amount: 850000,
        desc: 'Lịch khám được tạo từ trang thanh toán.'
      };

      const pending = getArray(KEYS.pending);
      const newRequest = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...finalDraft,
        status: 'Đang chờ bác sĩ xác nhận',
        userName: profile.fullName,
        userPhone: profile.phone,
        transferBankName: profile.bankName,
        transferBankAccount: profile.bankAccount
      };

      setArray(KEYS.pending, [newRequest, ...pending]);
      alert('Đã ghi nhận thanh toán. Lịch hẹn đang chờ bác sĩ xác nhận.');
      window.location.href = './my-appointments.html';
    });
  };

  const buildDoctorRequestCard = (item) => {
    return `
      <article class="request-item" data-id="${item.id}">
        <div class="request-card">
          <div class="request-head">
            <h2>${item.title}</h2>
            <span class="request-time">${item.timeRange}</span>
          </div>
          <p class="request-status">${item.status}</p>
          <p class="request-date">${toDateLabel(item.date)}</p>
          <p class="request-desc">${item.desc}</p>

          <div class="request-footer">
            <div class="doctor-summary">
              <span class="doctor-avatar" aria-hidden="true"></span>
              <div class="doctor-meta">
                <strong>${item.userName}</strong>
                <span>${item.specialty}</span>
              </div>
            </div>
            <span class="location">${item.location}</span>
          </div>
        </div>

        <div class="request-actions">
          <button type="button" class="btn-action btn-accept">Chấp nhận</button>
          <button type="button" class="btn-action btn-cancel">Từ chối</button>
        </div>
      </article>
    `;
  };

  const setupDoctorRequestsPage = () => {
    const requestList = document.querySelector('.requests-list');
    const requestsContent = document.querySelector('.requests-content');
    if (!requestList) {
      return;
    }

    const showRefundBanner = (selected) => {
      if (!requestsContent) {
        return;
      }

      const oldBanner = requestsContent.querySelector('.refund-banner');
      if (oldBanner) {
        oldBanner.remove();
      }

      const banner = document.createElement('div');
      banner.className = 'refund-banner';
      banner.innerHTML = `
        <strong>Thông báo hoàn khoản</strong>
        <p>Bệnh nhân: <b>${selected.userName}</b></p>
        <p>Ngân hàng: <b>${selected.transferBankName}</b></p>
        <p>Số tài khoản: <b>${selected.transferBankAccount}</b></p>
        <p>Số tiền đã chuyển: <b>${formatCurrency(selected.amount)}</b></p>
      `;

      requestsContent.prepend(banner);
    };

    const render = () => {
      const pending = getArray(KEYS.pending);

      if (pending.length === 0) {
        requestList.innerHTML = '<p class="empty-state">Hiện chưa có lịch hẹn đề xuất mới.</p>';
        return;
      }

      requestList.innerHTML = pending.map(buildDoctorRequestCard).join('');

      requestList.querySelectorAll('.request-item').forEach((itemNode) => {
        const id = itemNode.getAttribute('data-id');
        const acceptBtn = itemNode.querySelector('.btn-accept');
        const rejectBtn = itemNode.querySelector('.btn-cancel');

        acceptBtn?.addEventListener('click', () => {
          const currentPending = getArray(KEYS.pending);
          const selected = currentPending.find((entry) => entry.id === id);
          if (!selected) {
            return;
          }

          const remaining = currentPending.filter((entry) => entry.id !== id);
          setArray(KEYS.pending, remaining);

          const confirmed = getArray(KEYS.confirmed);
          confirmed.unshift({ ...selected, status: 'Đã xác nhận' });
          setArray(KEYS.confirmed, confirmed);

          alert('Đã chấp nhận lịch hẹn. Lịch đã chuyển sang danh sách lịch hẹn.');
          render();
        });

        rejectBtn?.addEventListener('click', () => {
          const currentPending = getArray(KEYS.pending);
          const selected = currentPending.find((entry) => entry.id === id);
          if (!selected) {
            return;
          }

          const remaining = currentPending.filter((entry) => entry.id !== id);
          setArray(KEYS.pending, remaining);

          const refunds = getArray(KEYS.refunds);
          refunds.unshift({
            id: selected.id,
            title: selected.title,
            doctorName: selected.doctorName,
            specialty: selected.specialty,
            date: selected.date,
            location: selected.location,
            desc: selected.desc,
            amount: selected.amount,
            bankName: selected.transferBankName,
            bankAccount: selected.transferBankAccount,
            userName: selected.userName,
            createdAt: Date.now()
          });
          setArray(KEYS.refunds, refunds);

          alert(
            `ĐÃ TỪ CHỐI LỊCH HẸN\nVui lòng hoàn khoản cho bệnh nhân:\n` +
              `- Tên: ${selected.userName}\n` +
              `- Ngân hàng: ${selected.transferBankName}\n` +
              `- Số tài khoản: ${selected.transferBankAccount}\n` +
              `- Số tiền đã chuyển: ${formatCurrency(selected.amount)}`
          );

          showRefundBanner(selected);
          render();
        });
      });
    };

    render();
  };

  const buildDoctorAppointmentCard = (item) => `
    <article class="request-item" data-id="${item.id}">
      <div class="request-card">
        <div class="request-head">
          <h2>${item.title}</h2>
          <span class="request-time">${item.timeRange}</span>
        </div>
        <p class="request-status">${item.status}</p>
        <p class="request-date">${toDateLabel(item.date)}</p>
        <p class="request-desc">${item.desc}</p>

        <div class="request-footer">
          <div class="doctor-summary">
            <span class="doctor-avatar" aria-hidden="true"></span>
            <div class="doctor-meta">
              <strong>${item.userName}</strong>
              <span>${item.specialty}</span>
            </div>
          </div>
          <span class="location">${item.location}</span>
        </div>
      </div>

      <div class="request-actions">
        <button type="button" class="btn-action btn-accept">Hoàn thành</button>
        <button type="button" class="btn-action btn-cancel">Từ chối</button>
      </div>
    </article>
  `;

  const setupDoctorAppointmentsPage = () => {
    const requestList = document.querySelector('.requests-list');
    const requestsContent = document.querySelector('.requests-content');
    const isDoctorAppointments = window.location.pathname.includes('/doctor/my-appointments.html');
    if (!requestList || !isDoctorAppointments) {
      return;
    }

    const showRefundBanner = (selected) => {
      if (!requestsContent) {
        return;
      }

      const oldBanner = requestsContent.querySelector('.refund-banner');
      if (oldBanner) {
        oldBanner.remove();
      }

      const banner = document.createElement('div');
      banner.className = 'refund-banner';
      banner.innerHTML = `
        <strong>Thông báo hoàn khoản</strong>
        <p>Bệnh nhân: <b>${selected.userName}</b></p>
        <p>Ngân hàng: <b>${selected.transferBankName}</b></p>
        <p>Số tài khoản: <b>${selected.transferBankAccount}</b></p>
        <p>Số tiền đã chuyển: <b>${formatCurrency(selected.amount)}</b></p>
      `;

      requestsContent.prepend(banner);
    };

    const render = () => {
      const confirmed = getArray(KEYS.confirmed);

      if (confirmed.length === 0) {
        requestList.innerHTML = '<p class="empty-state">Không còn lịch hẹn sắp tới.</p>';
        return;
      }

      requestList.innerHTML = confirmed.map(buildDoctorAppointmentCard).join('');

      requestList.querySelectorAll('.request-item').forEach((itemNode) => {
        const id = itemNode.getAttribute('data-id');
        const completeBtn = itemNode.querySelector('.btn-accept');
        const rejectBtn = itemNode.querySelector('.btn-cancel');

        completeBtn?.addEventListener('click', () => {
          const currentConfirmed = getArray(KEYS.confirmed);
          const remaining = currentConfirmed.filter((entry) => entry.id !== id);
          setArray(KEYS.confirmed, remaining);

          alert('Đã hoàn thành lịch hẹn. Lịch đã được gỡ khỏi danh sách sắp tới.');
          render();
        });

        rejectBtn?.addEventListener('click', () => {
          const currentConfirmed = getArray(KEYS.confirmed);
          const selected = currentConfirmed.find((entry) => entry.id === id);
          if (!selected) {
            return;
          }

          const remaining = currentConfirmed.filter((entry) => entry.id !== id);
          setArray(KEYS.confirmed, remaining);

          const refunds = getArray(KEYS.refunds);
          refunds.unshift({
            id: selected.id,
            title: selected.title,
            doctorName: selected.doctorName,
            specialty: selected.specialty,
            date: selected.date,
            location: selected.location,
            desc: selected.desc,
            amount: selected.amount,
            bankName: selected.transferBankName,
            bankAccount: selected.transferBankAccount,
            userName: selected.userName,
            createdAt: Date.now()
          });
          setArray(KEYS.refunds, refunds);

          alert(
            `ĐÃ TỪ CHỐI LỊCH HẸN\nVui lòng hoàn khoản cho bệnh nhân:\n` +
              `- Tên: ${selected.userName}\n` +
              `- Ngân hàng: ${selected.transferBankName}\n` +
              `- Số tài khoản: ${selected.transferBankAccount}\n` +
              `- Số tiền đã chuyển: ${formatCurrency(selected.amount)}`
          );

          showRefundBanner(selected);
          render();
        });
      });
    };

    render();
  };

  const buildUserAppointmentCard = (item) => `
    <div class="appointment-card">
      <div class="appointment-left">
        <h4 class="appointment-title">${item.title}</h4>
        <p class="appointment-status">${item.status}</p>
        <p class="appointment-date">${item.date}</p>
        <p class="appointment-desc">${item.desc}</p>

        <div class="appointment-doctor">
          <div class="doctor-avatar"></div>
          <div class="doctor-info">
            <h5>${item.doctorName}</h5>
            <span>${item.specialty}</span>
          </div>
        </div>
        <p class="appointment-location">${item.location}</p>
      </div>

      ${item.status === 'Đã từ chối' ? '' : `
      <div class="appointment-right">
        <button class="btn btn-cancel">Hủy lịch hẹn</button>
      </div>
      `}
    </div>
  `;

  const setupUserAppointmentsPage = () => {
    const appointmentsList = document.querySelector('.appointments-list');
    const isUserAppointments = window.location.pathname.includes('/user/my-appointments.html');
    if (!appointmentsList || !isUserAppointments) {
      return;
    }

    const pending = getArray(KEYS.pending).map((item) => ({ ...item, status: 'Đang chờ xác nhận' }));
    const confirmed = getArray(KEYS.confirmed);
    const rejected = getArray(KEYS.refunds).map((item) => ({
      id: item.id,
      title: item.title || 'Lịch hẹn đã từ chối',
      doctorName: item.doctorName || 'BS. Chưa cập nhật',
      specialty: item.specialty || 'Chuyên khoa chưa cập nhật',
      date: item.date || 'Chưa cập nhật',
      location: item.location || 'Chưa cập nhật',
      desc: item.desc || `Bác sĩ đã từ chối lịch hẹn. Số tiền cần hoàn: ${formatCurrency(item.amount || 0)}.`,
      status: 'Đã từ chối'
    }));
    const combined = [...pending, ...confirmed, ...rejected];

    if (combined.length > 0) {
      const dynamicWrapper = document.createElement('div');
      dynamicWrapper.className = 'dynamic-appointments';
      dynamicWrapper.innerHTML = combined.map(buildUserAppointmentCard).join('');
      appointmentsList.prepend(dynamicWrapper);
    }

    const profile = getProfile();
    const bankName = document.getElementById('user-bank-name');
    const bankAccount = document.getElementById('user-bank-account');

    if (bankName) {
      bankName.textContent = `Ngân hàng: ${profile.bankName}`;
    }
    if (bankAccount) {
      bankAccount.textContent = `Số tài khoản: ${profile.bankAccount}`;
    }
  };

  seedInitialPendingRequests();
  setupSettingsPage();
  setupCreateAppointmentPage();
  setupCheckoutPage();
  setupDoctorRequestsPage();
  setupDoctorAppointmentsPage();
  setupUserAppointmentsPage();
})();
