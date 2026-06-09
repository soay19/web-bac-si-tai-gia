(function () {
  const API_BASE =
    window.THAT_CLINIC_API_BASE ||
    `${window.location.protocol}//${window.location.hostname}:3000/api`;

  const KEYS = {
    draft: 'thatClinicAppointmentDraft',
    pending: 'thatClinicPendingRequests',
    confirmed: 'thatClinicConfirmedAppointments',
    refunds: 'thatClinicRefundNotices'
  };

  const defaultProfile = {
    fullName: '',
    phone: '',
    bankName: '',
    bankAccount: ''
  };

  const state = {
    draft: null,
    pending: [],
    confirmed: [],
    refunds: []
  };

  let paidRefundIds = new Set();

  let profile = { ...defaultProfile };

  const toJson = async (response, fallback = {}) => {
    try {
      return await response.json();
    } catch (_error) {
      return fallback;
    }
  };

  const apiFetch = (path, options = {}) =>
    fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options
    });

  const formatCurrency = (amount) => `${new Intl.NumberFormat('vi-VN').format(Number(amount) || 0)}d`;

  const formatDateFromInput = (dateInput) => {
    if (!dateInput) {
      return '12/03/2026';
    }

    const [year, month, day] = dateInput.split('-');
    return `${day}/${month}/${year}`;
  };

  const buildTimeRangeFromDuration = (fromTime, durationMinutes) => {
    const [hoursStr, minutesStr] = String(fromTime || '13:00').split(':');
    const startHours = Number(hoursStr);
    const startMinutes = Number(minutesStr);

    if (!Number.isFinite(startHours) || !Number.isFinite(startMinutes)) {
      return '13:00 - 13:15';
    }

    const duration = Number(durationMinutes);
    const safeDuration = Number.isFinite(duration) ? duration : 15;
    const startTotal = startHours * 60 + startMinutes;
    const endTotal = startTotal + safeDuration;
    const endHours = Math.floor((endTotal % (24 * 60)) / 60);
    const endMinutes = endTotal % 60;

    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    return `${fromTime} - ${endTime}`;
  };

  const buildAppointmentDateTime = (dateValue, fromTime) => {
    const [year, month, day] = String(dateValue || '').split('-');
    const [hours, minutes] = String(fromTime || '13:00').split(':');

    if (!year || !month || !day || !hours || !minutes) {
      return '';
    }

    return `${year}-${month}-${day} ${hours}:${minutes}:00`;
  };

  const toDateLabel = (value) => {
    const [day, month, year] = String(value || '').split('/');
    if (!day || !month || !year) {
      return value || '';
    }

    return `${day} Thg ${month}, ${year}`;
  };

  const normalizeAppointmentText = (value) => {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }

    return text
      .replace(/\bLich\s+kham\b/gi, 'Lịch khám')
      .replace(/\bKham\b/gi, 'Khám')
      .replace(/\bChinh\s+hinh\b/gi, 'Chỉnh hình')
      .replace(/\bTong\s+quat\b/gi, 'Tổng quát')
      .replace(/\bNhi\s+khoa\b/gi, 'Nhi khoa')
      .replace(/\bDinh\s+duong\b/gi, 'Dinh dưỡng')
      .replace(/\bTim\s+mach\b/gi, 'Tim mạch')
      .replace(/\bDa\s+lieu\b/gi, 'Da liễu');
  };

  const normalizeMedicalLabel = (value) => normalizeAppointmentText(value) || '';

  const formatDateTimeVi = (value) => {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  };

  const loadDbState = async () => {
    const response = await apiFetch(
      `/user/app-state?keys=${encodeURIComponent(`${KEYS.draft},${KEYS.pending},${KEYS.confirmed},${KEYS.refunds}`)}`
    );

    if (!response.ok) {
      throw new Error('Cannot load app state');
    }

    const payload = await toJson(response, { data: {} });
    const data = payload?.data || {};

    state.draft = data[KEYS.draft] || null;
    state.pending = Array.isArray(data[KEYS.pending]) ? data[KEYS.pending] : [];
    state.confirmed = Array.isArray(data[KEYS.confirmed]) ? data[KEYS.confirmed] : [];
    state.refunds = Array.isArray(data[KEYS.refunds]) ? data[KEYS.refunds] : [];
  };

  const loadPaidRefundIds = async () => {
    try {
      const response = await apiFetch('/admin/paid-refunds');
      if (!response.ok) {
        paidRefundIds = new Set();
        return;
      }

      const payload = await toJson(response, { data: [] });
      const refundIds = Array.isArray(payload?.data) ? payload.data : [];
      paidRefundIds = new Set(refundIds.map((value) => String(value || '').trim()).filter(Boolean));
    } catch (_error) {
      paidRefundIds = new Set();
    }
  };

  const saveDbState = async (key, value) => {
    await apiFetch(`/user/app-state/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    });
  };

  const setDraft = (value) => {
    state.draft = value;
    return saveDbState(KEYS.draft, value);
  };

  const setPending = (value) => {
    state.pending = value;
    return saveDbState(KEYS.pending, value);
  };

  const setConfirmed = (value) => {
    state.confirmed = value;
    return saveDbState(KEYS.confirmed, value);
  };

  const setRefunds = (value) => {
    state.refunds = value;
    return saveDbState(KEYS.refunds, value);
  };

  const getProfileFromDb = async () => {
    const response = await apiFetch('/users/me/profile');
    if (!response.ok) {
      return;
    }

    const payload = await toJson(response, {});
    const data = payload?.data || {};

    profile = {
      fullName: data.fullName || '',
      phone: data.phone || '',
      bankName: data.bankName || '',
      bankAccount: data.bankAccount || ''
    };
  };

  const ensureRoleForCurrentPage = async () => {
    const path = window.location.pathname;
    let expectedRole = null;

    if (path.includes('/user/')) {
      expectedRole = 'user';
    } else if (path.includes('/doctor/')) {
      expectedRole = 'doctor';
    } else if (path.includes('/admin/')) {
      expectedRole = 'admin';
    }

    if (!expectedRole) {
      return true;
    }

    try {
      const response = await apiFetch('/auth/me');
      if (!response.ok) {
        window.location.href = '/guest/login.html';
        return false;
      }

      const payload = await toJson(response, {});
      const role = String(payload?.user?.role || '').trim();

      if (role === expectedRole) {
        return true;
      }

      const roleRedirects = {
        user: '/user/my-appointments.html',
        doctor: '/doctor/my-appointments.html',
        admin: '/admin/view-appointments.html'
      };

      window.location.href = roleRedirects[role] || '/guest/login.html';
      return false;
    } catch (_error) {
      window.location.href = '/guest/login.html';
      return false;
    }
  };

  const setupSettingsPage = async () => {
    const fullnameInput = document.getElementById('fullname');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const dobInput = document.getElementById('dob');
    const genderInput = document.getElementById('gender');
    const addressInput = document.getElementById('address');
    const heightInput = document.getElementById('height');
    const weightInput = document.getElementById('weight');
    const bloodTypeInput = document.getElementById('blood-type');
    const insuranceProviderInput = document.getElementById('insurance-provider');
    const insuranceIdInput = document.getElementById('insurance-id');
    const bankNameInput = document.getElementById('bank-name');
    const bankAccountInput = document.getElementById('bank-account');
    const saveButton = document.querySelector('.btn-save');
    const cancelButton = document.querySelector('.btn-cancel-changes');

    if (
      !fullnameInput ||
      !emailInput ||
      !phoneInput ||
      !dobInput ||
      !genderInput ||
      !addressInput ||
      !heightInput ||
      !weightInput ||
      !bloodTypeInput ||
      !insuranceProviderInput ||
      !insuranceIdInput ||
      !bankNameInput ||
      !bankAccountInput ||
      !saveButton
    ) {
      return;
    }

    const renderData = (data) => {
      fullnameInput.value = data.fullName || '';
      emailInput.value = data.email || '';
      phoneInput.value = data.phone || '';
      dobInput.value = data.dateOfBirth || '';
      genderInput.value = data.gender || 'not-say';
      addressInput.value = data.address || '';
      heightInput.value = data.heightCm || '';
      weightInput.value = data.weightKg || '';
      bloodTypeInput.value = data.bloodType || '';
      insuranceProviderInput.value = data.insuranceProvider || '';
      insuranceIdInput.value = data.insuranceId || '';
      bankNameInput.value = data.bankName || '';
      bankAccountInput.value = data.bankAccount || '';
    };

    const loadProfile = async () => {
      const response = await apiFetch('/users/me/profile');
      if (!response.ok) {
        throw new Error('Not logged in');
      }
      const payload = await toJson(response, {});
      renderData(payload?.data || {});

      const data = payload?.data || {};
      profile = {
        fullName: data.fullName || '',
        phone: data.phone || '',
        bankName: data.bankName || '',
        bankAccount: data.bankAccount || ''
      };
    };

    try {
      await loadProfile();
    } catch (_error) {
      alert('Ban chua dang nhap. Vui long dang nhap de luu thong tin vao database.');
      return;
    }

    saveButton.addEventListener('click', async () => {
      const payload = {
        fullName: fullnameInput.value.trim(),
        email: emailInput.value.trim(),
        phone: phoneInput.value.trim(),
        dateOfBirth: dobInput.value || null,
        gender: genderInput.value || 'not-say',
        address: addressInput.value.trim(),
        heightCm: heightInput.value ? Number(heightInput.value) : null,
        weightKg: weightInput.value ? Number(weightInput.value) : null,
        bloodType: bloodTypeInput.value || null,
        insuranceProvider: insuranceProviderInput.value.trim(),
        insuranceId: insuranceIdInput.value.trim(),
        bankName: bankNameInput.value.trim(),
        bankAccount: bankAccountInput.value.trim()
      };

      const response = await apiFetch('/users/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await toJson(response, {});
      if (!response.ok) {
        alert(`Luu that bai: ${result?.message || 'Khong the luu ho so'}`);
        return;
      }

      await loadProfile();

      alert('Da luu thong tin ho so vao database.');
    });

    cancelButton?.addEventListener('click', async () => {
      try {
        await loadProfile();
      } catch (_error) {
        // ignore
      }
    });
  };

  const setupCreateAppointmentPage = () => {
    const APPOINTMENT_LOCK_KEY = 'thatClinicSelectedDoctorLock';
    const APPOINTMENT_ADDRESS_DRAFT_KEY = 'thatClinicAddressDraft';
    const submitButton = document.querySelector('.create-submit-btn');
    const closeButton = document.querySelector('.close-btn');
    const doctorInput = document.getElementById('doctor');
    const specialtyInput = document.getElementById('specialty');
    const provinceInput = document.getElementById('province');
    const districtInput = document.getElementById('district');
    const addressDetailInput = document.getElementById('address-detail');
    const dateInput = document.getElementById('date');
    const fromTimeInput = document.getElementById('from-time');

    const summaryTitle = document.querySelector('.summary-card h4');
    const summaryLocation = document.querySelector('.summary-location');
    const summaryDateTime = document.querySelector('.summary-datetime');
    const summaryDesc = document.querySelector('.summary-desc');
    const summaryDoctorName = document.querySelector('.summary-doctor div strong');
    const summaryDoctorSpecialty = document.querySelector('.summary-doctor div span');

    if (!submitButton) {
      return;
    }

    let vietnamAddressData = [];

    const normalizeAccent = (value) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const getTodayInputDate = () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const todayInputDate = getTodayInputDate();
    if (dateInput) {
      dateInput.min = todayInputDate;
    }
    if (dateInput && !dateInput.value) {
      dateInput.value = todayInputDate;
    }

    const getSelectionLock = () => {
      try {
        const raw = sessionStorage.getItem(APPOINTMENT_LOCK_KEY);
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.doctorId || !parsed.specialtyId) {
          return null;
        }

        return parsed;
      } catch (_error) {
        return null;
      }
    };

    const clearSelectionLock = () => {
      sessionStorage.removeItem(APPOINTMENT_LOCK_KEY);
    };

    const saveAddressDraft = () => {
      const selectedAddress = getSelectedAddress();

      sessionStorage.setItem(
        APPOINTMENT_ADDRESS_DRAFT_KEY,
        JSON.stringify({
          provinceCode: selectedAddress.provinceCode,
          districtCode: selectedAddress.districtCode,
          detail: selectedAddress.detail
        })
      );
    };

    const getAddressDraft = () => {
      try {
        const raw = sessionStorage.getItem(APPOINTMENT_ADDRESS_DRAFT_KEY);
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
          return null;
        }

        return {
          provinceCode: String(parsed.provinceCode || ''),
          districtCode: String(parsed.districtCode || ''),
          detail: String(parsed.detail || '')
        };
      } catch (_error) {
        return null;
      }
    };

    const getSelectedDuration = () => document.querySelector('input[name="duration"]:checked')?.value || '15';

    const getSelectedDoctorOption = () => {
      if (!doctorInput) {
        return null;
      }

      const option = doctorInput.options[doctorInput.selectedIndex];
      if (!option || !option.value) {
        return null;
      }

      return option;
    };

    const getSelectedSpecialtyName = () => {
      const selectedDoctor = getSelectedDoctorOption();
      if (selectedDoctor?.dataset?.specialtyName) {
        return selectedDoctor.dataset.specialtyName;
      }

      if (!specialtyInput) {
        return '';
      }

      const option = specialtyInput.options[specialtyInput.selectedIndex];
      return option && option.value ? option.textContent?.trim() || '' : '';
    };

    const getSelectedDoctorGender = () => {
      const selectedDoctor = getSelectedDoctorOption();
      const genderValue = String(selectedDoctor?.dataset?.gender || '').trim().toLowerCase();
      return genderValue === 'female' ? 'female' : 'male';
    };

    const getSelectedAddress = () => {
      const provinceOption = provinceInput?.options?.[provinceInput.selectedIndex];
      const districtOption = districtInput?.options?.[districtInput.selectedIndex];

      const provinceName = provinceOption && provinceOption.value ? provinceOption.textContent?.trim() || '' : '';
      const districtName = districtOption && districtOption.value ? districtOption.textContent?.trim() || '' : '';
      const detail = addressDetailInput?.value.trim() || '';

      return {
        provinceCode: provinceInput?.value || '',
        districtCode: districtInput?.value || '',
        provinceName,
        districtName,
        detail
      };
    };

    const buildLocationText = () => {
      const selectedAddress = getSelectedAddress();
      return [selectedAddress.detail, selectedAddress.districtName, selectedAddress.provinceName]
        .filter(Boolean)
        .join(', ');
    };

    const renderSummary = () => {
      const doctorOption = getSelectedDoctorOption();
      const doctorName = doctorOption?.dataset?.name || '';
      const doctorGender = getSelectedDoctorGender();
      const specialtyName = getSelectedSpecialtyName();
      const fullAddress = buildLocationText();
      const location = fullAddress || 'Địa điểm';
      const dateValue = dateInput?.value || todayInputDate;
      const fromTime = fromTimeInput?.value || '13:00';
      const timeRange = buildTimeRangeFromDuration(fromTime, getSelectedDuration());
      const summarySpecialty = specialtyName || 'Chuyên khoa';

      if (summaryTitle) {
        summaryTitle.textContent = specialtyName ? `Khám ${normalizeMedicalLabel(specialtyName).toLowerCase()}` : 'Tiêu đề lịch hẹn';
      }
      if (summaryLocation) {
        summaryLocation.textContent = location;
      }
      if (summaryDateTime) {
        summaryDateTime.textContent = `${formatDateFromInput(dateValue)} · ${timeRange}`;
      }
      if (summaryDesc) {
        if (specialtyName && doctorName) {
          summaryDesc.textContent = `Lịch khám ${normalizeMedicalLabel(specialtyName).toLowerCase()} với ${doctorName} tại ${location}.`;
        } else {
          summaryDesc.textContent = 'Mô tả lịch hẹn ngắn gọn được hiển thị ở đây để người dùng kiểm tra trước khi tạo.';
        }
      }
      if (summaryDoctorName) {
        summaryDoctorName.textContent = doctorName
          ? `${doctorName} (${doctorGender === 'female' ? 'Nữ' : 'Nam'})`
          : 'Tên bác sĩ';
      }
      if (summaryDoctorSpecialty) {
        summaryDoctorSpecialty.textContent = summarySpecialty;
      }
    };

    const renderDistrictOptions = (districts) => {
      if (!districtInput) {
        return;
      }

      districtInput.innerHTML = ['<option value="">Chọn quận/huyện</option>']
        .concat(
          districts.map(
            (item) =>
              `<option value="${item.code}">${String(item.name || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</option>`
          )
        )
        .join('');

      districtInput.disabled = districts.length === 0;
      if (districts.length === 0) {
        districtInput.innerHTML = '<option value="">Chọn tỉnh/thành trước</option>';
      }
    };

    const renderProvinceOptions = (provinces) => {
      if (!provinceInput) {
        return;
      }

      provinceInput.innerHTML = ['<option value="">Chọn tỉnh/thành phố</option>']
        .concat(
          provinces.map(
            (item) =>
              `<option value="${item.code}">${String(item.name || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</option>`
          )
        )
        .join('');
    };

    const loadVietnamAddressData = async () => {
      if (!provinceInput || !districtInput) {
        return;
      }

      try {
        const response = await fetch('https://provinces.open-api.vn/api/?depth=2');
        const data = await toJson(response, []);
        const provinces = response.ok && Array.isArray(data) ? data : [];

        vietnamAddressData = provinces.map((province) => ({
          code: String(province.code || ''),
          name: province.name || '',
          districts: Array.isArray(province.districts)
            ? province.districts.map((district) => ({
                code: String(district.code || ''),
                name: district.name || ''
              }))
            : []
        }));

        const addressDraft = getAddressDraft();
        const draftProvince = vietnamAddressData.find((item) => item.code === addressDraft?.provinceCode);
        if (vietnamAddressData.length === 0) {
          renderProvinceOptions([]);
          renderDistrictOptions([]);
          renderSummary();
          return;
        }

        renderProvinceOptions(vietnamAddressData);
        provinceInput.value = draftProvince?.code || '';
        provinceInput.disabled = false;
        renderDistrictOptions(draftProvince?.districts || []);

        if (addressDraft?.districtCode) {
          districtInput.value = addressDraft.districtCode;
        }

        if (addressDraft?.detail && addressDetailInput) {
          addressDetailInput.value = addressDraft.detail;
        }

        renderSummary();
      } catch (_error) {
        provinceInput.innerHTML = '<option value="">Không tải được tỉnh/thành</option>';
        provinceInput.value = '';
        provinceInput.disabled = true;
        districtInput.innerHTML = '<option value="">Chọn tỉnh/thành trước</option>';
        districtInput.disabled = true;
      }
    };

    const renderSpecialtyOptions = (specialties) => {
      if (!specialtyInput) {
        return;
      }

      specialtyInput.innerHTML = ['<option value="">Chọn chuyên khoa</option>']
        .concat(
          specialties.map(
            (item) =>
              `<option value="${item.id}">${String(item.name || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</option>`
          )
        )
        .join('');
    };

    const renderDoctorOptions = (doctors, specialtyId = '') => {
      if (!doctorInput) {
        return;
      }

      const filtered = specialtyId ? doctors.filter((item) => item.specialtyId === specialtyId) : doctors;
      doctorInput.innerHTML = ['<option value="">Chọn bác sĩ</option>']
        .concat(
          filtered.map(
            (item) =>
              `<option value="${item.id}" data-name="${String(item.name || '')
                .replaceAll('&', '&amp;')
                .replaceAll('"', '&quot;')}" data-gender="${String(item.gender || 'male')
                .replaceAll('&', '&amp;')
                .replaceAll('"', '&quot;')}" data-specialty-id="${item.specialtyId}" data-consultation-fee="${Number(
                item.consultationFee || 0
              )}" data-specialty-name="${String(
                item.specialty || ''
              )
                .replaceAll('&', '&amp;')
                .replaceAll('"', '&quot;')}">${String(item.name || '')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')}</option>`
          )
        )
        .join('');
    };

    const loadDoctorAndSpecialty = async () => {
      if (!doctorInput || !specialtyInput) {
        return [];
      }

      try {
        const [doctorsRes, specialtiesRes] = await Promise.all([apiFetch('/doctors'), apiFetch('/specialties')]);
        const doctorsPayload = await toJson(doctorsRes, { data: [] });
        const specialtiesPayload = await toJson(specialtiesRes, { data: [] });
        const doctors = doctorsRes.ok && Array.isArray(doctorsPayload?.data) ? doctorsPayload.data : [];
        const specialties =
          specialtiesRes.ok && Array.isArray(specialtiesPayload?.data) ? specialtiesPayload.data : [];

        renderSpecialtyOptions(specialties);
        renderDoctorOptions(doctors);

        const selectionLock = getSelectionLock();
        if (selectionLock) {
          const lockedDoctor = doctors.find((item) => item.id === selectionLock.doctorId);
          if (lockedDoctor) {
            specialtyInput.value = lockedDoctor.specialtyId;
            renderDoctorOptions(doctors, lockedDoctor.specialtyId);
            doctorInput.value = lockedDoctor.id;
            specialtyInput.disabled = true;
            doctorInput.disabled = true;
          } else {
            clearSelectionLock();
          }
        }

        renderSummary();

        return doctors;
      } catch (_error) {
        doctorInput.innerHTML = '<option value="">Không tải được bác sĩ</option>';
        specialtyInput.innerHTML = '<option value="">Không tải được chuyên khoa</option>';
        renderSummary();
        return [];
      }
    };

    let doctorsCache = [];
    loadVietnamAddressData();
    loadDoctorAndSpecialty().then((doctors) => {
      doctorsCache = doctors;
    });

    specialtyInput?.addEventListener('change', () => {
      const selectedSpecialtyId = specialtyInput.value;
      renderDoctorOptions(doctorsCache, selectedSpecialtyId);
      renderSummary();
    });

    doctorInput?.addEventListener('change', () => {
      const selectedOption = doctorInput.options[doctorInput.selectedIndex];
      if (!selectedOption || !selectedOption.value || !specialtyInput) {
        return;
      }

      const doctorSpecialtyId = selectedOption.dataset.specialtyId || '';
      if (doctorSpecialtyId) {
        specialtyInput.value = doctorSpecialtyId;
      }

      renderSummary();
      checkTimeSlotConflict();
    });

    provinceInput?.addEventListener('change', () => {
      const selectedProvince = vietnamAddressData.find((item) => item.code === provinceInput.value);
      const districts = selectedProvince?.districts || [];
      renderDistrictOptions(districts);
      saveAddressDraft();
      renderSummary();
    });

    districtInput?.addEventListener('change', () => {
      saveAddressDraft();
      renderSummary();
    });
    addressDetailInput?.addEventListener('input', () => {
      saveAddressDraft();
      renderSummary();
    });

    // Check for time slot conflicts with doctor
    const checkTimeSlotConflict = async () => {
      const doctorSelect = document.getElementById('doctor');
      const dateSelect = document.getElementById('date');
      const fromTimeInput = document.getElementById('from-time');
      const conflictWarning = document.getElementById('time-conflict-warning');

      const doctorId = doctorSelect?.value;
      const date = dateSelect?.value;
      const fromTime = fromTimeInput?.value;
      const selectedDuration = Number(document.querySelector('input[name="duration"]:checked')?.value || 15);
      const appointmentDateTime = buildAppointmentDateTime(date, fromTime);

      if (!doctorId || !date || !fromTime || !appointmentDateTime || !conflictWarning) {
        if (conflictWarning) conflictWarning.style.display = 'none';
        if (submitButton) submitButton.disabled = false;
        return { hasConflict: false, slots: [] };
      }

      try {
        const checkRes = await apiFetch(
          `/api/doctors/${doctorId}/booked-slots?appointmentDate=${encodeURIComponent(appointmentDateTime)}&durationMinutes=${encodeURIComponent(selectedDuration)}`
        );

        if (!checkRes.ok) {
          conflictWarning.style.display = 'none';
          if (submitButton) submitButton.disabled = false;
          return { hasConflict: false, slots: [] };
        }

        const checkData = await toJson(checkRes, {});
        const slots = checkData.data || [];

        if (slots.length > 0) {
          conflictWarning.style.display = 'block';
          conflictWarning.innerHTML = `
            <strong>⚠️ Giờ này đang bận:</strong> Bác sĩ đã có lịch trong khung bạn chọn.
            <div style="margin-top: 6px; font-weight: 600;">Bạn đang chọn: ${formatDateFromInput(date)} · ${fromTime} - ${buildTimeRangeFromDuration(fromTime, selectedDuration).split(' - ')[1]}</div>
            <div style="margin-top: 6px;">Khung bận hiện có: ${slots.map(s => {
              const start = String(s.startTime || '').slice(11, 16);
              const end = String(s.endTime || '').slice(11, 16);
              return `${start}-${end}`;
            }).join(', ')}</div>
            <div style="margin-top: 6px;">Vui lòng đổi sang giờ khác để tiếp tục đặt lịch.</div>
          `;
          if (submitButton) submitButton.disabled = true;
          return { hasConflict: true, slots };
        } else {
          conflictWarning.style.display = 'none';
          if (submitButton) submitButton.disabled = false;
          return { hasConflict: false, slots: [] };
        }
      } catch (error) {
        // Silently fail - don't block appointment if API fails
        console.error('Lỗi kiểm tra lịch bận:', error);
        if (submitButton) submitButton.disabled = false;
        return { hasConflict: false, slots: [] };
      }
    };

    dateInput?.addEventListener('change', () => {
      renderSummary();
      checkTimeSlotConflict();
    });
    fromTimeInput?.addEventListener('change', () => {
      renderSummary();
      checkTimeSlotConflict();
    });
    document.querySelectorAll('input[name="duration"]').forEach((input) => {
      input.addEventListener('change', () => {
        renderSummary();
        checkTimeSlotConflict();
      });
    });

    submitButton.addEventListener('click', async (event) => {
      event.preventDefault();

      const conflictState = await checkTimeSlotConflict();
      if (conflictState.hasConflict) {
        alert('Bác sĩ này đã có lịch trong khung giờ bạn chọn. Vui lòng đổi giờ khác.');
        return;
      }

      const selectedDoctor = doctorInput?.options?.[doctorInput.selectedIndex];
      if (!selectedDoctor || !selectedDoctor.value) {
        alert('Vui lòng chọn bác sĩ từ danh sách.');
        return;
      }

      const doctorId = selectedDoctor.value;
      const doctor = selectedDoctor.dataset.name || '';
      const doctorGender = String(selectedDoctor.dataset.gender || '').toLowerCase() === 'female' ? 'female' : 'male';
      const specialty = selectedDoctor.dataset.specialtyName || '';
      const consultationFee = Number(selectedDoctor.dataset.consultationFee || 0);
      if (!doctor || !specialty) {
        alert('Thông tin bác sĩ hoặc chuyên khoa không hợp lệ. Vui lòng chọn lại.');
        return;
      }

      const selectedAddress = getSelectedAddress();
      if (!selectedAddress.provinceCode) {
        alert('Vui lòng chọn tỉnh/thành phố.');
        return;
      }

      if (!selectedAddress.districtCode) {
        alert('Vui lòng chọn quận/huyện.');
        return;
      }

      const location = buildLocationText() || 'Khám tại nhà';
      const dateValue = document.getElementById('date')?.value || todayInputDate;
      const fromTime = document.getElementById('from-time')?.value || '13:00';
      const selectedDuration = document.querySelector('input[name="duration"]:checked')?.value || '15';
      const timeRange = buildTimeRangeFromDuration(fromTime, selectedDuration);

      saveAddressDraft();

      // Convert date from YYYY-MM-DD to YYYY-MM-DD HH:mm:ss format
      const appointmentDateTime = buildAppointmentDateTime(dateValue, fromTime);
      if (!appointmentDateTime) {
        alert('Ngày hoặc giờ khám không hợp lệ.');
        return;
      }

      const draft = {
        title: `Khám ${specialty.toLowerCase()}`,
        doctorName: doctor,
        doctorGender,
        specialty,
        location,
        date: formatDateFromInput(dateValue),
        timeRange,
        amount: consultationFee,
        desc: `Lịch khám ${specialty.toLowerCase()} tại ${location}.`,
        doctorId,
        durationMinutes: selectedDuration
      };

      try {
        // Create appointment in database
        const createRes = await apiFetch('/appointments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            doctorId,
            title: draft.title,
            description: draft.desc,
            appointmentDate: appointmentDateTime,
            appointmentLocation: location,
            durationMinutes: Number(selectedDuration)
          })
        });

        if (!createRes.ok) {
          const errorData = await toJson(createRes, {});
          alert(errorData.message || 'Không thể tạo lịch hẹn. Vui lòng thử lại.');
          return;
        }

        const appointmentData = await toJson(createRes, {});
        draft.appointmentId = appointmentData.data?.id;
        if (Number(appointmentData.data?.amount) > 0) {
          draft.amount = Number(appointmentData.data.amount);
        }

        // Save draft for checkout to use
        await setDraft(draft);
        clearSelectionLock();
        window.location.href = './checkout.html';
      } catch (error) {
        alert('Lỗi: ' + error.message);
      }
    });

    closeButton?.addEventListener('click', () => {
      clearSelectionLock();
      window.location.href = './doctors.html';
    });

    window.addEventListener('beforeunload', clearSelectionLock);
    renderSummary();
  };

  const setupCheckoutPage = () => {
    const invoiceBody = document.querySelector('.invoice-table tbody');
    const totalRows = document.querySelectorAll('.payment-total strong');
    const qrBox = document.getElementById('payment-qr-direct-box');
    const qrImage = document.getElementById('payment-qr-image');

    const checkoutParams = new URLSearchParams(window.location.search);
    if (checkoutParams.get('payment') === 'failed') {
      window.setTimeout(() => {
        alert('Thanh toán thất bại. Vui lòng thử lại.');
      }, 0);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const draft = state.draft;

    const renderInvoiceFromDraft = (data) => {
      if (!invoiceBody || !data) {
        return;
      }

      const amount = Number(data.amount) || 0;
      const safeDoctor = data.doctorName || 'Chưa chọn bác sĩ';
      const safeDoctorGender = String(data.doctorGender || '').toLowerCase() === 'female' ? 'Nữ' : 'Nam';
      const safeSpecialty = data.specialty || 'Chưa chọn chuyên khoa';
      const safeLocation = data.location || 'Chưa cập nhật địa điểm';
      const safeDate = data.date || 'Chưa cập nhật ngày khám';
      const safeTimeRange = String(data.timeRange || '')
        .replace(/undefined/g, '')
        .replace(/\s*-\s*$/, '')
        .trim();
      const safeTitle = normalizeAppointmentText(data.title || 'Lịch hẹn khám');

      invoiceBody.innerHTML = `
        <tr>
          <td>Tiêu đề lịch hẹn: ${safeTitle}</td>
          <td class="text-right">${formatCurrency(amount)}</td>
        </tr>
        <tr>
          <td>Tên bác sĩ: ${safeDoctor} (${safeDoctorGender})</td>
          <td class="text-right">0d</td>
        </tr>
        <tr>
          <td>Chuyên khoa: ${safeSpecialty}</td>
          <td class="text-right">0d</td>
        </tr>
        <tr>
          <td>Lịch khám: ${safeDate}${safeTimeRange ? ` - ${safeTimeRange}` : ''}</td>
          <td class="text-right">0d</td>
        </tr>
        <tr>
          <td>Địa điểm: ${safeLocation}</td>
          <td class="text-right">0d</td>
        </tr>
      `;

      if (totalRows[0]) {
        totalRows[0].textContent = formatCurrency(amount);
      }
      if (totalRows[1]) {
        totalRows[1].textContent = formatCurrency(amount);
      }
    };

    async function renderQrForPayment() {
      const finalDraft = state.draft;
      if (!finalDraft || !finalDraft.appointmentId) {
        if (qrImage) qrImage.src = '';
        qrBox?.classList.remove('is-loading');
        return;
      }
      try {
        qrBox?.classList.add('is-loading');
        const createPaymentRes = await apiFetch('/payment/vnpay/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            appointmentId: finalDraft.appointmentId,
            amount: Number(finalDraft.amount || 0)
          })
        });
        if (!createPaymentRes.ok) {
          if (qrImage) qrImage.src = '';
          qrBox?.classList.remove('is-loading');
          return;
        }
        const paymentData = await toJson(createPaymentRes, {});
        if (paymentData.redirectUrl) {
          const redirectUrl = new URL(paymentData.redirectUrl);
          const apiBaseUrl = new URL(API_BASE, window.location.origin);
          const simulateUrlBase = new URL('/api/payment/vnpay/simulate', apiBaseUrl.origin);
          simulateUrlBase.search = redirectUrl.search;
          const simulateUrl = simulateUrlBase.toString();
          const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(simulateUrl)}`;
          if (qrImage) qrImage.src = qrCodeUrl;
          qrBox?.classList.remove('is-loading');
        } else {
          if (qrImage) qrImage.src = '';
          qrBox?.classList.remove('is-loading');
        }
      } catch (error) {
        if (qrImage) qrImage.src = '';
        qrBox?.classList.remove('is-loading');
      }
    }

    if (draft) {
      renderInvoiceFromDraft(draft);
      renderQrForPayment();
    } else {
      if (invoiceBody) {
        invoiceBody.innerHTML = '<tr><td colspan="2">Không tìm thấy lịch hẹn vừa tạo. Vui lòng quay lại tạo lịch.</td></tr>';
      }
      if (totalRows[0]) {
        totalRows[0].textContent = formatCurrency(0);
      }
      if (totalRows[1]) {
        totalRows[1].textContent = formatCurrency(0);
      }
      qrBox?.classList.remove('is-loading');
    }
  };

  const createCalendarRenderer = (container, options = {}) => {
    if (!container) {
      return {
        setEvents: () => {},
        setEmptyState: () => {}
      };
    }

    const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    const toDateOnly = (date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const addDays = (date, amount) => {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + amount);
      return nextDate;
    };

    const startOfWeek = (date) => {
      const base = toDateOnly(date);
      const weekDay = base.getDay();
      const diff = weekDay === 0 ? -6 : 1 - weekDay;
      return addDays(base, diff);
    };

    const formatTime = (date) =>
      new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date);

    const formatDayNumber = (date) => String(date.getDate());

    const formatMonthLabel = (date) =>
      new Intl.DateTimeFormat('vi-VN', {
        month: 'long',
        year: 'numeric'
      }).format(date);

    const formatDayLabel = (date) =>
      new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit'
      }).format(date);

    const isSameDate = (left, right) =>
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate();

    container.innerHTML = `
      <section class="calendar-shell">
        <div class="calendar-toolbar">
          <div class="calendar-toolbar-left">
            <button type="button" class="calendar-btn" data-nav="today">Hôm nay</button>
            <div class="calendar-nav-group">
              <button type="button" class="calendar-btn icon" data-nav="prev" aria-label="Trước">&#10094;</button>
              <button type="button" class="calendar-btn icon" data-nav="next" aria-label="Sau">&#10095;</button>
            </div>
            <h3 class="calendar-title" data-calendar-title></h3>
          </div>
          <div class="calendar-view-switch">
            <button type="button" class="calendar-btn" data-view="month">Tháng</button>
            <button type="button" class="calendar-btn is-active" data-view="week">Tuần</button>
            <button type="button" class="calendar-btn" data-view="day">Ngày</button>
          </div>
        </div>
        <div class="calendar-stage" data-calendar-stage></div>
        <aside class="calendar-detail" data-calendar-detail>
          <p class="calendar-detail-empty">Chọn một lịch hẹn để xem chi tiết.</p>
        </aside>
      </section>
    `;

    const stage = container.querySelector('[data-calendar-stage]');
    const titleNode = container.querySelector('[data-calendar-title]');
    const detailNode = container.querySelector('[data-calendar-detail]');
    const viewButtons = Array.from(container.querySelectorAll('[data-view]'));
    const navButtons = Array.from(container.querySelectorAll('[data-nav]'));

    const calendarState = {
      view: 'week',
      anchorDate: toDateOnly(new Date()),
      events: [],
      selectedEventId: ''
    };

    const CALENDAR_START_HOUR = 8;
    const CALENDAR_END_HOUR = 20;
    const CALENDAR_START_MINUTES = CALENDAR_START_HOUR * 60;
    const CALENDAR_END_MINUTES = CALENDAR_END_HOUR * 60;
    const CALENDAR_VISIBLE_MINUTES = CALENDAR_END_MINUTES - CALENDAR_START_MINUTES;

    const getRangeLabel = () => {
      if (calendarState.view === 'month') {
        return formatMonthLabel(calendarState.anchorDate);
      }

      if (calendarState.view === 'day') {
        return formatDayLabel(calendarState.anchorDate);
      }

      const weekStart = startOfWeek(calendarState.anchorDate);
      const weekEnd = addDays(weekStart, 6);
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
      const monthPart = sameMonth
        ? `${weekStart.getMonth() + 1}`
        : `${weekStart.getMonth() + 1}-${weekEnd.getMonth() + 1}`;
      return `Tuần ${formatDayNumber(weekStart)}-${formatDayNumber(weekEnd)} Thg ${monthPart}/${weekEnd.getFullYear()}`;
    };

    const buildStatusClass = (status) => {
      const value = String(status || '').trim();
      if (value === 'đã_xác_nhận') {
        return 'confirmed';
      }
      if (value === 'đã_huỷ') {
        return 'cancelled';
      }
      if (value === 'chưa_thanh_toán') {
        return 'unpaid';
      }
      return 'pending';
    };

    const findEvent = (id) => calendarState.events.find((item) => String(item.id) === String(id));

    const renderDetail = () => {
      if (!detailNode) {
        return;
      }

      const selectedEvent = findEvent(calendarState.selectedEventId);
      if (!selectedEvent) {
        detailNode.innerHTML = '<p class="calendar-detail-empty">Chọn một lịch hẹn để xem chi tiết.</p>';
        return;
      }

      const actionButtons = Array.isArray(selectedEvent.actions)
        ? selectedEvent.actions
            .map(
              (actionItem) =>
                `<button type="button" class="calendar-action-btn ${String(actionItem.className || '')}" data-action="${String(
                  actionItem.key || ''
                )}" data-appointment-id="${String(selectedEvent.id || '')}">${String(actionItem.label || 'Thao tác')}</button>`
            )
            .join('')
        : '';

      detailNode.innerHTML = `
        <h4>${String(selectedEvent.title || 'Lịch khám')}</h4>
        <p><strong>Mã lịch hẹn:</strong> ${String(selectedEvent.reference || selectedEvent.id || 'N/A')}</p>
        <p><strong>Thời gian:</strong> ${String(selectedEvent.dateLabel || '')} · ${String(selectedEvent.timeLabel || '')}</p>
        <p><strong>Thời lượng:</strong> ${String(selectedEvent.durationLabel || 'Chưa cập nhật')}</p>
        <p><strong>Trạng thái:</strong> ${String(selectedEvent.statusLabel || '')}</p>
        <p><strong>Hoàn tiền:</strong> <span class="refund-status ${String(selectedEvent.refundClassName || '')}">${String(selectedEvent.refundLabel || '—')}</span></p>
        <p><strong>Người liên quan:</strong> ${String(selectedEvent.personLabel || '')}</p>
        <p><strong>Chuyên khoa:</strong> ${String(selectedEvent.specialtyLabel || 'Chưa cập nhật')}</p>
        <p><strong>Liên hệ:</strong> ${String(selectedEvent.contactLabel || 'Chưa cập nhật')}</p>
        <p><strong>Địa điểm:</strong> ${String(selectedEvent.location || 'Chưa cập nhật')}</p>
        <p><strong>Tạo lúc:</strong> ${String(selectedEvent.createdAtLabel || 'Chưa cập nhật')}</p>
        <p><strong>Cập nhật:</strong> ${String(selectedEvent.updatedAtLabel || 'Chưa cập nhật')}</p>
        <p>${String(selectedEvent.description || 'Không có mô tả thêm')}</p>
        <div class="calendar-actions">${actionButtons}</div>
      `;

      detailNode.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', async () => {
          const appointmentId = String(button.getAttribute('data-appointment-id') || '').trim();
          const action = String(button.getAttribute('data-action') || '').trim();
          if (!appointmentId || !action || typeof options.onAction !== 'function') {
            return;
          }

          const current = findEvent(appointmentId);
          const actionConfig = current?.actions?.find((item) => item.key === action);
          if (actionConfig?.confirmText && !window.confirm(actionConfig.confirmText)) {
            return;
          }

          await options.onAction({ appointmentId, action, event: current });
        });
      });
    };

    const attachEventSelection = () => {
      if (!stage) {
        return;
      }

      stage.querySelectorAll('[data-event-id]').forEach((eventNode) => {
        eventNode.addEventListener('click', () => {
          calendarState.selectedEventId = String(eventNode.getAttribute('data-event-id') || '');
          stage.querySelectorAll('[data-event-id]').forEach((node) => {
            node.classList.toggle('is-selected', node === eventNode);
          });
          renderDetail();
        });
      });
    };

    const renderMonth = () => {
      if (!stage) {
        return;
      }

      const firstDayOfMonth = new Date(calendarState.anchorDate.getFullYear(), calendarState.anchorDate.getMonth(), 1);
      const monthStart = startOfWeek(firstDayOfMonth);
      const today = toDateOnly(new Date());

      const dayHeaders = DAY_NAMES.map((name) => `<div class="calendar-col-head">${name}</div>`).join('');
      const cells = [];

      for (let index = 0; index < 42; index += 1) {
        const cellDate = addDays(monthStart, index);
        const isCurrentMonth = cellDate.getMonth() === calendarState.anchorDate.getMonth();
        const isToday = isSameDate(cellDate, today);
        const dayEvents = calendarState.events
          .filter((item) => isSameDate(item.start, cellDate))
          .sort((left, right) => left.start - right.start);

        const chips = dayEvents
          .slice(0, 3)
          .map(
            (item) =>
              `<button type="button" class="calendar-event-chip status-${buildStatusClass(item.status)}" data-event-id="${String(
                item.id
              )}">${String(item.timeLabel || '')} ${String(item.title || '')}${item.refundLabel ? ` · ${String(item.refundLabel || '')}` : ''}</button>`
          )
          .join('');

        const overflow = dayEvents.length > 3 ? `<span class="calendar-overflow">+${dayEvents.length - 3} lịch hẹn</span>` : '';

        cells.push(`
          <article class="calendar-day-cell ${isCurrentMonth ? '' : 'is-outside'} ${isToday ? 'is-today' : ''}">
            <header>${formatDayNumber(cellDate)}</header>
            <div class="calendar-day-events">${chips}${overflow}</div>
          </article>
        `);
      }

      stage.innerHTML = `
        <div class="calendar-month-grid">
          ${dayHeaders}
          ${cells.join('')}
        </div>
      `;
      attachEventSelection();
    };

    const renderTimeGrid = () => {
      if (!stage) {
        return;
      }

      const timeRows = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR })
        .map((_, index) => {
          const hour = CALENDAR_START_HOUR + index;
          return `<div class="calendar-time-label">${String(hour).padStart(2, '0')}:00</div>`;
        })
        .join('');

      const visibleDays =
        calendarState.view === 'day'
          ? [toDateOnly(calendarState.anchorDate)]
          : Array.from({ length: 7 }).map((_, index) => addDays(startOfWeek(calendarState.anchorDate), index));

      const dayColumns = visibleDays
        .map((day) => {
          const dayEvents = calendarState.events.filter((item) => isSameDate(item.start, day));
          const eventBlocks = dayEvents
            .map((item) => {
              const rawStartMinutes = item.start.getHours() * 60 + item.start.getMinutes();
              const rawEndMinutes = item.end.getHours() * 60 + item.end.getMinutes();
              const eventStartMinutes = Math.max(CALENDAR_START_MINUTES, rawStartMinutes);
              const eventEndMinutes = Math.min(CALENDAR_END_MINUTES, rawEndMinutes);

              if (eventEndMinutes <= eventStartMinutes) {
                return '';
              }

              const top = eventStartMinutes - CALENDAR_START_MINUTES;
              const duration = eventEndMinutes - eventStartMinutes;
              return `
                <button
                  type="button"
                  class="calendar-event-block status-${buildStatusClass(item.status)}"
                  data-event-id="${String(item.id)}"
                  style="top:${top}px;height:${duration}px;"
                >
                  <strong>${String(item.title || 'Lịch khám')}</strong>
                  <span>${String(item.timeLabel || '')}</span>
                  ${item.refundLabel ? `<span class="calendar-event-refund">${String(item.refundLabel || '')}</span>` : ''}
                </button>
              `;
            })
            .join('');

          return `
            <div class="calendar-day-column">
              <div class="calendar-day-column-head">${formatDayLabel(day)}</div>
              <div class="calendar-day-column-body">
                ${Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR })
                  .map(() => '<div class="calendar-hour-line"></div>')
                  .join('')}
                ${eventBlocks}
              </div>
            </div>
          `;
        })
        .join('');

      stage.innerHTML = `
        <div class="calendar-time-layout ${calendarState.view === 'day' ? 'is-day' : 'is-week'}">
          <div class="calendar-time-axis"><div class="calendar-time-axis-head" aria-hidden="true"></div>${timeRows}</div>
          <div class="calendar-day-columns">${dayColumns}</div>
        </div>
      `;

      attachEventSelection();
    };

    const renderCalendar = () => {
      if (titleNode) {
        titleNode.textContent = getRangeLabel();
      }

      if (!calendarState.events.length) {
        stage.innerHTML = `<p class="empty-state">${String(options.emptyMessage || 'Không có lịch hẹn nào.')}</p>`;
        detailNode.innerHTML = '<p class="calendar-detail-empty">Chưa có dữ liệu để hiển thị.</p>';
        return;
      }

      if (!findEvent(calendarState.selectedEventId)) {
        calendarState.selectedEventId = String(calendarState.events[0]?.id || '');
      }

      if (calendarState.view === 'month') {
        renderMonth();
      } else {
        renderTimeGrid();
      }

      renderDetail();
    };

    navButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const action = String(button.getAttribute('data-nav') || '').trim();
        if (action === 'today') {
          calendarState.anchorDate = toDateOnly(new Date());
        } else if (action === 'prev') {
          if (calendarState.view === 'month') {
            calendarState.anchorDate = new Date(calendarState.anchorDate.getFullYear(), calendarState.anchorDate.getMonth() - 1, 1);
          } else if (calendarState.view === 'week') {
            calendarState.anchorDate = addDays(calendarState.anchorDate, -7);
          } else {
            calendarState.anchorDate = addDays(calendarState.anchorDate, -1);
          }
        } else if (action === 'next') {
          if (calendarState.view === 'month') {
            calendarState.anchorDate = new Date(calendarState.anchorDate.getFullYear(), calendarState.anchorDate.getMonth() + 1, 1);
          } else if (calendarState.view === 'week') {
            calendarState.anchorDate = addDays(calendarState.anchorDate, 7);
          } else {
            calendarState.anchorDate = addDays(calendarState.anchorDate, 1);
          }
        }

        renderCalendar();
      });
    });

    viewButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextView = String(button.getAttribute('data-view') || '').trim();
        if (!nextView || nextView === calendarState.view) {
          return;
        }

        calendarState.view = nextView;
        viewButtons.forEach((node) => node.classList.toggle('is-active', node === button));
        renderCalendar();
      });
    });

    return {
      setEvents: (rawEvents) => {
        calendarState.events = Array.isArray(rawEvents)
          ? rawEvents
              .map((item) => {
                const start = item?.start instanceof Date ? item.start : new Date(item?.start || '');
                const end = item?.end instanceof Date ? item.end : new Date(item?.end || '');
                if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                  return null;
                }

                return {
                  ...item,
                  id: String(item.id || ''),
                  start,
                  end,
                  timeLabel: `${formatTime(start)} - ${formatTime(end)}`,
                  dateLabel: new Intl.DateTimeFormat('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  }).format(start)
                };
              })
              .filter(Boolean)
              .sort((left, right) => left.start - right.start)
          : [];
        renderCalendar();
      },
      setEmptyState: (message) => {
        stage.innerHTML = `<p class="empty-state">${String(message || options.emptyMessage || 'Không có lịch hẹn nào.')}</p>`;
        detailNode.innerHTML = '<p class="calendar-detail-empty">Chưa có dữ liệu để hiển thị.</p>';
      }
    };
  };

  const setupDoctorRequestsPage = () => {
    const requestList = document.querySelector('.requests-list');
    const isDoctorRequests = window.location.pathname.includes('/doctor/doctor-requests.html');
    if (!requestList || !isDoctorRequests) {
      return;
    }

    const render = async () => {
      try {
        // Fetch appointments from database for this doctor
        const response = await apiFetch('/appointments');
        if (!response.ok) {
          requestList.innerHTML = '<p class="empty-state">Không thể tải lịch hẹn đề xuất.</p>';
          return;
        }

        const payload = await toJson(response, { data: [] });
        const appointments = Array.isArray(payload?.data) ? payload.data : [];
        
        // Filter unpaid and waiting confirmation appointments
        const requestAppointments = appointments.filter((item) => 
          item.status === 'chưa_thanh_toán' || item.status === 'chờ_xác_nhận'
        );

        if (requestAppointments.length === 0) {
          requestList.innerHTML = '<p class="empty-state">Hiện chưa có lịch hẹn nào cần xử lý.</p>';
          return;
        }

        requestList.innerHTML = requestAppointments
          .map((item) => {
            const titleDisplay = normalizeMedicalLabel(item.title || 'Lịch khám');
            const descDisplay = normalizeAppointmentText(item.description || 'Không có mô tả');
            const appointmentDateObj = item.appointmentDate ? new Date(item.appointmentDate) : null;
            const appointmentDate = appointmentDateObj ? appointmentDateObj.toLocaleDateString('vi-VN') : 'N/A';
            const startTime = appointmentDateObj
              ? appointmentDateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
              : 'N/A';
            const durationMinutes = Number(item.durationMinutes) || 30;
            const appointmentTimeRange = appointmentDateObj
              ? buildTimeRangeFromDuration(startTime, durationMinutes)
              : 'N/A';

            return `
              <article class="request-item" data-id="${item.id}">
                <div class="request-card">
                  <div class="request-head">
                    <h2>${titleDisplay}</h2>
                    <span class="request-time">${appointmentTimeRange}</span>
                  </div>
                  <p class="request-status">${item.status === 'chưa_thanh_toán' ? 'Chưa thanh toán' : 'Chờ xác nhận'}</p>
                  <p class="request-date">${appointmentDate}</p>
                  <p class="request-desc">${descDisplay}</p>

                  <div class="request-footer">
                    <div class="doctor-summary">
                      <span class="doctor-avatar" aria-hidden="true"></span>
                      <div class="doctor-meta">
                        <strong>${item.patientName || 'Bệnh nhân'}</strong>
                        <span>${item.appointmentLocation || 'Tại phòng khám'}</span>
                      </div>
                    </div>
                    <span class="location">${item.appointmentLocation || 'Tại phòng khám'}</span>
                  </div>
                </div>

                <div class="request-actions">
                  ${item.status === 'chưa_thanh_toán' ? 
                    `<p style="color: #666; font-size: 0.9em;">Đang chờ bệnh nhân thanh toán</p>` :
                    `<button type="button" class="btn-action btn-accept">Chấp nhận</button>
                     <button type="button" class="btn-action btn-cancel">Từ chối</button>`
                  }
                </div>
              </article>
            `;
          })
          .join('');

        // Add event listeners for accept/reject buttons
        requestList.querySelectorAll('.request-item').forEach((itemNode) => {
          const appointmentId = itemNode.getAttribute('data-id');
          const acceptBtn = itemNode.querySelector('.btn-accept');
          const rejectBtn = itemNode.querySelector('.btn-cancel');

          acceptBtn?.addEventListener('click', async () => {
            try {
              const response = await apiFetch(`/appointments/${appointmentId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'đã_xác_nhận' })
              });

              if (!response.ok) {
                alert('Không thể chấp nhận lịch hẹn.');
                return;
              }

              alert('Đã chấp nhận lịch hẹn.');
              render();
            } catch (error) {
              alert('Lỗi khi chấp nhận lịch hẹn: ' + error.message);
            }
          });

          rejectBtn?.addEventListener('click', async () => {
            try {
              const response = await apiFetch(`/appointments/${appointmentId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'đã_huỷ' })
              });

              if (!response.ok) {
                alert('Không thể từ chối lịch hẹn.');
                return;
              }

              alert('Đã từ chối lịch hẹn.');
              render();
            } catch (error) {
              alert('Lỗi khi từ chối lịch hẹn: ' + error.message);
            }
          });
        });
      } catch (error) {
        requestList.innerHTML = '<p class="empty-state">Không thể tải lịch hẹn đề xuất.</p>';
      }
    };

    render();
  };

  const setupDoctorAppointmentsPage = () => {
    const requestList = document.querySelector('.requests-list');
    const dateFromInput = document.getElementById('doctor-filter-date-from');
    const dateToInput = document.getElementById('doctor-filter-date-to');
    const timeFromInput = document.getElementById('doctor-filter-time-from');
    const timeToInput = document.getElementById('doctor-filter-time-to');
    const resetFilterBtn = document.getElementById('doctor-filter-reset');
    const filterResult = document.getElementById('doctor-filter-result');
    const isDoctorAppointments = window.location.pathname.includes('/doctor/my-appointments.html');
    if (!requestList || !isDoctorAppointments) {
      return;
    }

    const doctorCalendar = createCalendarRenderer(requestList, {
      emptyMessage: 'Không có lịch hẹn nào trong khoảng thời gian này.',
      onAction: async ({ appointmentId, action }) => {
        if (action !== 'complete') {
          return;
        }

        try {
          const completeRes = await apiFetch(`/appointments/${appointmentId}/complete`, {
            method: 'DELETE'
          });

          if (!completeRes.ok) {
            const errorData = await toJson(completeRes, {});
            alert(errorData.message || 'Không thể hoàn thành lịch hẹn. Vui lòng thử lại.');
            return;
          }

          alert('Đã hoàn thành lịch hẹn và xoá khỏi hệ thống.');
          renderAppointmentsFromDb();
        } catch (error) {
          alert('Lỗi: ' + error.message);
        }
      }
    });

    const parseTimeToMinutes = (timeValue) => {
      const value = String(timeValue || '').trim();
      if (!value) {
        return null;
      }

      const [hoursStr, minutesStr] = value.split(':');
      const hours = Number(hoursStr);
      const minutes = Number(minutesStr);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return null;
      }

      return hours * 60 + minutes;
    };

    const toStartOfDay = (dateValue) => {
      if (!dateValue) {
        return null;
      }

      const date = new Date(`${dateValue}T00:00:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const toEndOfDay = (dateValue) => {
      if (!dateValue) {
        return null;
      }

      const date = new Date(`${dateValue}T23:59:59.999`);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const updateFilterResult = (matchedCount, totalCount) => {
      if (!filterResult) {
        return;
      }

      if (matchedCount === totalCount) {
        filterResult.textContent = `Hiển thị ${totalCount} lịch hẹn`;
        return;
      }

      filterResult.textContent = `Hiển thị ${matchedCount}/${totalCount} lịch hẹn`;
    };

    const applyTimeFilter = (items) => {
      const fromDate = toStartOfDay(dateFromInput?.value);
      const toDate = toEndOfDay(dateToInput?.value);
      const rawFromTime = parseTimeToMinutes(timeFromInput?.value);
      const rawToTime = parseTimeToMinutes(timeToInput?.value);
      const timeStart = rawFromTime == null || rawToTime == null ? rawFromTime : Math.min(rawFromTime, rawToTime);
      const timeEnd = rawFromTime == null || rawToTime == null ? rawToTime : Math.max(rawFromTime, rawToTime);

      return items.filter((item) => {
        if (!item.appointmentDate) {
          return false;
        }

        const appointmentDate = new Date(item.appointmentDate);
        if (Number.isNaN(appointmentDate.getTime())) {
          return false;
        }

        if (fromDate && appointmentDate < fromDate) {
          return false;
        }

        if (toDate && appointmentDate > toDate) {
          return false;
        }

        const appointmentMinutes = appointmentDate.getHours() * 60 + appointmentDate.getMinutes();
        if (timeStart != null && appointmentMinutes < timeStart) {
          return false;
        }

        if (timeEnd != null && appointmentMinutes > timeEnd) {
          return false;
        }

        return true;
      });
    };

    const renderAppointmentsFromDb = async () => {
      try {
        // Fetch appointments from database for this doctor
        const response = await apiFetch('/appointments');
        if (!response.ok) {
          doctorCalendar.setEmptyState('Không thể tải lịch hẹn. Vui lòng thử lại.');
          return;
        }

        const payload = await toJson(response, { data: [] });
        const appointments = Array.isArray(payload?.data) ? payload.data : [];
        
        // Filter only confirmed appointments (đã_xác_nhận)
        const confirmedAppointments = appointments.filter((item) => item.status === 'đã_xác_nhận');
        const filteredAppointments = applyTimeFilter(confirmedAppointments);
        updateFilterResult(filteredAppointments.length, confirmedAppointments.length);

        if (confirmedAppointments.length === 0) {
          doctorCalendar.setEmptyState('Không có lịch hẹn nào.');
          return;
        }

        if (filteredAppointments.length === 0) {
          doctorCalendar.setEmptyState('Không có lịch hẹn phù hợp bộ lọc thời gian.');
          return;
        }

        const statusMap = {
          'chưa_thanh_toán': 'Chưa thanh toán',
          'chờ_xác_nhận': 'Chờ xác nhận',
          'đã_xác_nhận': 'Đã xác nhận',
          'đã_huỷ': 'Đã huỷ'
        };

        const events = filteredAppointments
          .map((item) => {
            const appointmentDateObj = item.appointmentDate ? new Date(item.appointmentDate) : null;
            if (!appointmentDateObj || Number.isNaN(appointmentDateObj.getTime())) {
              return null;
            }

            const durationMinutes = Number(item.durationMinutes) || 30;
            const endDate = new Date(appointmentDateObj.getTime() + durationMinutes * 60000);
            return {
              id: item.id,
              reference: item.id,
              status: item.status,
              statusLabel: statusMap[item.status] || item.status,
              title: normalizeMedicalLabel(item.title || 'Lịch khám'),
              description: normalizeAppointmentText(item.description || 'Không có mô tả'),
              personLabel: item.patientName || 'Chưa cập nhật bệnh nhân',
              contactLabel: item.patientPhone || 'Chưa cập nhật',
              specialtyLabel: normalizeMedicalLabel(item.title || ''),
              location: item.appointmentLocation || 'Chưa xác định',
              durationLabel: `${durationMinutes} phút`,
              createdAtLabel: formatDateTimeVi(item.createdAt),
              updatedAtLabel: formatDateTimeVi(item.updatedAt),
              start: appointmentDateObj,
              end: endDate,
              actions: [
                {
                  key: 'complete',
                  label: 'Hoàn thành lịch hẹn',
                  className: 'btn-complete',
                  confirmText: 'Xác nhận đã hoàn thành lịch hẹn này? Lịch hẹn sẽ bị xoá khỏi hệ thống.'
                }
              ]
            };
          })
          .filter(Boolean);

        doctorCalendar.setEvents(events);
      } catch (error) {
        doctorCalendar.setEmptyState(`Lỗi: ${error.message}`);
      }
    };

    [dateFromInput, dateToInput, timeFromInput, timeToInput].forEach((input) => {
      input?.addEventListener('change', renderAppointmentsFromDb);
    });

    resetFilterBtn?.addEventListener('click', () => {
      if (dateFromInput) {
        dateFromInput.value = '';
      }
      if (dateToInput) {
        dateToInput.value = '';
      }
      if (timeFromInput) {
        timeFromInput.value = '';
      }
      if (timeToInput) {
        timeToInput.value = '';
      }

      renderAppointmentsFromDb();
    });

    // Load appointments from database
    renderAppointmentsFromDb();
  };

  const setupDoctorProfilePage = () => {
    const isDoctorProfilePage = window.location.pathname.includes('/doctor/profile.html');
    const profileCard = document.getElementById('doctor-profile-card');
    if (!isDoctorProfilePage || !profileCard) {
      return;
    }

    const doctorName = document.getElementById('doctor-name');
    const doctorSpecialty = document.getElementById('doctor-specialty');
    const doctorRatingStars = document.getElementById('doctor-rating-stars');
    const doctorRatingValue = document.getElementById('doctor-rating-value');
    const doctorFeaturedPill = document.getElementById('doctor-featured-pill');
    const doctorAvatar = profileCard.querySelector('.doctor-avatar');
    const doctorAvatarInput = document.getElementById('doctor-avatar-input');
    const doctorAvatarSave = document.getElementById('doctor-avatar-save');
    const doctorAvatarMessage = document.getElementById('doctor-avatar-message');
    const doctorPhoneInput = document.getElementById('doctor-phone-input');
    const doctorPhoneSave = document.getElementById('doctor-phone-save');
    const doctorPhoneMessage = document.getElementById('doctor-phone-message');
    const confirmedCount = document.getElementById('doctor-confirmed-count');
    const unconfirmedCount = document.getElementById('doctor-unconfirmed-count');
    const pendingConfirmedCount = document.getElementById('doctor-pending-confirmed-count');
    const experienceYears = document.getElementById('doctor-experience-years');

    const toStars = (rating) => {
      const rounded = Math.round(Number(rating) || 0);
      const full = Math.max(0, Math.min(5, rounded));
      return '★'.repeat(full) + '☆'.repeat(5 - full);
    };

    const toSeed = (input) => {
      let hash = 0;
      const text = String(input || '');
      for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
      }
      return hash;
    };

    const buildFallbackAvatar = (name, doctorId, genderValue) => {
      const seed = toSeed(`${doctorId || ''}:${name || ''}`);
      const normalizedGender = String(genderValue || '').toLowerCase();
      const gender = normalizedGender === 'female' ? 'women' : 'men';
      const index = (seed % 90) + 1;
      return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
    };

    let selectedAvatarDataUrl = '';

    const setAvatar = (avatarUrl, name = '', doctorId = '', gender = 'male') => {
      if (!doctorAvatar) {
        return;
      }

      const safeUrl = String(avatarUrl || '').trim() || buildFallbackAvatar(name, doctorId, gender);
      if (!safeUrl) {
        doctorAvatar.style.backgroundImage = '';
        doctorAvatar.classList.remove('has-image');
        return;
      }

      doctorAvatar.style.backgroundImage = `url("${safeUrl.replaceAll('"', '\\"')}")`;
      doctorAvatar.classList.add('has-image');
    };

    const setAvatarMessage = (text, type = '') => {
      if (!doctorAvatarMessage) {
        return;
      }

      doctorAvatarMessage.textContent = text;
      doctorAvatarMessage.classList.remove('success', 'error');
      if (type === 'success' || type === 'error') {
        doctorAvatarMessage.classList.add(type);
      }
    };

    const resizeImageToDataUrl = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => reject(new Error('Không thể đọc ảnh đã chọn.'));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('Định dạng ảnh không hợp lệ.'));
          img.onload = () => {
            const MAX_SIZE = 360;
            const canvas = document.createElement('canvas');
            const ratio = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height, 1);
            canvas.width = Math.max(1, Math.round(img.width * ratio));
            canvas.height = Math.max(1, Math.round(img.height * ratio));
            const context = canvas.getContext('2d');
            if (!context) {
              reject(new Error('Không thể xử lý ảnh.'));
              return;
            }

            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.86));
          };

          img.src = String(reader.result || '');
        };

        reader.readAsDataURL(file);
      });

    const render = async () => {
      try {
        const response = await apiFetch('/doctors/me/profile');
        if (!response.ok) {
          profileCard.innerHTML = '<p class="empty-state">Không thể tải hồ sơ bác sĩ.</p>';
          return;
        }

        const payload = await toJson(response, { data: {} });
        const data = payload?.data || {};

        if (doctorName) {
          doctorName.textContent = data.name || 'Bác sĩ';
        }
        if (doctorSpecialty) {
          const doctorGenderLabel = String(data.gender || '').toLowerCase() === 'female' ? 'Nữ' : 'Nam';
          doctorSpecialty.textContent = `${data.specialty || 'Chuyên khoa'} · ${doctorGenderLabel}`;
        }
        if (doctorRatingStars) {
          doctorRatingStars.textContent = toStars(data.rating);
        }
        if (doctorRatingValue) {
          doctorRatingValue.textContent = `${Number(data.rating || 0).toFixed(1)}/5`;
        }
        setAvatar(data.avatarUrl || '', data.name || '', data.doctorId || '', data.gender || 'male');

        if (doctorFeaturedPill) {
          doctorFeaturedPill.textContent = data.isFeatured ? 'Bác sĩ VIP' : 'Chưa VIP';
          doctorFeaturedPill.classList.toggle('is-active', Boolean(data.isFeatured));
        }
        if (doctorPhoneInput) {
          doctorPhoneInput.value = data.phone || '';
        }

        if (confirmedCount) {
          confirmedCount.textContent = String(Number(data.confirmedAppointments || 0));
        }
        if (unconfirmedCount) {
          unconfirmedCount.textContent = String(Number(data.unconfirmedAppointments || 0));
        }
        if (pendingConfirmedCount) {
          pendingConfirmedCount.textContent = String(Number(data.pendingConfirmedAppointments || 0));
        }
        if (experienceYears) {
          experienceYears.textContent = `${Number(data.experienceYears || 0)} năm`;
        }
      } catch (_error) {
        profileCard.innerHTML = '<p class="empty-state">Không thể tải hồ sơ bác sĩ.</p>';
      }
    };

    const setPhoneMessage = (text, type = '') => {
      if (!doctorPhoneMessage) {
        return;
      }

      doctorPhoneMessage.textContent = text;
      doctorPhoneMessage.classList.remove('success', 'error');
      if (type === 'success' || type === 'error') {
        doctorPhoneMessage.classList.add(type);
      }
    };

    const savePhone = async () => {
      if (!doctorPhoneInput || !doctorPhoneSave) {
        return;
      }

      const phone = doctorPhoneInput.value.trim();
      if (!phone) {
        setPhoneMessage('Vui lòng nhập số điện thoại.', 'error');
        return;
      }

      doctorPhoneSave.disabled = true;
      setPhoneMessage('Đang lưu...');

      try {
        const response = await apiFetch('/doctors/me/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phone })
        });

        const result = await toJson(response, {});
        if (!response.ok) {
          setPhoneMessage(result?.message || 'Không thể cập nhật số điện thoại.', 'error');
          return;
        }

        setPhoneMessage('Đã cập nhật số điện thoại.', 'success');
      } catch (_error) {
        setPhoneMessage('Không thể cập nhật số điện thoại.', 'error');
      } finally {
        doctorPhoneSave.disabled = false;
      }
    };

    const saveAvatar = async () => {
      if (!doctorAvatarSave) {
        return;
      }

      if (!selectedAvatarDataUrl) {
        setAvatarMessage('Vui lòng chọn ảnh đại diện trước khi lưu.', 'error');
        return;
      }

      doctorAvatarSave.disabled = true;
      setAvatarMessage('Đang lưu ảnh đại diện...');

      try {
        const response = await apiFetch('/doctors/me/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ avatarUrl: selectedAvatarDataUrl })
        });

        const result = await toJson(response, {});
        if (!response.ok) {
          setAvatarMessage(result?.message || 'Không thể cập nhật ảnh đại diện.', 'error');
          return;
        }

        setAvatar(selectedAvatarDataUrl);
        selectedAvatarDataUrl = '';
        if (doctorAvatarInput) {
          doctorAvatarInput.value = '';
        }
        setAvatarMessage('Đã cập nhật ảnh đại diện.', 'success');
      } catch (_error) {
        setAvatarMessage('Không thể cập nhật ảnh đại diện.', 'error');
      } finally {
        doctorAvatarSave.disabled = false;
      }
    };

    doctorPhoneSave?.addEventListener('click', savePhone);
    doctorAvatarInput?.addEventListener('change', async () => {
      const file = doctorAvatarInput.files?.[0];
      if (!file) {
        selectedAvatarDataUrl = '';
        return;
      }

      if (!file.type.startsWith('image/')) {
        selectedAvatarDataUrl = '';
        setAvatarMessage('Chỉ chấp nhận tệp ảnh.', 'error');
        return;
      }

      try {
        selectedAvatarDataUrl = await resizeImageToDataUrl(file);
        setAvatar(selectedAvatarDataUrl);
        setAvatarMessage('Ảnh đã sẵn sàng. Nhấn "Lưu ảnh đại diện" để cập nhật.', 'success');
      } catch (error) {
        selectedAvatarDataUrl = '';
        setAvatarMessage(error.message || 'Không thể xử lý ảnh đã chọn.', 'error');
      }
    });
    doctorAvatarSave?.addEventListener('click', saveAvatar);

    render();
  };

  const setupUserAppointmentsPage = () => {
    const appointmentsList = document.querySelector('.appointments-list');
    const isUserAppointments = window.location.pathname.includes('/user/my-appointments.html');
    if (!appointmentsList || !isUserAppointments) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      const appointmentId = String(urlParams.get('appointmentId') || '').trim();
      const message = appointmentId
        ? `Thanh toán thành công cho lịch hẹn ${appointmentId.substring(0, 8)}...`
        : 'Thanh toán thành công.';
      window.setTimeout(() => alert(message), 0);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const userCalendar = createCalendarRenderer(appointmentsList, {
      emptyMessage: 'Bạn chưa có lịch hẹn nào.',
      onAction: async ({ appointmentId, action }) => {
        if (action === 'cancel') {
          await handleCancelAppointment(appointmentId, renderAppointmentsFromDb);
          return;
        }
        if (action === 'delete') {
          await handleDeleteCancelledAppointment(appointmentId, renderAppointmentsFromDb);
          return;
        }
        if (action === 'pay') {
          await handlePayAppointment(appointmentId);
        }
      }
    });

    const statusMap = {
      'chưa_thanh_toán': 'Chưa thanh toán',
      'chờ_xác_nhận': 'Chờ xác nhận',
      'đã_xác_nhận': 'Đã xác nhận',
      'đã_huỷ': 'Đã huỷ'
    };

    const getRefundLabel = (appointment) => {
      if (String(appointment?.status || '') !== 'đã_huỷ') {
        return '';
      }

      const refundId = String(appointment?.id || '').trim();
      if (refundId && paidRefundIds.has(refundId)) {
        return 'Đã hoàn tiền';
      }

      return formatCurrency(appointment?.consultationFee || 0);
    };

    const getRefundClassName = (appointment) => {
      if (String(appointment?.status || '') !== 'đã_huỷ') {
        return '';
      }

      const refundId = String(appointment?.id || '').trim();
      return refundId && paidRefundIds.has(refundId) ? 'is-paid' : 'is-unpaid';
    };

    const toActions = (statusValue) => {
      if (statusValue === 'chưa_thanh_toán') {
        return [
          {
            key: 'cancel',
            label: 'Huỷ lịch hẹn',
            className: 'btn-cancel',
            confirmText: 'Bạn chắc chắn muốn huỷ lịch hẹn này?'
          },
          {
            key: 'pay',
            label: 'Thanh toán ngay',
            className: 'btn-payment'
          }
        ];
      }

      if (statusValue === 'đã_huỷ') {
        return [
          {
            key: 'delete',
            label: 'Xoá lịch hẹn',
            className: 'btn-cancel',
            confirmText: 'Bạn chắc chắn muốn xoá lịch hẹn đã huỷ này?'
          }
        ];
      }

      return [];
    };

    const renderAppointmentsFromDb = async () => {
      try {
        // Fetch appointments from database
        const response = await apiFetch('/appointments');
        if (!response.ok) {
          userCalendar.setEmptyState('Không thể tải lịch hẹn. Vui lòng thử lại.');
          return;
        }

        const payload = await toJson(response, { data: [] });
        const appointments = Array.isArray(payload?.data) ? payload.data : [];

        if (appointments.length === 0) {
          userCalendar.setEmptyState('Bạn chưa có lịch hẹn nào.');
          return;
        }

        const events = appointments
          .map((item) => {
            const appointmentDateObj = item.appointmentDate ? new Date(item.appointmentDate) : null;
            if (!appointmentDateObj || Number.isNaN(appointmentDateObj.getTime())) {
              return null;
            }

            const durationMinutes = Number(item.durationMinutes) || 30;
            const endDate = new Date(appointmentDateObj.getTime() + durationMinutes * 60000);
            const specialtyDisplay = item.specialtyName ? normalizeMedicalLabel(item.specialtyName) : 'Chuyên khoa';
            const doctorDisplay = item.doctorName || 'Chưa xác định';
            const doctorGenderDisplay = String(item.doctorGender || '').toLowerCase() === 'female' ? 'Nữ' : 'Nam';
            const refundLabel = getRefundLabel(item);
            return {
              id: item.id,
              reference: item.id,
              status: item.status,
              statusLabel: statusMap[item.status] || item.status,
              refundLabel,
              refundClassName: getRefundClassName(item),
              title: normalizeMedicalLabel(item.title || 'Lịch khám') || 'Lịch khám',
              description: normalizeAppointmentText(item.description || 'Không có mô tả thêm'),
              personLabel: `${doctorDisplay} (${doctorGenderDisplay}) · ${specialtyDisplay}`,
              contactLabel: item.doctorPhone || 'Chưa cập nhật',
              specialtyLabel: specialtyDisplay,
              location: item.appointmentLocation || 'Không xác định',
              durationLabel: `${durationMinutes} phút`,
              createdAtLabel: formatDateTimeVi(item.createdAt),
              updatedAtLabel: formatDateTimeVi(item.updatedAt),
              start: appointmentDateObj,
              end: endDate,
              actions: toActions(item.status)
            };
          })
          .filter(Boolean);

        userCalendar.setEvents(events);
      } catch (error) {
        userCalendar.setEmptyState(`Lỗi: ${error.message}`);
      }
    };

      // Handle cancel appointment
      const handleCancelAppointment = async (appointmentId, refresh) => {
        try {
          const deleteRes = await apiFetch(`/appointments/${appointmentId}`, {
            method: 'DELETE'
          });

          if (!deleteRes.ok) {
            const errorData = await toJson(deleteRes, {});
            alert(errorData.message || 'Không thể xoá lịch hẹn. Vui lòng thử lại.');
            return;
          }

          alert('Đã xoá lịch hẹn thành công.');
          refresh();
        } catch (error) {
          alert('Lỗi: ' + error.message);
        }
      };

      const handleDeleteCancelledAppointment = async (appointmentId, refresh) => {
        try {
          const deleteRes = await apiFetch(`/appointments/${appointmentId}`, {
            method: 'DELETE'
          });

          if (!deleteRes.ok) {
            const errorData = await toJson(deleteRes, {});
            alert(errorData.message || 'Không thể xoá lịch hẹn. Vui lòng thử lại.');
            return;
          }

          alert('Đã xoá lịch hẹn thành công.');
          refresh();
        } catch (error) {
          alert('Lỗi: ' + error.message);
        }
      };

      // Handle pay appointment - redirect to checkout
      const handlePayAppointment = async (appointmentId) => {
        try {
          // Fetch appointment details
          const appointmentsRes = await apiFetch('/appointments');
          if (!appointmentsRes.ok) {
            alert('Không thể tải thông tin lịch hẹn.');
            return;
          }

          const appointmentsData = await toJson(appointmentsRes, { data: [] });
          const appointments = Array.isArray(appointmentsData?.data) ? appointmentsData.data : [];
          const appointment = appointments.find((a) => a.id === appointmentId);

          if (!appointment) {
            alert('Không tìm thấy lịch hẹn.');
            return;
          }

          let appointmentDateLabel = 'Chưa cập nhật ngày khám';
          let startTime = '13:00';
          const appointmentDateObj = appointment.appointmentDate ? new Date(appointment.appointmentDate) : null;

          if (appointmentDateObj && !Number.isNaN(appointmentDateObj.getTime())) {
            appointmentDateLabel = appointmentDateObj.toLocaleDateString('vi-VN');
            startTime = appointmentDateObj.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
          } else {
            const [legacyDatePart = '', legacyTimePart = ''] = String(appointment.appointmentDate || '').split(' ');
            if (legacyDatePart.includes('-')) {
              appointmentDateLabel = formatDateFromInput(legacyDatePart);
            }
            if (legacyTimePart.includes(':')) {
              startTime = legacyTimePart.slice(0, 5);
            }
          }

          // Build draft data
          const draft = {
            appointmentId: appointment.id,
            title: normalizeMedicalLabel(appointment.title || `Khám ${appointment.specialtyName || ''}`).trim(),
            doctorName: appointment.doctorName,
            specialty: normalizeMedicalLabel(appointment.specialtyName || ''),
            location: appointment.appointmentLocation,
            date: appointmentDateLabel,
            timeRange: buildTimeRangeFromDuration(startTime, appointment.durationMinutes || 30),
            amount: Number(appointment.consultationFee || 0),
            desc: appointment.description || `Lịch khám ${normalizeMedicalLabel(appointment.specialtyName || '')}`
          };

          // Save draft and redirect to checkout
          await setDraft(draft);
          window.location.href = './checkout.html';
        } catch (error) {
          alert('Lỗi: ' + error.message);
        }
      };

    // Load appointments from database
    renderAppointmentsFromDb();

  };

  const bootstrap = async () => {
    const hasValidRole = await ensureRoleForCurrentPage();
    if (!hasValidRole) {
      return;
    }

    try {
      await getProfileFromDb();
    } catch (_error) {
      // continue with default profile
    }

    try {
      await loadDbState();
    } catch (_error) {
      // state APIs unavailable
    }

    try {
      await loadPaidRefundIds();
    } catch (_error) {
      // refund status API unavailable
    }

    await setupSettingsPage();
    setupCreateAppointmentPage();
    setupCheckoutPage();
    setupDoctorRequestsPage();
    setupDoctorAppointmentsPage();
    setupDoctorProfilePage();
    setupUserAppointmentsPage();
  };

  bootstrap();
})();
