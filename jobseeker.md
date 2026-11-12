# Job-Seeker Onboarding API Documentation

This document covers all backend endpoints supporting the HireInSecond mobile job-seeker onboarding flow.

---

## 1. Authentication Endpoints

### 1.1 Mobile Login with OTP
**`POST /api/user/loginWithMobile`**

Sends an OTP to either a phone number or an email address. Unregistered phone numbers or existing accounts are resolved.

- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "key": "phone", // or "email"
  "value": "+919876543210" // or "user@example.com"
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "userId": "673f8e91a0c8b2001e74a812"
}
```

---

### 1.2 Generate Signup OTP
**`POST /api/user/otp/generate`**

Sends a signup verification OTP to the user's registered contact method.

- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "userId": "673f8e91a0c8b2001e74a812",
  "type": "signUp"
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

---

### 1.3 Verify OTP
**`POST /api/user/otp/verify`**

Verifies the 6-digit code and logs the user in, returning the session JWT token and user profile document.

- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "userId": "673f8e91a0c8b2001e74a812",
  "otp": "123456",
  "type": "signUp" // or "resetPassword"
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "data": {
    "_id": "673f8e91a0c8b2001e74a812",
    "email": "user@example.com",
    "phone": "+919876543210",
    "userType": "personal",
    "isProfileCompleted": false,
    "otpVerified": true
  }
}
```

---

### 1.4 Native Google Sign-In
**`POST /api/auth/google`**

Verifies native Google `idToken`, auto-creates personal user if not present (`otpVerified: true`, no OTP needed), and issues a JWT token.

- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "idToken": "<google_id_token>",
  "userType": "personal"
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Google authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "data": {
    "_id": "673f8e91a0c8b2001e74a812",
    "email": "user@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "photo": "https://lh3.googleusercontent.com/...",
    "userType": "personal",
    "isProfileCompleted": false,
    "otpVerified": true
  }
}
```

---

## 2. Location & Locality Endpoints

### 2.1 Get Localities for City
**`GET /api/location/getLocalities?city=Delhi&input=j`**
*(Also mounted at `GET /api/getLocalities`)*

Fetches popular localities for a selected city, or autocompletes based on user input. Uses Google Places API (New) when `GOOGLE_PLACES_API_KEY` is configured in `.env`, with automatic fallback to curated tech-city localities and OpenStreetMap Nominatim.

- **Query Parameters:**
  - `city` (string, required): e.g. `Delhi`, `Bengaluru`, `Mumbai`, `Hyderabad`, `Pune`, `Noida`, `Gurgaon`.
  - `input` (string, optional): Search prefix/substring for autocomplete.
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    { "locality": "Janakpuri", "city": "Delhi" },
    { "locality": "Rohini", "city": "Delhi" },
    { "locality": "Dwarka", "city": "Delhi" }
  ]
}
```

---

### 2.2 Reverse Geocode Coordinates
**`GET /api/getAddress?lat={lat}&long={long}`**

Returns city and address details from latitude and longitude coordinates.

---

## 3. Profile Setup Wizard Save Endpoint

### 3.1 Single Final Profile Update
**`POST /api/user/updateUserFields`**

Called once upon completion of the 5-step onboarding wizard.

- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt_token>` (optional if `email` is supplied in body)
- **Request Body:**
```json
{
  "document": {
    "email": "candidate@example.com",
    "userType": "personal",
    "fullName": "Jane Doe",
    "gender": "female",
    "educationLevel": "Graduate",
    "hasExperience": true,
    "monthlySalary": 45000,
    "expectedSalary": 45000,
    "preferredLocationCity": "Delhi",
    "preferredLocationLocalities": ["Janakpuri", "Rohini"],
    "location": "Janakpuri, Delhi",
    "roleCategories": ["Engineering", "Design"],
    "roleExperiences": {
      "Engineering": "2 Years",
      "Design": "Fresher"
    },
    "roleSkills": {
      "Engineering": ["React", "TypeScript", "Node.js"],
      "Design": ["Figma", "UI/UX"]
    },
    "documents": ["PAN Card", "Aadhar Card"],
    "title": "Engineering",
    "role": "Engineering",
    "skills": "React, TypeScript, Node.js, Figma, UI/UX",
    "isProfileCompleted": true,
    "otpVerified": true
  }
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "message": "User fields updated successfully",
  "data": { ... }
}
```
