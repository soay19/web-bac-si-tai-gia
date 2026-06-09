#!/bin/bash
# VNPAY Payment Integration - Manual Testing Guide
# This script shows how to test VNPAY payment endpoints

echo "=========================================="
echo "VNPAY Payment Integration - Manual Testing"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:3000/api"
SESSION_COOKIE="thatClinicSession=test_session_token"

echo -e "${BLUE}📋 Testing VNPAY Payment Endpoints${NC}\n"

# Test 1: Create Payment
echo -e "${YELLOW}Test 1: Create Payment (Initialize VNPAY)${NC}"
echo "Endpoint: POST /api/payment/vnpay/create"
echo "Command:"
echo "curl -X POST '$API_BASE_URL/payment/vnpay/create' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Cookie: $SESSION_COOKIE' \\"
echo "  -d '{\"appointmentId\":\"test-appointment-001\",\"amount\":850000}'"
echo ""
echo -e "${BLUE}Expected Response:${NC}"
echo "{
  \"ok\": true,
  \"paymentId\": \"uuid-payment-id\",
  \"transactionId\": \"THATtimestamp\",
  \"redirectUrl\": \"http://...\",
  \"message\": \"Payment initiated\"
}"
echo ""
echo "---"
echo ""

# Test 2: VNPAY Redirect Flow
echo -e "${YELLOW}Test 2: Payment Simulation Flow${NC}"
echo "Step 1: User clicks payment button"
echo "Step 2: Redirected to VNPAY simulation: /api/payment/vnpay/simulate?..."
echo "Step 3: User selects success or failure"
echo "Step 4: Simulated VNPAY returns to: /api/payment/vnpay/return?..."
echo ""
echo -e "${BLUE}Browser Flow:${NC}"
echo "1. Create appointment → Checkout"
echo "2. Click 'Thanh toán bằng VNPAY'"
echo "3. Redirected to VNPAY payment page"
echo "4. Choose: Success or Failure"
echo "5. Auto-redirect to: payment-success.html or payment-failed.html"
echo ""
echo "---"
echo ""

# Test 3: Verify Database Changes
echo -e "${YELLOW}Test 3: Verify Database${NC}"
echo "After successful payment, check these tables:"
echo ""
echo -e "${GREEN}✓ Appointments Table${NC}"
echo "SELECT id, status, appointment_date FROM appointments."
echo "Expected status after payment: 'chờ_xác_nhận'"
echo ""
echo -e "${GREEN}✓ Payments Table${NC}"
echo "SELECT id, transaction_id, payment_status FROM payments."
echo "Expected payment_status: 'completed'"
echo ""
echo "---"
echo ""

# Test 4: Check Payment Routes
echo -e "${YELLOW}Test 4: Available Payment Routes${NC}"
echo ""
echo -e "${GREEN}POST /api/payment/vnpay/create${NC}"
echo "  Purpose: Initialize payment, generate redirect URL"
echo "  Auth: Required (user must be logged in)"
echo ""
echo -e "${GREEN}GET /api/payment/vnpay/simulate${NC}"
echo "  Purpose: Simulate VNPAY payment gateway"
echo "  Auth: Not required"
echo "  Returns: HTML form with Success/Failure buttons"
echo ""
echo -e "${GREEN}GET /api/payment/vnpay/return${NC}"
echo "  Purpose: Handle VNPAY callback"
echo "  Auth: Not required"
echo "  Returns: Redirect to payment-success.html or payment-failed.html"
echo ""
echo "---"
echo ""

# Test 5: Manual cURL Examples
echo -e "${YELLOW}Test 5: Manual Testing with cURL${NC}"
echo ""
echo "# 1. Create a new appointment first (run this in another terminal):"
echo "curl -X POST '$API_BASE_URL/appointments' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Cookie: $SESSION_COOKIE' \\"
echo "  -d '{"
echo "    \"doctorId\": \"doc-001\","
echo "    \"title\": \"Khám chỉnh hình\","
echo "    \"appointmentDate\": \"2026-04-15 14:00:00\","
echo "    \"appointmentLocation\": \"Ngõ 123, Yên Xá, Hà Nội\","
echo "    \"durationMinutes\": 30"
echo "  }'"
echo ""
echo "# 2. Create payment (use appointmentId from step 1):"
echo "curl -X POST '$API_BASE_URL/payment/vnpay/create' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Cookie: $SESSION_COOKIE' \\"
echo "  -d '{\"appointmentId\": \"APPOINTMENT_ID_HERE\", \"amount\": 850000}'"
echo ""
echo "# 3. Get redirect URL and open in browser"
echo "# The simulation page will appear - choose Success or Failure"
echo ""
echo "---"
echo ""

# Test 6: Database Check Script
echo -e "${YELLOW}Test 6: Check Payment Status${NC}"
echo ""
echo "After payment, run this SQL to verify:"
echo ""
echo "-- Check latest payment:"
echo "SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;"
echo ""
echo "-- Check appointment status:"
echo "SELECT id, status, title FROM appointments ORDER BY created_at DESC LIMIT 1;"
echo ""
echo "-- Expected results:"
echo "-- payments.payment_status = 'completed'"
echo "-- appointments.status = 'chờ_xác_nhận'"
echo ""

echo -e "${GREEN}✓ Testing Guide Complete${NC}"
echo ""
echo "Next Steps:"
echo "1. Start backend: cd backend && node server.js"
echo "2. Open browser to http://localhost:3000/user/doctors.html"
echo "3. Create an appointment → Checkout"
echo "4. Click 'Thanh toán bằng VNPAY'"
echo "5. Choose Success or Failure in simulation"
echo "6. Verify results"
echo ""
