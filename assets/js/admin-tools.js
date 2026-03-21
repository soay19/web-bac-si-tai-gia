(function () {
  const KEYS = {
    specialties: 'thatClinicSpecialties',
    pending: 'thatClinicPendingRequests',
    confirmed: 'thatClinicConfirmedAppointments',
    refunds: 'thatClinicRefundNotices',
    paidRefunds: 'thatClinicPaidRefunds',
    doctors: 'thatClinicDoctors'
  };

  const defaultSpecialties = ['Tổng quát', 'Nhi khoa', 'Dinh dưỡng', 'Tim mạch', 'Da liễu', 'Chỉnh hình'];
  const defaultDoctors = [
    { id: 'd1', name: 'BS. Nguyễn Minh Anh', specialty: 'Tổng quát' },
    { id: 'd2', name: 'BS. Đặng Tuấn Kiệt', specialty: 'Nhi khoa' },
    { id: 'd3', name: 'BS. Lê Thanh Hà', specialty: 'Dinh dưỡng' },
    { id: 'd4', name: 'BS. Trần Đức Minh', specialty: 'Tim mạch' },
    { id: 'd5', name: 'BS. Vũ Thị Yến', specialty: 'Da liễu' },
    { id: 'd6', name: 'BS. Hoàng Minh Tuấn', specialty: 'Chỉnh hình' }
  ];

  const parse = (value, fallback) => {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  };

  const formatCurrency = (amount) => `${new Intl.NumberFormat('vi-VN').format(Number(amount) || 0)}đ`;

  const getSpecialties = () => {
    const stored = parse(localStorage.getItem(KEYS.specialties), null);
    if (stored && Array.isArray(stored) && stored.length) {
      return stored;
    }
    localStorage.setItem(KEYS.specialties, JSON.stringify(defaultSpecialties));
    return defaultSpecialties;
  };

  const setSpecialties = (list) => {
    localStorage.setItem(KEYS.specialties, JSON.stringify(list));
  };

  const getDoctors = () => {
    const stored = parse(localStorage.getItem(KEYS.doctors), null);
    if (stored && Array.isArray(stored) && stored.length) {
      return stored;
    }
    localStorage.setItem(KEYS.doctors, JSON.stringify(defaultDoctors));
    return defaultDoctors;
  };

  const setDoctors = (list) => {
    localStorage.setItem(KEYS.doctors, JSON.stringify(list));
  };

  const setupSpecialtiesPage = () => {
    const form = document.getElementById('specialty-form');
    const input = document.getElementById('specialty-name');
    const listNode = document.getElementById('specialty-list');

    if (!form || !input || !listNode) {
      return;
    }

    const render = () => {
      const specialties = getSpecialties();
      listNode.innerHTML = specialties
        .map(
          (name, index) =>
            `<div class="chip"><span>${name}</span><button type="button" data-index="${index}" aria-label="Xóa chuyên khoa">×</button></div>`
        )
        .join('');

      listNode.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-index'));
          const updated = getSpecialties().filter((_, i) => i !== idx);
          setSpecialties(updated.length ? updated : defaultSpecialties);
          render();
        });
      });
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) {
        return;
      }

      const specialties = getSpecialties();
      if (specialties.some((item) => item.toLowerCase() === value.toLowerCase())) {
        alert('Chuyên khoa này đã tồn tại.');
        return;
      }

      setSpecialties([...specialties, value]);
      input.value = '';
      render();
    });

    render();
  };

  const setupViewAppointmentsPage = () => {
    const tbody = document.getElementById('appointments-table-body');
    const refundModal = document.getElementById('refund-modal');
    const refundCloseBtn = document.getElementById('refund-modal-close');
    const refundCancelBtn = document.getElementById('refund-cancel');
    const refundConfirmBtn = document.getElementById('refund-confirm');

    if (!tbody) {
      return;
    }

    let currentRefundId = null;

    const getPaidRefunds = () => {
      return parse(localStorage.getItem(KEYS.paidRefunds), []);
    };

    const setPaidRefunds = (list) => {
      localStorage.setItem(KEYS.paidRefunds, JSON.stringify(list));
    };

    const isRefundPaid = (refundId) => {
      return getPaidRefunds().includes(refundId);
    };

    const markRefundAsPaid = (refundId) => {
      const paidRefunds = getPaidRefunds();
      if (!paidRefunds.includes(refundId)) {
        paidRefunds.push(refundId);
        setPaidRefunds(paidRefunds);
      }
    };

    const closeRefundModal = () => {
      refundModal.hidden = true;
      currentRefundId = null;
    };

    const openRefundModal = (refundData) => {
      currentRefundId = refundData.refundId;
      document.getElementById('refund-amount').textContent = formatCurrency(refundData.amount);
      document.getElementById('refund-user').textContent = refundData.userName;
      document.getElementById('refund-bank').textContent = refundData.bankName;
      document.getElementById('refund-account').textContent = refundData.bankAccount;
      refundModal.hidden = false;
    };

    const render = () => {
      const pending = parse(localStorage.getItem(KEYS.pending), []).map((item) => ({ ...item, status: 'Đang chờ xác nhận' }));
      const confirmed = parse(localStorage.getItem(KEYS.confirmed), []).map((item) => ({ ...item, status: 'Đã xác nhận' }));
      const rejected = parse(localStorage.getItem(KEYS.refunds), []).map((item, index) => ({
        refundId: item.id || `refund-${index}`,
        title: item.title || 'Lịch hẹn đã hủy',
        doctorName: item.doctorName || 'BS. Chưa cập nhật',
        date: item.date || 'Chưa cập nhật',
        location: item.location || 'Chưa cập nhật',
        amount: Number(item.amount) || 0,
        bankName: item.bankName || 'Chưa cập nhật',
        bankAccount: item.bankAccount || 'Chưa cập nhật',
        userName: item.userName || 'Chưa cập nhật',
        status: 'Đã hủy'
      }));

      const all = [...pending, ...confirmed, ...rejected];

      if (!all.length) {
        tbody.innerHTML = '<tr><td colspan="6">Chưa có lịch hẹn để hiển thị.</td></tr>';
        return;
      }

      tbody.innerHTML = all
        .map((item) => {
          const statusClass = item.status === 'Đã xác nhận' ? 'status-confirmed' : item.status === 'Đã hủy' ? 'status-rejected' : 'status-pending';
          let refundDisplay = '--';

          if (item.status === 'Đã xác nhận') {
            refundDisplay = '0đ';
          } else if (item.status === 'Đã hủy') {
            const isPaid = isRefundPaid(item.refundId);
            if (isPaid) {
              refundDisplay = '<span class="refund-paid">Đã hoàn tiền</span>';
            } else {
              refundDisplay = `<button type="button" class="refund-trigger" data-refund-id="${item.refundId}">${formatCurrency(item.amount)}</button>`;
            }
          }

          return `
            <tr>
              <td>${item.title || 'Lịch hẹn'}</td>
              <td>${item.doctorName || 'BS. Chưa cập nhật'}</td>
              <td>${item.date || 'Chưa cập nhật'}</td>
              <td>${item.location || 'Chưa cập nhật'}</td>
              <td><span class="status-pill ${statusClass}">${item.status}</span></td>
              <td>${refundDisplay}</td>
            </tr>
          `;
        })
        .join('');

      const canceledItemsById = Object.fromEntries(
        rejected.map((item) => [item.refundId, item])
      );

      tbody.querySelectorAll('.refund-trigger').forEach((button) => {
        button.addEventListener('click', () => {
          const refundId = button.getAttribute('data-refund-id');
          const selected = refundId ? canceledItemsById[refundId] : null;
          if (!selected) {
            return;
          }
          openRefundModal(selected);
        });
      });
    };

    if (refundCloseBtn) {
      refundCloseBtn.addEventListener('click', closeRefundModal);
    }

    if (refundCancelBtn) {
      refundCancelBtn.addEventListener('click', closeRefundModal);
    }

    if (refundConfirmBtn) {
      refundConfirmBtn.addEventListener('click', () => {
        if (currentRefundId) {
          markRefundAsPaid(currentRefundId);
          closeRefundModal();
          render();
        }
      });
    }

    if (refundModal) {
      refundModal.addEventListener('click', (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.getAttribute('data-close-modal') === 'true') {
          closeRefundModal();
        }
      });
    }

    render();
  };

  const setupEditDoctorsPage = () => {
    const sectionsRoot = document.getElementById('doctor-edit-sections');
    const specialtyNav = document.getElementById('doctor-edit-specialty-nav');
    const searchInput = document.getElementById('doctor-edit-search');
    const searchButton = document.getElementById('doctor-edit-search-btn');
    const modal = document.getElementById('doctor-edit-modal');
    const closeButton = document.getElementById('doctor-edit-close');
    const form = document.getElementById('doctor-edit-form');
    const nameInput = document.getElementById('doctor-edit-name');
    const specialtySelect = document.getElementById('doctor-edit-specialty');

    if (!sectionsRoot || !specialtyNav || !searchInput || !searchButton || !modal || !closeButton || !form || !nameInput || !specialtySelect) {
      return;
    }

    const escapeHtml = (value) =>
      String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const toSlug = (value) =>
      String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const getRating = (index) => (index % 3 === 0 ? '★★★★★' : '★★★★☆');
    const getReviewCount = (index) => 85 + index * 7;
    const getExperience = (index) => 6 + (index % 10);

    let selectedDoctorId = null;

    const closeModal = () => {
      modal.hidden = true;
      selectedDoctorId = null;
    };

    const openModal = (doctor) => {
      const specialties = getSpecialties();
      const mergedSpecialties = specialties.includes(doctor.specialty)
        ? specialties
        : [...specialties, doctor.specialty];

      specialtySelect.innerHTML = mergedSpecialties
        .map((specialty) => `<option value="${escapeHtml(specialty)}" ${specialty === doctor.specialty ? 'selected' : ''}>${escapeHtml(specialty)}</option>`)
        .join('');

      selectedDoctorId = doctor.id;
      nameInput.value = doctor.name;
      modal.hidden = false;
    };

    const render = () => {
      const keyword = searchInput.value.trim().toLowerCase();
      const doctors = getDoctors();
      const configuredSpecialties = getSpecialties();
      const doctorSpecialties = [...new Set(doctors.map((doctor) => doctor.specialty))];
      const specialtyOrder = [...configuredSpecialties, ...doctorSpecialties.filter((item) => !configuredSpecialties.includes(item))];

      const filteredDoctors = doctors.filter((doctor) => {
        if (!keyword) {
          return true;
        }

        return doctor.name.toLowerCase().includes(keyword) || doctor.specialty.toLowerCase().includes(keyword);
      });

      if (filteredDoctors.length === 0) {
        specialtyNav.innerHTML = '';
        sectionsRoot.innerHTML = '<p class="empty-text">Không tìm thấy bác sĩ phù hợp.</p>';
        return;
      }

      const groupedBySpecialty = specialtyOrder
        .map((specialty) => ({
          specialty,
          doctors: filteredDoctors.filter((doctor) => doctor.specialty === specialty)
        }))
        .filter((group) => group.doctors.length > 0);

      specialtyNav.innerHTML = groupedBySpecialty
        .map((group) => `<a href="#${toSlug(group.specialty)}" class="specialty-link">${escapeHtml(group.specialty)}</a>`)
        .join('');

      sectionsRoot.innerHTML = groupedBySpecialty
        .map((group) => {
          const cards = group.doctors
            .map((doctor, index) => `
              <div class="doctor-card" data-doctor-id="${doctor.id}">
                <div class="doctor-image">
                  <div class="image-placeholder"></div>
                  <span class="specialty-badge">${escapeHtml(doctor.specialty)}</span>
                </div>
                <div class="doctor-info">
                  <h3 class="doctor-name">${escapeHtml(doctor.name)}</h3>
                  <p class="doctor-specialty">${escapeHtml(doctor.specialty)}</p>
                  <div class="doctor-rating">
                    <span class="stars">${getRating(index)}</span>
                    <span class="rating-count">(${getReviewCount(index)} đánh giá)</span>
                  </div>
                  <p class="doctor-experience">Kinh nghiệm: ${getExperience(index)} năm</p>
                  <button type="button" class="btn btn-book doctor-edit-trigger">Sửa bác sĩ</button>
                </div>
              </div>
            `)
            .join('');

          return `
            <section class="specialty-section" id="${toSlug(group.specialty)}">
              <h3 class="specialty-heading">${escapeHtml(group.specialty)}</h3>
              <div class="doctors-grid">${cards}</div>
            </section>
          `;
        })
        .join('');

      sectionsRoot.querySelectorAll('.doctor-edit-trigger').forEach((button) => {
        button.addEventListener('click', () => {
          const card = button.closest('.doctor-card');
          const doctorId = card?.getAttribute('data-doctor-id');
          if (!doctorId) {
            return;
          }

          const doctor = getDoctors().find((item) => item.id === doctorId);
          if (!doctor) {
            return;
          }

          openModal(doctor);
        });
      });
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!selectedDoctorId) {
        return;
      }

      const newName = nameInput.value.trim();
      const newSpecialty = specialtySelect.value.trim();

      if (!newName || !newSpecialty) {
        alert('Vui lòng nhập tên và chọn chuyên khoa.');
        return;
      }

      const updatedDoctors = getDoctors().map((doctor) =>
        doctor.id === selectedDoctorId ? { ...doctor, name: newName, specialty: newSpecialty } : doctor
      );

      setDoctors(updatedDoctors);
      closeModal();
      render();
      alert('Đã cập nhật thông tin bác sĩ.');
    });

    closeButton.addEventListener('click', closeModal);

    modal.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.getAttribute('data-close-modal') === 'true') {
        closeModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) {
        closeModal();
      }
    });

    searchInput.addEventListener('input', render);
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        render();
      }
    });

    searchButton.addEventListener('click', render);

    render();
  };

  setupSpecialtiesPage();
  setupViewAppointmentsPage();
  setupEditDoctorsPage();
})();
