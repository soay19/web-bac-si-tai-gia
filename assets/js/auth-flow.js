(function () {
  const API_BASE =
    window.THAT_CLINIC_API_BASE ||
    `${window.location.protocol}//${window.location.hostname}:3000/api`;

  const getErrorMessage = async (response, fallbackMessage) => {
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim();
      }
    } catch (error) {
      // Ignore parse errors and fallback to the default message.
    }

    return fallbackMessage;
  };

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const fullName = document.getElementById('signupFullName')?.value.trim() || '';
      const email = document.getElementById('signupEmail')?.value.trim() || '';
      const phone = document.getElementById('signupPhone')?.value.trim() || '';
      const password = document.getElementById('signupPassword')?.value || '';
      const confirmPassword = document.getElementById('signupConfirmPassword')?.value || '';

      if (password !== confirmPassword) {
        alert('Đăng ký thất bại: Mật khẩu xác nhận không trùng khớp');
        window.location.href = 'signup.html';
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/auth/signup`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fullName,
            email,
            phone,
            password,
            confirmPassword
          })
        });

        if (!response.ok) {
          const errorMessage = await getErrorMessage(response, 'Đăng ký thất bại');
          throw new Error(errorMessage);
        }

        alert('Đăng ký thành công');
        window.location.href = 'login.html';
      } catch (error) {
        const message = error && error.message ? error.message : 'Đăng ký thất bại';
        alert(`Đăng ký thất bại: ${message}`);
        window.location.href = 'signup.html';
      }
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const identifier = document.getElementById('loginIdentifier')?.value.trim() || '';
      const password = document.getElementById('loginPassword')?.value || '';
      const role = document.getElementById('loginRole')?.value || '';

      try {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            identifier,
            password,
            role
          })
        });

        if (!response.ok) {
          const errorMessage = await getErrorMessage(response, 'Đăng nhập thất bại');
          throw new Error(errorMessage);
        }

        const payload = await response.json();

        if (!payload?.ok || !payload?.redirectTo) {
          throw new Error('LOGIN_FAILED');
        }

        alert('Đăng nhập thành công');
        window.location.href = `..${payload.redirectTo}`;
      } catch (error) {
        const message = error && error.message ? error.message : 'Đăng nhập thất bại';
        alert(`Đăng nhập thất bại: ${message}`);
        window.location.href = 'login.html';
      }
    });
  }
})();
