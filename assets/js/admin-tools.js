(function () {
  const API_BASE =
    window.THAT_CLINIC_API_BASE ||
    `${window.location.protocol}//${window.location.hostname}:3000/api`;

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

  const normalizeAppointmentText = (value) =>
    String(value || '')
      .replace(/\bLich\s+kham\b/gi, 'Lịch khám')
      .replace(/\bKham\b/gi, 'Khám')
      .trim();

  const escapeAttr = (value) =>
    String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');

  const toSeed = (input) => {
    let hash = 0;
    const text = String(input || '');
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
  };

  const normalizeName = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();

  const inferGenderByName = (name) => {
    const normalized = normalizeName(name).replace(/\b(bs\.?|dr\.?|bac\s*si)\b/g, '').trim();
    if (!normalized) {
      return 'male';
    }

    if (/\bthi\b/.test(normalized)) {
      return 'female';
    }

    const femaleHints = new Set([
      'anh', 'chi', 'duyen', 'ha', 'hang', 'hien', 'huong', 'khanh', 'lan', 'linh', 'mai', 'my',
      'ngoc', 'nhung', 'phuong', 'quynh', 'thao', 'thu', 'thuy', 'trang', 'trinh', 'vy', 'yen'
    ]);
    const parts = normalized.split(/\s+/).filter(Boolean);
    const last = parts[parts.length - 1] || '';
    return femaleHints.has(last) ? 'female' : 'male';
  };

  const getDoctorGender = (doctor) => {
    const apiGender = String(doctor?.gender || '').trim().toLowerCase();
    if (apiGender === 'female' || apiGender === 'male') {
      return apiGender;
    }
    return inferGenderByName(doctor?.name || '');
  };

  const toGenderLabel = (gender) => (gender === 'female' ? 'Nữ' : 'Nam');

  const getDoctorKey = (doctor) => String(doctor?.id || doctor?.name || 'unknown');

  const getInitials = (name) => {
    const cleaned = String(name || '').replace(/\b(bs\.?|dr\.?|bac\s*si)\b/gi, '').trim();
    if (!cleaned) {
      return 'BS';
    }

    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  };

  const buildInlineFallbackAvatar = (doctor) => {
    const initials = getInitials(doctor?.name || '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" rx="120" fill="#cbd5e1"/><text x="120" y="138" text-anchor="middle" fill="#475569" font-size="82" font-family="Arial, sans-serif" font-weight="700">${initials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const buildFallbackAvatar = (doctor) => {
    const seed = toSeed(`${doctor?.id || ''}:${doctor?.name || ''}`);
    const gender = getDoctorGender(doctor) === 'female' ? 'women' : 'men';
    const index = (seed % 99) + 1;
    return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
  };

  const buildUniqueFallbackAvatarMap = (doctors) => {
    const usedMen = new Set();
    const usedWomen = new Set();
    const map = new Map();

    doctors.forEach((doctor) => {
      if (String(doctor?.avatarUrl || '').trim()) {
        return;
      }

      const gender = getDoctorGender(doctor);
      const targetSet = gender === 'female' ? usedWomen : usedMen;
      const category = gender === 'female' ? 'women' : 'men';
      let index = (toSeed(`${doctor?.id || ''}:${doctor?.name || ''}`) % 99) + 1;
      let attempts = 0;
      while (targetSet.has(index) && attempts < 120) {
        index = (index % 99) + 1;
        attempts += 1;
      }

      targetSet.add(index);
      map.set(getDoctorKey(doctor), `https://randomuser.me/api/portraits/${category}/${index}.jpg`);
    });

    return map;
  };

  const renderDoctorAvatar = (doctor, fallbackMap) => {
    const doctorKey = getDoctorKey(doctor);
    const fallbackUrl = fallbackMap?.get(doctorKey) || buildFallbackAvatar(doctor);
    const avatarUrl = String(doctor?.avatarUrl || '').trim() || fallbackUrl;
    const inlineFallback = buildInlineFallbackAvatar(doctor);

    return `<img class="doctor-avatar-image" src="${escapeAttr(avatarUrl)}" alt="Ảnh đại diện ${escapeAttr(
      doctor?.name || 'bác sĩ'
    )}" loading="lazy" onerror="this.onerror=null;this.src='${escapeAttr(inlineFallback)}';">`;
  };

  const getSpecialties = () => defaultSpecialties;
  const setSpecialties = (_list) => {};
  const getDoctors = () => defaultDoctors;
  const setDoctors = (_list) => {};

  const setupSpecialtiesPage = () => {
    const form = document.getElementById('specialty-form');
    const input = document.getElementById('specialty-name');
    const descriptionInput = document.getElementById('specialty-description');
    const submitButton = form?.querySelector('button[type="submit"]');
    const cancelEditButton = document.getElementById('specialty-cancel-edit');
    const feedbackNode = document.getElementById('specialty-feedback');
    const listNode = document.getElementById('specialty-list');
    const apiBase = API_BASE;
    let editingSpecialtyId = null;

    if (!form || !input || !descriptionInput || !listNode) {
      return;
    }

    const escapeHtml = (value) =>
      String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const setFeedback = (message, type = 'success') => {
      if (!feedbackNode) {
        return;
      }
      feedbackNode.textContent = message;
      feedbackNode.style.color = type === 'error' ? '#b42318' : '#15803d';
    };

    const resetEditMode = () => {
      editingSpecialtyId = null;
      if (submitButton) {
        submitButton.textContent = 'Thêm chuyên khoa';
      }
      if (cancelEditButton) {
        cancelEditButton.hidden = true;
      }
      form.reset();
    };

    const enterEditMode = (specialty) => {
      editingSpecialtyId = specialty.id;
      input.value = specialty.name || '';
      descriptionInput.value = specialty.description || '';
      if (submitButton) {
        submitButton.textContent = 'Lưu chỉnh sửa';
      }
      if (cancelEditButton) {
        cancelEditButton.hidden = false;
      }
      setFeedback(`Đang chỉnh sửa chuyên khoa: ${specialty.name}`, 'success');
    };

    const normalizeSpecialty = (item, index) => {
      if (typeof item === 'string') {
        return {
          id: `local-${index}`,
          name: item,
          description: ''
        };
      }

      return {
        id: item?.id || `local-${index}`,
        name: String(item?.name || '').trim(),
        description: String(item?.description || '').trim()
      };
    };

    const syncSpecialtyNamesToLocal = (list) => {
      const names = list.map((item) => item.name).filter(Boolean);
      setSpecialties(names.length ? names : defaultSpecialties);
    };

    const fetchSpecialties = async () => {
      const response = await fetch(`${apiBase}/specialties`);
      if (!response.ok) {
        throw new Error('Cannot fetch specialties');
      }

      const payload = await response.json();
      return Array.isArray(payload?.data) ? payload.data.map(normalizeSpecialty) : [];
    };

    const render = (specialties) => {
      const countNode = document.getElementById('specialty-count');
      if (countNode) { countNode.textContent = String(specialties.length); }

      listNode.innerHTML = specialties
        .map(
          (item) => {
            const hasDbId = item.id && !String(item.id).startsWith('local-');
            return `<div class="sp-item">
              <div class="sp-item-icon">🩺</div>
              <div class="sp-item-content">
                <p class="sp-item-name">${escapeHtml(item.name)}</p>
                <p class="sp-item-desc">${item.description ? escapeHtml(item.description) : 'Chưa có mô tả'}</p>
              </div>
              ${hasDbId ? `<div class="sp-item-actions">
                <button type="button" class="sp-item-btn sp-btn-edit" data-edit-specialty-id="${escapeHtml(item.id)}" aria-label="Sửa chuyên khoa" title="Sửa">✏️</button>
                <button type="button" class="sp-item-btn sp-btn-delete" data-delete-specialty-id="${escapeHtml(item.id)}" aria-label="Xóa chuyên khoa" title="Xóa">🗑️</button>
              </div>` : ''}
            </div>`;
          }
        )
        .join('');

      if (!specialties.length) {
        listNode.innerHTML = '<div class="sp-empty">Chưa có chuyên khoa nào.</div>';
        return;
      }

      listNode.querySelectorAll('button[data-delete-specialty-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const specialtyId = btn.getAttribute('data-delete-specialty-id');
          if (!specialtyId) {
            return;
          }

          try {
            const response = await fetch(`${apiBase}/specialties/${encodeURIComponent(specialtyId)}`, {
              method: 'DELETE'
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              setFeedback(payload?.message || 'Không thể xoá chuyên khoa.', 'error');
              return;
            }

            if (editingSpecialtyId === specialtyId) {
              resetEditMode();
            }

            setFeedback(payload?.message || 'Xoá chuyên khoa thành công.', 'success');
            await loadAndRender();
          } catch (error) {
            setFeedback('Không thể kết nối server để xoá chuyên khoa.', 'error');
          }
        });
      });

      listNode.querySelectorAll('button[data-edit-specialty-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const specialtyId = btn.getAttribute('data-edit-specialty-id');
          if (!specialtyId) {
            return;
          }

          const specialty = specialties.find((item) => item.id === specialtyId);
          if (!specialty) {
            return;
          }

          enterEditMode(specialty);
        });
      });
    };

    const loadAndRender = async () => {
      try {
        const specialties = await fetchSpecialties();
        syncSpecialtyNamesToLocal(specialties);
        render(specialties);
      } catch (error) {
        render([]);
        setFeedback('Không thể tải dữ liệu chuyên khoa từ server.', 'error');
      }
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = input.value.trim();
      const description = descriptionInput.value.trim();

      if (!name || !description) {
        setFeedback('Vui lòng nhập đầy đủ tên và mô tả chuyên khoa.', 'error');
        return;
      }

      try {
        const isEditing = Boolean(editingSpecialtyId);
        const endpoint = isEditing
          ? `${apiBase}/specialties/${encodeURIComponent(editingSpecialtyId)}`
          : `${apiBase}/specialties`;
        const method = isEditing ? 'PUT' : 'POST';

        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name,
            description
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setFeedback(
            payload?.message || (isEditing ? 'Không thể cập nhật chuyên khoa.' : 'Không thể thêm chuyên khoa.'),
            'error'
          );
          return;
        }

        setFeedback(
          payload?.message || (isEditing ? 'Cập nhật chuyên khoa thành công.' : 'Thêm chuyên khoa thành công.'),
          'success'
        );
        resetEditMode();
        await loadAndRender();
      } catch (error) {
        setFeedback('Không thể kết nối server để lưu chuyên khoa.', 'error');
      }
    });

    cancelEditButton?.addEventListener('click', () => {
      resetEditMode();
      setFeedback('Đã huỷ chế độ chỉnh sửa.', 'success');
    });

    loadAndRender();
  };

  const setupViewAppointmentsPage = () => {
    const tbody = document.getElementById('appointments-table-body');
    const searchForm = document.getElementById('appointment-search-form');
    const titleSearchInput = document.getElementById('appointment-title-search');
    const searchInput = document.getElementById('appointment-doctor-search');
    const dateSearchInput = document.getElementById('appointment-date-search');
    const refundModal = document.getElementById('refund-modal');
    const refundCloseBtn = document.getElementById('refund-modal-close');
    const refundCancelBtn = document.getElementById('refund-cancel');
    const refundConfirmBtn = document.getElementById('refund-confirm');

    const apiBase = API_BASE;

    if (!tbody) {
      return;
    }

    let currentRefundId = null;
    let paidRefunds = [];
    let allAppointments = [];

    const escapeHtml = (value) =>
      String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const loadPaidRefunds = async () => {
      const response = await fetch(`${apiBase}/admin/paid-refunds`);
      if (!response.ok) {
        throw new Error('Cannot fetch paid refunds');
      }

      const payload = await response.json();
      paidRefunds = Array.isArray(payload?.data) ? payload.data : [];
    };

    const isRefundPaid = (refundId) => paidRefunds.includes(refundId);

    const markRefundAsPaid = async (refundId) => {
      if (!paidRefunds.includes(refundId)) {
        paidRefunds.push(refundId);
        await fetch(`${apiBase}/admin/paid-refunds`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ value: paidRefunds })
        });
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

    const renderRows = (items) => {
      tbody.innerHTML = items
        .map((item) => {
          const statusClass = item.status === 'Đã xác nhận' ? 'status-confirmed' : item.status === 'Đã hủy' ? 'status-rejected' : 'status-pending';
          const amount = Number(item.amount) || 0;
          let refundDisplay = '--';

          if (item.status === 'Đã xác nhận') {
            refundDisplay = '--';
          } else if (item.status === 'Đã hủy') {
            const isPaid = isRefundPaid(item.refundId);
            if (isPaid) {
              refundDisplay = '<span class="refund-paid">Đã hoàn tiền</span>';
            } else if (amount > 0) {
              refundDisplay = `<button type="button" class="refund-trigger" data-refund-id="${escapeHtml(item.refundId)}">${formatCurrency(amount)}</button>`;
            } else {
              refundDisplay = '--';
            }
          }

          return `
            <tr data-appointment-id="${escapeHtml(item.id || item.refundId)}">
              <td>${escapeHtml(normalizeAppointmentText(item.title || 'Lịch hẹn'))}</td>
              <td>
                <div class="doctor-identity">
                  <div class="doctor-name-line">${escapeHtml(item.doctorName || 'BS. Chưa cập nhật')}</div>
                  <div class="doctor-email-line">${escapeHtml(item.doctorEmail || 'Chưa cập nhật')}</div>
                </div>
              </td>
              <td>${escapeHtml(item.date || 'Chưa cập nhật')}</td>
              <td>${escapeHtml(item.location || 'Chưa cập nhật')}</td>
              <td><span class="status-pill ${statusClass}">${escapeHtml(item.status)}</span></td>
              <td>${refundDisplay}</td>
              <td><button type="button" class="delete-trigger" data-id="${escapeHtml(item.id || item.refundId)}">Xoá</button></td>
            </tr>
          `;
        })
        .join('');

      const canceledItemsById = Object.fromEntries(allAppointments.filter((item) => item.status === 'Đã hủy').map((item) => [item.refundId, item]));
      const allItemsById = Object.fromEntries(allAppointments.map((item) => [item.id || item.refundId, item]));

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

      // Handle delete button clicks
      tbody.querySelectorAll('.delete-trigger').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.getAttribute('data-id');
          if (!id) return;

          if (!confirm('Bạn có chắc chắn muốn xoá lịch hẹn này?')) {
            return;
          }

          try {
            const deleteResponse = await fetch(`${apiBase}/appointments/${id}`, {
              method: 'DELETE'
            });

            if (!deleteResponse.ok) {
              alert('Không thể xoá lịch hẹn. Vui lòng thử lại.');
              return;
            }

            alert('Đã xoá lịch hẹn.');
            render();
          } catch (error) {
            alert('Lỗi: ' + error.message);
          }
        });
      });
    };

    const normalizeDateForFilter = (value) => {
      const raw = String(value || '').trim();
      if (!raw) {
        return '';
      }

      const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoLike) {
        return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`;
      }

      const viLike = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (viLike) {
        const day = viLike[1].padStart(2, '0');
        const month = viLike[2].padStart(2, '0');
        return `${viLike[3]}-${month}-${day}`;
      }

      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        return raw.toLowerCase();
      }

      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const toEpochForAppointmentSort = (value) => {
      const raw = String(value || '').trim();
      if (!raw || raw === 'Chưa cập nhật') {
        return Number.POSITIVE_INFINITY;
      }

      // Backend formats admin dates as dd/mm/yyyy HH:mm
      const viDateTime = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
      if (viDateTime) {
        const day = Number(viDateTime[1]);
        const month = Number(viDateTime[2]);
        const year = Number(viDateTime[3]);
        const hours = Number(viDateTime[4]);
        const minutes = Number(viDateTime[5]);

        const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
        const epoch = parsed.getTime();
        return Number.isNaN(epoch) ? Number.POSITIVE_INFINITY : epoch;
      }

      const parsed = new Date(raw);
      const epoch = parsed.getTime();
      return Number.isNaN(epoch) ? Number.POSITIVE_INFINITY : epoch;
    };

    const normalizeSearchText = (value) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();

    const matchesKeyword = (value, keyword) => {
      if (!keyword) {
        return true;
      }

      const haystack = normalizeSearchText(value);
      const tokens = keyword.split(' ').filter(Boolean);
      return tokens.every((token) => haystack.includes(token));
    };

    const renderPagination = (filteredItems, currentPage) => {
      const itemsPerPage = 10;
      const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
      const paginationContainer = document.getElementById('pagination-container');
      
      if (!paginationContainer || totalPages <= 1) {
        if (paginationContainer) {
          paginationContainer.innerHTML = '';
        }
        return;
      }

      let paginationHtml = '<div class="pagination" style="display: flex; gap: 5px; justify-content: center; flex-wrap: wrap;">';
      
      // Previous button
      if (currentPage > 1) {
        paginationHtml += `<button type="button" class="pagination-btn" data-page="${currentPage - 1}" style="padding: 5px 10px; cursor: pointer;">← Trước</button>`;
      }

      // Page numbers
      for (let i = 1; i <= totalPages; i++) {
        const isActive = i === currentPage;
        const activeStyle = isActive ? 'background-color: #007bff; color: white;' : 'background-color: #f0f0f0;';
        paginationHtml += `<button type="button" class="pagination-btn" data-page="${i}" style="padding: 5px 10px; cursor: pointer; ${activeStyle}">${i}</button>`;
      }

      // Next button
      if (currentPage < totalPages) {
        paginationHtml += `<button type="button" class="pagination-btn" data-page="${currentPage + 1}" style="padding: 5px 10px; cursor: pointer;">Sau →</button>`;
      }

      paginationHtml += '</div>';
      paginationContainer.innerHTML = paginationHtml;

      // Add event listeners to pagination buttons
      paginationContainer.querySelectorAll('.pagination-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const page = Number(btn.getAttribute('data-page'));
          renderWithPagination(filteredItems, page);
        });
      });
    };

    const renderWithPagination = (filteredItems, currentPage = 1) => {
      const itemsPerPage = 10;
      const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
      
      // Clamp current page
      const page = Math.max(1, Math.min(currentPage, totalPages));
      
      // Calculate start and end index
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageItems = filteredItems.slice(startIndex, endIndex);
      
      renderRows(pageItems);
      renderPagination(filteredItems, page);
    };

    const applyAppointmentFilters = () => {
      const titleKeyword = normalizeSearchText(titleSearchInput?.value || '');
      const doctorKeyword = normalizeSearchText(searchInput?.value || '');
      const selectedDate = String(dateSearchInput?.value || '').trim();
      if (!allAppointments.length) {
        return;
      }

      const filtered = allAppointments.filter((item) => {
        const matchesTitle = matchesKeyword(item.title, titleKeyword);
        const matchesDoctor = matchesKeyword(item.doctorName, doctorKeyword);

        if (!selectedDate) {
          return matchesTitle && matchesDoctor;
        }

        const itemDate = normalizeDateForFilter(item.date);
        const matchesDate = itemDate === selectedDate;

        return matchesTitle && matchesDoctor && matchesDate;
      });

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7">Không tìm thấy lịch hẹn phù hợp với bộ lọc hiện tại.</td></tr>';
        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer) {
          paginationContainer.innerHTML = '';
        }
        return;
      }

      renderWithPagination(filtered, 1);
    };

    const render = async () => {
      const overviewResponse = await fetch(`${apiBase}/admin/appointment-overview`);
      if (!overviewResponse.ok) {
        tbody.innerHTML = '<tr><td colspan="7">Không thể tải dữ liệu lịch hẹn từ database.</td></tr>';
        return;
      }

      const overviewPayload = await overviewResponse.json();
      const pending = (Array.isArray(overviewPayload?.data?.pending) ? overviewPayload.data.pending : []).map((item) => ({ ...item, status: 'Đang chờ xác nhận' }));
      const confirmed = (Array.isArray(overviewPayload?.data?.confirmed) ? overviewPayload.data.confirmed : []).map((item) => ({ ...item, status: 'Đã xác nhận' }));
      const rejected = (Array.isArray(overviewPayload?.data?.refunds) ? overviewPayload.data.refunds : []).map((item, index) => ({
        refundId: item.id || `refund-${index}`,
        title: item.title || 'Lịch hẹn đã hủy',
        doctorName: item.doctorName || 'BS. Chưa cập nhật',
        doctorEmail: item.doctorEmail || 'Chưa cập nhật',
        date: item.date || 'Chưa cập nhật',
        location: item.location || 'Chưa cập nhật',
        amount: Number(item.amount) || 0,
        bankName: item.bankName || 'Chưa cập nhật',
        bankAccount: item.bankAccount || 'Chưa cập nhật',
        userName: item.userName || 'Chưa cập nhật',
        status: 'Đã hủy'
      }));

      allAppointments = [...pending, ...confirmed, ...rejected];

      // Sort by date ascending
      allAppointments.sort((a, b) => {
        return toEpochForAppointmentSort(a.date) - toEpochForAppointmentSort(b.date);
      });

      if (!allAppointments.length) {
        tbody.innerHTML = '<tr><td colspan="7">Chưa có lịch hẹn để hiển thị.</td></tr>';
        return;
      }

      applyAppointmentFilters();
    };

    if (refundCloseBtn) {
      refundCloseBtn.addEventListener('click', closeRefundModal);
    }

    if (refundCancelBtn) {
      refundCancelBtn.addEventListener('click', closeRefundModal);
    }

    if (refundConfirmBtn) {
      refundConfirmBtn.addEventListener('click', async () => {
        if (currentRefundId) {
          await markRefundAsPaid(currentRefundId);
          closeRefundModal();
          await render();
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

    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        applyAppointmentFilters();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', applyAppointmentFilters);
    }

    if (titleSearchInput) {
      titleSearchInput.addEventListener('input', applyAppointmentFilters);
    }

    if (dateSearchInput) {
      dateSearchInput.addEventListener('change', applyAppointmentFilters);
    }

    loadPaidRefunds()
      .then(() => render())
      .catch(() => {
        tbody.innerHTML = '<tr><td colspan="6">Không thể tải dữ liệu hoàn tiền từ database.</td></tr>';
      });
  };

  const setupEditDoctorsPage = () => {
    const sectionsRoot = document.getElementById('doctor-edit-sections');
    const specialtyNav = document.getElementById('doctor-edit-specialty-nav');
    const searchInput = document.getElementById('doctor-edit-search');
    const searchButton = document.getElementById('doctor-edit-search-btn');
    const filterButtons = document.querySelectorAll('[data-doctor-filter]');
    const modal = document.getElementById('doctor-edit-modal');
    const closeButton = document.getElementById('doctor-edit-close');
    const form = document.getElementById('doctor-edit-form');
    const nameInput = document.getElementById('doctor-edit-name');
    const specialtySelect = document.getElementById('doctor-edit-specialty');
    const ratingInput = document.getElementById('doctor-edit-rating');
    const experienceInput = document.getElementById('doctor-edit-experience');
    const apiBase = API_BASE;

    if (!sectionsRoot || !specialtyNav || !searchInput || !searchButton || !modal || !closeButton || !form || !nameInput || !specialtySelect || !ratingInput || !experienceInput) {
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

    const normalizeSearchText = (value) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();

    const toStars = (rating) => {
      const rounded = Math.round(Number(rating) || 0);
      const full = Math.max(0, Math.min(5, rounded));
      return '★'.repeat(full) + '☆'.repeat(5 - full);
    };

    const getFeaturedDoctorIds = (list) => {
      // VIP = top 5 doctors by totalRevenue (ties at the 5th position included)
      const revenues = list
        .map((d) => Number(d.totalRevenue || 0))
        .filter((v) => v > 0);
      const sortedRevenues = revenues.sort((a, b) => b - a);
      const threshold = sortedRevenues.length >= 5
        ? sortedRevenues[4]
        : (sortedRevenues[sortedRevenues.length - 1] || 0);

      const featuredIds = new Set();
      if (threshold > 0) {
        list.forEach((doctor) => {
          if (Number(doctor.totalRevenue || 0) >= threshold) {
            featuredIds.add(doctor.id);
          }
        });
      }
      return featuredIds;
    };

    let activeFilter = 'all';

    const applyActiveFilter = (filter) => {
      activeFilter = filter;
      filterButtons.forEach((button) => {
        button.classList.toggle('is-active', button.getAttribute('data-doctor-filter') === filter);
      });
    };

    let doctors = [];
    let specialties = [];
    let selectedDoctorId = null;

    const closeModal = () => {
      modal.hidden = true;
      selectedDoctorId = null;
    };

    const loadData = async () => {
      const [doctorsRes, specialtiesRes] = await Promise.all([
        fetch(`${apiBase}/doctors`),
        fetch(`${apiBase}/specialties`)
      ]);

      if (!doctorsRes.ok || !specialtiesRes.ok) {
        throw new Error('Cannot load doctors data');
      }

      const doctorsPayload = await doctorsRes.json();
      const specialtiesPayload = await specialtiesRes.json();

      doctors = Array.isArray(doctorsPayload?.data) ? doctorsPayload.data : [];
      specialties = Array.isArray(specialtiesPayload?.data) ? specialtiesPayload.data : [];
    };

    const openModal = (doctor) => {
      specialtySelect.innerHTML = specialties
        .map(
          (specialty) => `<option value="${escapeHtml(specialty.id)}" ${specialty.id === doctor.specialtyId ? 'selected' : ''}>${escapeHtml(specialty.name)}</option>`
        )
        .join('');

      selectedDoctorId = doctor.id;
      nameInput.value = doctor.name;
      ratingInput.value = Number(doctor.rating || 0);
      experienceInput.value = Number(doctor.experienceYears || 0);
      modal.hidden = false;
    };

    const render = () => {
      const fallbackMap = buildUniqueFallbackAvatarMap(doctors);
      const keyword = normalizeSearchText(searchInput.value);
      const featuredDoctorIds = getFeaturedDoctorIds(doctors);
      const filteredDoctors = doctors.filter((doctor) => {
        if (activeFilter === 'featured' && !featuredDoctorIds.has(doctor.id)) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        return (
          normalizeSearchText(doctor.name).includes(keyword) ||
          normalizeSearchText(doctor.specialty).includes(keyword)
        );
      });

      if (filteredDoctors.length === 0) {
        specialtyNav.innerHTML = '';
        sectionsRoot.innerHTML = '<p class="empty-text">Không tìm thấy bác sĩ phù hợp.</p>';
        return;
      }

      const grouped = filteredDoctors.reduce((acc, doctor) => {
        if (!acc[doctor.specialty]) {
          acc[doctor.specialty] = [];
        }
        acc[doctor.specialty].push(doctor);
        return acc;
      }, {});

      const specialtyNames = Object.keys(grouped);
      specialtyNav.innerHTML = specialtyNames
        .map((name) => `<a href="#${toSlug(name)}" class="specialty-link">${escapeHtml(name)}</a>`)
        .join('');

      sectionsRoot.innerHTML = specialtyNames
        .map((specialtyName) => {
          const cards = grouped[specialtyName]
            .map((doctor) => `
              <div class="doctor-card${featuredDoctorIds.has(doctor.id) ? ' doctor-card--featured' : ''}" data-doctor-id="${doctor.id}">
                <div class="doctor-image">
                  ${renderDoctorAvatar(doctor, fallbackMap)}
                  ${featuredDoctorIds.has(doctor.id) ? '<span class="featured-badge">VIP</span>' : ''}
                  <span class="specialty-badge">${escapeHtml(doctor.specialty)}</span>
                </div>
                <div class="doctor-info">
                  <h3 class="doctor-name">${escapeHtml(doctor.name)}</h3>
                  <p class="doctor-specialty">${escapeHtml(doctor.specialty)} · ${toGenderLabel(getDoctorGender(doctor))}</p>
                  <div class="doctor-rating">
                    <span class="stars">${toStars(doctor.rating)}</span>
                    <span class="rating-count">Số lịch hẹn: ${Number(doctor.proposedCurrentAppointments || doctor.pendingConfirmedAppointments || 0)}</span>
                  </div>
                  <p class="doctor-experience">Kinh nghiệm: ${Number(doctor.experienceYears || 0)} năm</p>
                  <button type="button" class="btn btn-book doctor-edit-trigger">Sửa bác sĩ</button>
                </div>
              </div>
            `)
            .join('');

          return `
            <section class="specialty-section" id="${toSlug(specialtyName)}">
              <h3 class="specialty-heading">${escapeHtml(specialtyName)}</h3>
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

          const doctor = doctors.find((item) => item.id === doctorId);
          if (!doctor) {
            return;
          }

          openModal(doctor);
        });
      });
    };

    const reloadAndRender = async () => {
      try {
        await loadData();
        render();
      } catch (error) {
        specialtyNav.innerHTML = '';
        sectionsRoot.innerHTML = '<p class="empty-text">Không thể tải dữ liệu bác sĩ từ cơ sở dữ liệu.</p>';
      }
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!selectedDoctorId) {
        return;
      }

      const newName = nameInput.value.trim();
      const newSpecialtyId = specialtySelect.value.trim();
      const newRating = Number(ratingInput.value);
      const newExperienceYears = Number(experienceInput.value);

      if (!newName || !newSpecialtyId || Number.isNaN(newRating) || Number.isNaN(newExperienceYears)) {
        alert('Vui lòng nhập đầy đủ thông tin bác sĩ.');
        return;
      }

      if (newRating < 0 || newRating > 5) {
        alert('Đánh giá phải nằm trong khoảng từ 0 đến 5.');
        return;
      }

      if (newExperienceYears < 0) {
        alert('Số năm kinh nghiệm không hợp lệ.');
        return;
      }

      try {
        const response = await fetch(`${apiBase}/doctors/${encodeURIComponent(selectedDoctorId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fullName: newName,
            specialtyId: newSpecialtyId,
            rating: newRating,
            experienceYears: newExperienceYears
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          alert(payload?.message || 'Không thể cập nhật bác sĩ.');
          return;
        }

        closeModal();
        await reloadAndRender();
        alert(payload?.message || 'Cập nhật bác sĩ thành công.');
      } catch (error) {
        alert('Không thể kết nối server để cập nhật bác sĩ.');
      }
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

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        applyActiveFilter(button.getAttribute('data-doctor-filter') || 'all');
        render();
      });
    });

    reloadAndRender();
  };

  const setupDeleteDoctorsPage = () => {
    const sectionsRoot = document.getElementById('doctor-delete-sections');
    const specialtyNav = document.getElementById('doctor-delete-specialty-nav');
    const searchInput = document.getElementById('doctor-delete-search');
    const searchButton = document.getElementById('doctor-delete-search-btn');
    const feedbackNode = document.getElementById('doctor-delete-feedback');
    const filterButtons = document.querySelectorAll('[data-doctor-filter]');
    const apiBase = API_BASE;

    if (!sectionsRoot || !specialtyNav || !searchInput || !searchButton) {
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

    const normalizeSearchText = (value) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();

    const toStars = (rating) => {
      const rounded = Math.round(Number(rating) || 0);
      const full = Math.max(0, Math.min(5, rounded));
      return '★'.repeat(full) + '☆'.repeat(5 - full);
    };

    const getFeaturedDoctorIds = (list) => {
      // VIP = top 5 doctors by totalRevenue (ties at the 5th position included)
      const revenues = list
        .map((d) => Number(d.totalRevenue || 0))
        .filter((v) => v > 0);
      const sortedRevenues = revenues.sort((a, b) => b - a);
      const threshold = sortedRevenues.length >= 5
        ? sortedRevenues[4]
        : (sortedRevenues[sortedRevenues.length - 1] || 0);

      const featuredIds = new Set();
      if (threshold > 0) {
        list.forEach((doctor) => {
          if (Number(doctor.totalRevenue || 0) >= threshold) {
            featuredIds.add(doctor.id);
          }
        });
      }
      return featuredIds;
    };

    let activeFilter = 'all';

    const applyActiveFilter = (filter) => {
      activeFilter = filter;
      filterButtons.forEach((button) => {
        button.classList.toggle('is-active', button.getAttribute('data-doctor-filter') === filter);
      });
    };

    const setFeedback = (message, type = 'success') => {
      if (!feedbackNode) {
        return;
      }
      feedbackNode.textContent = message;
      feedbackNode.style.color = type === 'error' ? '#b42318' : '#15803d';
    };

    let doctors = [];

    const loadDoctors = async () => {
      const response = await fetch(`${apiBase}/doctors`);
      if (!response.ok) {
        throw new Error('Cannot fetch doctors');
      }

      const payload = await response.json();
      doctors = Array.isArray(payload?.data) ? payload.data : [];
    };

    const render = () => {
      const fallbackMap = buildUniqueFallbackAvatarMap(doctors);
      const keyword = normalizeSearchText(searchInput.value);
      const featuredDoctorIds = getFeaturedDoctorIds(doctors);
      const filtered = doctors.filter((doctor) => {
        if (activeFilter === 'featured' && !featuredDoctorIds.has(doctor.id)) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        return (
          normalizeSearchText(doctor.name).includes(keyword) ||
          normalizeSearchText(doctor.specialty).includes(keyword)
        );
      });

      if (!filtered.length) {
        specialtyNav.innerHTML = '';
        sectionsRoot.innerHTML = '<p class="empty-text">Không tìm thấy bác sĩ phù hợp.</p>';
        return;
      }

      const grouped = filtered.reduce((acc, doctor) => {
        if (!acc[doctor.specialty]) {
          acc[doctor.specialty] = [];
        }
        acc[doctor.specialty].push(doctor);
        return acc;
      }, {});

      const specialtyNames = Object.keys(grouped);
      specialtyNav.innerHTML = specialtyNames
        .map((name) => `<a href="#${toSlug(name)}" class="specialty-link">${escapeHtml(name)}</a>`)
        .join('');

      sectionsRoot.innerHTML = specialtyNames
        .map((specialtyName) => {
          const cards = grouped[specialtyName]
            .map((doctor) => `
              <div class="doctor-card${featuredDoctorIds.has(doctor.id) ? ' doctor-card--featured' : ''}" data-doctor-id="${doctor.id}">
                <div class="doctor-image">
                  ${renderDoctorAvatar(doctor, fallbackMap)}
                  ${featuredDoctorIds.has(doctor.id) ? '<span class="featured-badge">VIP</span>' : ''}
                  <span class="specialty-badge">${escapeHtml(doctor.specialty)}</span>
                </div>
                <div class="doctor-info">
                  <h3 class="doctor-name">${escapeHtml(doctor.name)}</h3>
                  <p class="doctor-specialty">${escapeHtml(doctor.specialty)} · ${toGenderLabel(getDoctorGender(doctor))}</p>
                  <div class="doctor-rating">
                    <span class="stars">${toStars(doctor.rating)}</span>
                    <span class="rating-count">Số lịch hẹn: ${Number(doctor.proposedCurrentAppointments || doctor.pendingConfirmedAppointments || 0)}</span>
                  </div>
                  <p class="doctor-experience">Kinh nghiệm: ${Number(doctor.experienceYears || 0)} năm</p>
                  <button type="button" class="btn btn-book doctor-delete-trigger">Xoá bác sĩ</button>
                </div>
              </div>
            `)
            .join('');

          return `
            <section class="specialty-section" id="${toSlug(specialtyName)}">
              <h3 class="specialty-heading">${escapeHtml(specialtyName)}</h3>
              <div class="doctors-grid">${cards}</div>
            </section>
          `;
        })
        .join('');

      sectionsRoot.querySelectorAll('.doctor-delete-trigger').forEach((button) => {
        button.addEventListener('click', async () => {
          const card = button.closest('.doctor-card');
          const doctorId = card?.getAttribute('data-doctor-id');
          const doctorName = card?.querySelector('.doctor-name')?.textContent?.trim() || 'bác sĩ này';

          if (!doctorId) {
            return;
          }

          if (!window.confirm(`Bạn có chắc muốn xoá ${doctorName} không?`)) {
            return;
          }

          try {
            const response = await fetch(`${apiBase}/doctors/${encodeURIComponent(doctorId)}`, {
              method: 'DELETE'
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              setFeedback(payload?.message || 'Không thể xoá bác sĩ.', 'error');
              return;
            }

            setFeedback(payload?.message || 'Xoá bác sĩ thành công.', 'success');
            await reloadAndRender();
          } catch (error) {
            setFeedback('Không thể kết nối server để xoá bác sĩ.', 'error');
          }
        });
      });
    };

    const reloadAndRender = async () => {
      try {
        await loadDoctors();
        render();
      } catch (error) {
        specialtyNav.innerHTML = '';
        sectionsRoot.innerHTML = '<p class="empty-text">Không thể tải dữ liệu bác sĩ từ cơ sở dữ liệu.</p>';
      }
    };

    searchInput.addEventListener('input', render);
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        render();
      }
    });

    searchButton.addEventListener('click', render);

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        applyActiveFilter(button.getAttribute('data-doctor-filter') || 'all');
        render();
      });
    });

    reloadAndRender();
  };

  const setupAddDoctorPage = () => {
    const form = document.getElementById('doctor-create-form');
    const nameInput = document.getElementById('doctor-name');
    const specialtySelect = document.getElementById('specialty');
    const phoneInput = document.getElementById('phone-number');
    const emailInput = document.getElementById('email');
    const avatarUrlInput = document.getElementById('avatar-url');
    const passwordInput = document.getElementById('doctor-password');
    const feedbackNode = document.getElementById('doctor-feedback');
    const apiBase = API_BASE;

    if (!form || !nameInput || !specialtySelect || !phoneInput || !emailInput || !passwordInput) {
      return;
    }

    const escapeHtml = (value) =>
      String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const setFeedback = (message, type = 'success') => {
      if (!feedbackNode) {
        return;
      }
      feedbackNode.textContent = message;
      feedbackNode.style.color = type === 'error' ? '#b42318' : '#15803d';
    };

    const loadSpecialties = async () => {
      try {
        const response = await fetch(`${apiBase}/specialties`);
        if (!response.ok) {
          throw new Error('Cannot fetch specialties');
        }

        const payload = await response.json();
        const specialties = Array.isArray(payload?.data) ? payload.data : [];

        specialtySelect.innerHTML = ['<option value="">Chọn chuyên khoa</option>']
          .concat(
            specialties.map(
              (item) =>
                `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
            )
          )
          .join('');
      } catch (error) {
        specialtySelect.innerHTML = '<option value="">Không tải được chuyên khoa</option>';
        setFeedback('Không thể tải danh sách chuyên khoa.', 'error');
      }
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const fullName = nameInput.value.trim();
      const specialtyId = specialtySelect.value;
      const phone = phoneInput.value.trim();
      const email = emailInput.value.trim();
      const avatarUrl = avatarUrlInput ? avatarUrlInput.value.trim() : '';
      const password = passwordInput.value;

      if (!fullName || !specialtyId || !phone || !email || !password) {
        setFeedback('Vui lòng nhập đầy đủ thông tin bác sĩ.', 'error');
        return;
      }

      try {
        const response = await fetch(`${apiBase}/doctors`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fullName,
            specialtyId,
            phone,
            email,
            avatarUrl,
            password
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setFeedback(payload?.message || 'Không thể thêm bác sĩ.', 'error');
          return;
        }

        form.reset();
        setFeedback(payload?.message || 'Thêm bác sĩ thành công.', 'success');
        await loadSpecialties();
      } catch (error) {
        setFeedback('Không thể kết nối server để thêm bác sĩ.', 'error');
      }
    });

    loadSpecialties();
  };

  setupSpecialtiesPage();
  setupViewAppointmentsPage();
  setupEditDoctorsPage();
  setupDeleteDoctorsPage();
  setupAddDoctorPage();
})();
