const serverUrl = 'http://localhost:3000';

const jsonContent = (schema, example) => ({
  'application/json': {
    schema,
    example
  }
});

const schemas = {
  KeyValueState: {
    type: 'object',
    required: ['value'],
    additionalProperties: false,
    properties: {
      value: {
        description: 'Any JSON value stored for this key'
      }
    },
    example: {
      value: {
        theme: 'dark',
        language: 'vi'
      }
    }
  },
  DoctorCreate: {
    type: 'object',
    required: ['fullName', 'email', 'phone', 'password', 'specialtyId'],
    additionalProperties: false,
    properties: {
      fullName: { type: 'string', example: 'BS. Nguyễn Văn Long' },
      email: { type: 'string', format: 'email', example: 'long@example.com' },
      phone: { type: 'string', example: '0900000001' },
      password: { type: 'string', example: '123456' },
      specialtyId: { type: 'string', example: 'sp-tong-quat' }
    },
    example: {
      fullName: 'BS. Nguyễn Văn Long',
      email: 'long@example.com',
      phone: '0900000001',
      password: '123456',
      specialtyId: 'sp-tong-quat'
    }
  },
  DoctorUpdate: {
    type: 'object',
    required: ['fullName', 'specialtyId', 'rating', 'experienceYears'],
    additionalProperties: false,
    properties: {
      fullName: { type: 'string', example: 'BS. Nguyễn Văn Long' },
      specialtyId: { type: 'string', example: 'sp-tong-quat' },
      rating: { type: 'number', minimum: 0, maximum: 5, example: 4.8 },
      experienceYears: { type: 'integer', minimum: 0, example: 10 }
    },
    example: {
      fullName: 'BS. Nguyễn Văn Long',
      specialtyId: 'sp-tong-quat',
      rating: 4.8,
      experienceYears: 10
    }
  },
  SpecialtyCreate: {
    type: 'object',
    required: ['name', 'description'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', example: 'Nhi khoa' },
      description: { type: 'string', example: 'Chuyên khoa về bệnh của trẻ em' }
    },
    example: {
      name: 'Nhi khoa',
      description: 'Chuyên khoa về bệnh của trẻ em'
    }
  },
  AuthSignup: {
    type: 'object',
    required: ['fullName', 'email', 'password', 'confirmPassword'],
    additionalProperties: false,
    properties: {
      fullName: { type: 'string', example: 'Nguyễn Văn A' },
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      phone: { type: 'string', example: '0987654321' },
      password: { type: 'string', example: 'password123' },
      confirmPassword: { type: 'string', example: 'password123' }
    },
    example: {
      fullName: 'Nguyễn Văn A',
      email: 'user@example.com',
      phone: '0987654321',
      password: 'password123',
      confirmPassword: 'password123'
    }
  },
  AuthLogin: {
    type: 'object',
    required: ['identifier', 'password', 'role'],
    additionalProperties: false,
    properties: {
      identifier: { type: 'string', example: 'user@example.com' },
      password: { type: 'string', example: 'password123' },
      role: {
        type: 'string',
        enum: ['user', 'doctor', 'admin'],
        example: 'user'
      }
    },
    example: {
      identifier: 'user@example.com',
      password: 'password123',
      role: 'user'
    }
  },
  AppointmentCreate: {
    type: 'object',
    required: ['doctorId', 'title', 'appointmentDate'],
    additionalProperties: false,
    properties: {
      doctorId: { type: 'string', example: 'doc-030' },
      title: { type: 'string', example: 'Khám sức khỏe tổng quát' },
      description: { type: 'string', example: 'Bệnh nhân có tiền sử dị ứng', nullable: true },
      appointmentDate: { type: 'string', format: 'date-time', example: '2026-04-15T14:30:00.000Z' },
      appointmentLocation: { type: 'string', example: 'Hà Nội', nullable: true },
      durationMinutes: { type: 'integer', minimum: 1, example: 30 }
    },
    example: {
      doctorId: 'doc-030',
      title: 'Khám sức khỏe tổng quát',
      description: 'Bệnh nhân có tiền sử dị ứng',
      appointmentDate: '2026-04-15T14:30:00.000Z',
      appointmentLocation: 'Hà Nội',
      durationMinutes: 30
    }
  },
  AppointmentStatusUpdate: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: {
        type: 'string',
        enum: ['chưa_thanh_toán', 'chờ_xác_nhận', 'đã_xác_nhận', 'đã_huỷ'],
        example: 'đã_xác_nhận'
      }
    },
    example: {
      status: 'đã_xác_nhận'
    }
  },
  PaymentCreate: {
    type: 'object',
    required: ['appointmentId', 'amount'],
    additionalProperties: false,
    properties: {
      appointmentId: { type: 'string', example: '8e7f0a2d-1111-2222-3333-444444444444' },
      amount: { type: 'number', minimum: 1, example: 850000 },
      orderDescription: { type: 'string', example: 'Thanh toán lịch hẹn', nullable: true },
      orderType: { type: 'string', example: 'appointment', nullable: true }
    },
    example: {
      appointmentId: '8e7f0a2d-1111-2222-3333-444444444444',
      amount: 850000,
      orderDescription: 'Thanh toán lịch hẹn',
      orderType: 'appointment'
    }
  },
  UserProfileUpdate: {
    type: 'object',
    additionalProperties: false,
    properties: {
      fullName: { type: 'string', example: 'Nguyễn Văn A' },
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      phone: { type: 'string', example: '0987654321' },
      dateOfBirth: { type: 'string', format: 'date', example: '1995-05-20', nullable: true },
      gender: {
        type: 'string',
        enum: ['male', 'female', 'other', 'not-say'],
        example: 'male'
      },
      address: { type: 'string', example: '123 Nguyễn Trãi, Thanh Xuân, Hà Nội', nullable: true },
      heightCm: { type: 'integer', example: 170, nullable: true },
      weightKg: { type: 'integer', example: 65, nullable: true },
      bloodType: { type: 'string', example: 'O+', nullable: true },
      insuranceProvider: { type: 'string', example: 'Bảo hiểm ABC', nullable: true },
      insuranceId: { type: 'string', example: 'BH123456', nullable: true },
      bankName: { type: 'string', example: 'Vietcombank', nullable: true },
      bankAccount: { type: 'string', example: '0123456789', nullable: true }
    },
    example: {
      fullName: 'Nguyễn Văn A',
      email: 'user@example.com',
      phone: '0987654321',
      dateOfBirth: '1995-05-20',
      gender: 'male',
      address: '123 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      heightCm: 170,
      weightKg: 65,
      bloodType: 'O+',
      insuranceProvider: 'Bảo hiểm ABC',
      insuranceId: 'BH123456',
      bankName: 'Vietcombank',
      bankAccount: '0123456789'
    }
  },
  RefundListUpdate: {
    type: 'object',
    required: ['value'],
    additionalProperties: false,
    properties: {
      value: {
        type: 'array',
        description: 'Array of refund records to store',
        items: {
          type: 'object'
        }
      }
    },
    example: {
      value: [
        {
          appointmentId: 'appt-001',
          amount: 850000,
          bankName: 'Vietcombank',
          bankAccount: '0123456789'
        }
      ]
    }
  }
};

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Clinic Appointment System API',
    version: '1.0.0',
    description: 'Swagger UI for the clinic appointment backend.'
  },
  servers: [{ url: serverUrl }],
  paths: {
    '/api/health': {
      get: {
        summary: 'Check API health',
        responses: {
          200: {
            description: 'Health status'
          }
        }
      }
    },
    '/api/state': {
      get: {
        summary: 'Get global application state',
        parameters: [
          {
            name: 'keys',
            in: 'query',
            required: false,
            description: 'Optional comma-separated state keys'
          }
        ],
        responses: {
          200: { description: 'State data' },
          503: { description: 'Database disabled' }
        }
      }
    },
    '/api/state/{key}': {
      put: {
        summary: 'Set global state value',
        parameters: [
          {
            name: 'key',
            in: 'path',
            required: true,
            description: 'State key'
          }
        ],
        requestBody: {
          required: true,
          content: jsonContent(schemas.KeyValueState, schemas.KeyValueState.example)
        },
        responses: {
          200: { description: 'State updated' }
        }
      },
      delete: {
        summary: 'Delete global state value',
        parameters: [
          {
            name: 'key',
            in: 'path',
            required: true,
            description: 'State key'
          }
        ],
        responses: {
          200: { description: 'State deleted' }
        }
      }
    },
    '/api/doctors': {
      get: {
        summary: 'Get all doctors',
        responses: { 200: { description: 'Doctor list' } }
      },
      post: {
        summary: 'Create doctor',
        requestBody: {
          required: true,
          content: jsonContent(schemas.DoctorCreate, schemas.DoctorCreate.example)
        },
        responses: { 201: { description: 'Doctor created' } }
      }
    },
    '/api/doctors/{id}': {
      put: {
        summary: 'Update doctor',
        parameters: [{ name: 'id', in: 'path', required: true }],
        requestBody: {
          required: true,
          content: jsonContent(schemas.DoctorUpdate, schemas.DoctorUpdate.example)
        },
        responses: { 200: { description: 'Doctor updated' } }
      },
      delete: {
        summary: 'Delete doctor',
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: { 200: { description: 'Doctor deleted' } }
      }
    },
    '/api/specialties': {
      get: {
        summary: 'Get all specialties',
        responses: { 200: { description: 'Specialty list' } }
      },
      post: {
        summary: 'Create specialty',
        requestBody: {
          required: true,
          content: jsonContent(schemas.SpecialtyCreate, schemas.SpecialtyCreate.example)
        },
        responses: { 201: { description: 'Specialty created' } }
      }
    },
    '/api/specialties/{id}': {
      delete: {
        summary: 'Delete specialty',
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: { 200: { description: 'Specialty deleted' } }
      }
    },
    '/api/auth/signup': {
      post: {
        summary: 'Sign up',
        requestBody: {
          required: true,
          content: jsonContent(schemas.AuthSignup, schemas.AuthSignup.example)
        },
        responses: { 201: { description: 'User created' } }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Login',
        requestBody: {
          required: true,
          content: jsonContent(schemas.AuthLogin, schemas.AuthLogin.example)
        },
        responses: { 200: { description: 'Logged in' } }
      }
    },
    '/api/auth/me': {
      get: {
        summary: 'Get current user',
        responses: { 200: { description: 'Current user' } }
      }
    },
    '/api/auth/logout': {
      post: {
        summary: 'Logout',
        responses: { 200: { description: 'Logged out' } }
      }
    },
    '/api/user/app-state': {
      get: {
        summary: 'Get user app state',
        responses: { 200: { description: 'User state' } }
      }
    },
    '/api/user/app-state/{key}': {
      put: {
        summary: 'Set user app state',
        parameters: [{ name: 'key', in: 'path', required: true, description: 'App state key' }],
        requestBody: {
          required: true,
          content: jsonContent(schemas.KeyValueState, schemas.KeyValueState.example)
        },
        responses: { 200: { description: 'User state updated' } }
      }
    },
    '/api/admin/appointment-overview': {
      get: {
        summary: 'Get appointment overview',
        responses: { 200: { description: 'Overview data' } }
      }
    },
    '/api/admin/paid-refunds': {
      get: {
        summary: 'Get paid refunds',
        responses: { 200: { description: 'Refund list' } }
      },
      put: {
        summary: 'Process refund action',
        requestBody: {
          required: true,
          content: jsonContent(schemas.RefundListUpdate, schemas.RefundListUpdate.example)
        },
        responses: { 200: { description: 'Refund processed' } }
      }
    },
    '/api/users/{id}/profile': {
      get: {
        summary: 'Get user profile',
        parameters: [{ name: 'id', in: 'path', required: true, description: 'User id or me' }],
        responses: { 200: { description: 'User profile' } }
      },
      put: {
        summary: 'Update user profile',
        parameters: [{ name: 'id', in: 'path', required: true, description: 'User id or me' }],
        requestBody: {
          required: true,
          content: jsonContent(schemas.UserProfileUpdate, schemas.UserProfileUpdate.example)
        },
        responses: { 200: { description: 'Profile updated' } }
      }
    },
    '/api/appointments': {
      get: {
        summary: 'Get appointments for current session user',
        parameters: [
          {
            name: 'doctorId',
            in: 'query',
            required: false,
            description: 'Filter by doctor id (admin: any, doctor/user: within own scope)'
          },
          {
            name: 'userId',
            in: 'query',
            required: false,
            description: 'Filter by patient/user id (admin: any, doctor/user: within own scope)'
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            description: 'Filter by status: chưa_thanh_toán, chờ_xác_nhận, đã_xác_nhận, đã_huỷ'
          }
        ],
        responses: { 200: { description: 'Appointment list' } }
      },
      post: {
        summary: 'Create appointment',
        requestBody: {
          required: true,
          content: jsonContent(schemas.AppointmentCreate, schemas.AppointmentCreate.example)
        },
        responses: { 201: { description: 'Appointment created' } }
      }
    },
    '/api/appointments/{id}/status': {
      put: {
        summary: 'Update appointment status',
        parameters: [{ name: 'id', in: 'path', required: true }],
        requestBody: {
          required: true,
          content: jsonContent(schemas.AppointmentStatusUpdate, schemas.AppointmentStatusUpdate.example)
        },
        responses: { 200: { description: 'Status updated' } }
      }
    },
    '/api/appointments/{id}': {
      delete: {
        summary: 'Delete appointment',
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: { 200: { description: 'Appointment deleted' } }
      }
    },
    '/api/appointments/{id}/complete': {
      delete: {
        summary: 'Complete appointment',
        parameters: [{ name: 'id', in: 'path', required: true }],
        responses: { 200: { description: 'Appointment completed' } }
      }
    },
    '/api/payment/vnpay/create': {
      post: {
        summary: 'Create VNPAY payment',
        requestBody: {
          required: true,
          content: jsonContent(schemas.PaymentCreate, schemas.PaymentCreate.example)
        },
        responses: { 200: { description: 'Redirect URL returned' } }
      }
    },
    '/api/payment/vnpay/return': {
      get: {
        summary: 'Handle VNPAY return',
        responses: { 200: { description: 'Payment return processed' } }
      }
    },
    '/api/payment/vnpay/simulate': {
      get: {
        summary: 'Simulate VNPAY payment',
        parameters: [
          { name: 'vnp_TxnRef', in: 'query', required: false },
          { name: 'vnp_Amount', in: 'query', required: false },
          { name: 'vnp_OrderInfo', in: 'query', required: false },
          { name: 'vnp_ReturnUrl', in: 'query', required: false }
        ],
        responses: { 200: { description: 'Simulation result' } }
      }
    }
  }
};

module.exports = openApiSpec;