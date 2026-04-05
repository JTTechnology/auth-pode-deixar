# Authentication Microservice

A production-ready, secure, and scalable authentication microservice built with NestJS, featuring JWT-based authentication, email verification, password reset, rate limiting, and comprehensive security measures.

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication with access and refresh tokens
- Refresh token rotation and secure storage
- Role-based access control (RBAC)
- "Remember me" functionality with extended token expiration
- Secure logout with token invalidation

### 🛡️ Security Features
- Password hashing with bcrypt (12 salt rounds)
- Account lockout after multiple failed login attempts
- Rate limiting and throttling protection
- Email verification for account activation
- Password reset with secure token handling
- Input validation and sanitization
- Protection against brute-force attacks
- Security headers (Helmet)
- CORS configuration

### 📧 Email Integration
- Email verification during registration
- Password reset emails
- Configurable SMTP settings

### 📊 Monitoring & Logging
- Comprehensive audit logging for security events
- Login attempt tracking
- Failed authentication monitoring
- Winston-based logging system

### 🏗️ Architecture
- Horizontal scalability (no shared in-memory state)
- Centralized error handling
- Consistent API response patterns
- Environment-based configuration
- Database connection pooling with Prisma

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- npm or yarn

### Installation

1. Clone the repository and navigate to the auth service:
```bash
cd auth/services/auth
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
npx prisma migrate dev
npx prisma generate
```

5. Start the service:
```bash
npm run start:dev
```

## API Endpoints

### Authentication Endpoints

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "complete_name": "John Doe",
  "email": "john@example.com",
  "password": "StrongPass123!",
  "phone": "+1234567890",
  "postal_code": "12345",
  "role": "CLIENT"
}
```

**Response:**
```json
{
  "message": "User registered successfully. Please check your email to verify your account.",
  "user": {
    "id": "uuid",
    "complete_name": "John Doe",
    "email": "john@example.com",
    "role": "CLIENT",
    "phone": "+1234567890",
    "postal_code": "12345",
    "email_verified": false,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /auth/login
Authenticate a user and return tokens.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "StrongPass123!",
  "rememberMe": true
}
```

**Response:**
```json
{
  "message": "Login successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 2592000,
  "token_type": "Bearer",
  "user": {
    "id": "uuid",
    "complete_name": "John Doe",
    "email": "john@example.com",
    "role": "CLIENT"
  }
}
```

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /auth/verify-email
Verify user email address.

**Request Body:**
```json
{
  "token": "verification-token-here"
}
```

#### POST /auth/forgot-password
Request password reset.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

#### POST /auth/reset-password
Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset-token-here",
  "newPassword": "NewStrongPass123!"
}
```

### Protected Endpoints

#### GET /auth/profile
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

#### PUT /auth/change-password
Change user password (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentPassword": "CurrentPass123!",
  "newPassword": "NewStrongPass123!"
}
```

#### POST /auth/logout
Logout user and invalidate tokens (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_ACCESS_SECRET` | Secret for access tokens | Required |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | Required |
| `SMTP_HOST` | SMTP server host | smtp.gmail.com |
| `SMTP_PORT` | SMTP server port | 587 |
| `SMTP_USER` | SMTP username | Required for email |
| `SMTP_PASS` | SMTP password | Required for email |
| `SMTP_FROM` | From email address | noreply@yourapp.com |
| `FRONTEND_URL` | Frontend application URL | http://localhost:3000 |
| `MAX_LOGIN_ATTEMPTS` | Max failed login attempts before lockout | 5 |
| `LOCKOUT_DURATION_MINUTES` | Account lockout duration | 15 |
| `ALLOWED_ORIGINS` | CORS allowed origins | http://localhost:3000 |
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3001 |

### Security Settings

- **Password Requirements:** Minimum 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
- **Rate Limiting:** 10 requests per minute for auth endpoints, 100 requests per minute globally
- **Token Expiration:** Access tokens: 15 minutes (30 days with remember me), Refresh tokens: 7 days (90 days with remember me)
- **Account Lockout:** After 5 failed attempts, locked for 15 minutes

## Database Schema

The service uses PostgreSQL with the following main entities:

### User
- `id`: UUID primary key
- `completeName`: Full name
- `email`: Unique email address
- `password`: Hashed password
- `role`: User role (CLIENT/PROVIDER)
- `phone`: Phone number
- `postalCode`: Postal code
- `emailVerified`: Email verification status
- `emailVerificationToken`: Email verification token
- `passwordResetToken`: Password reset token
- `passwordResetExpires`: Password reset expiration
- `refreshToken`: Hashed refresh token
- `failedLoginAttempts`: Number of failed login attempts
- `lockoutUntil`: Account lockout timestamp
- `lastLoginAt`: Last login timestamp
- `createdAt`: Account creation timestamp
- `updatedAt`: Account update timestamp

## Security Best Practices

### Implemented Security Measures
- **Password Security:** Bcrypt hashing with high salt rounds
- **Token Security:** Separate secrets for access/refresh tokens, rotation on refresh
- **Rate Limiting:** Prevents brute force and DoS attacks
- **Account Protection:** Lockout after failed attempts
- **Input Validation:** Comprehensive DTO validation
- **CORS Protection:** Configured allowed origins
- **Security Headers:** Helmet.js for secure headers
- **Audit Logging:** Comprehensive security event logging

### Production Deployment Checklist
- [ ] Set strong, unique JWT secrets
- [ ] Configure production SMTP settings
- [ ] Set up database connection pooling
- [ ] Enable HTTPS/TLS
- [ ] Configure proper CORS origins
- [ ] Set NODE_ENV=production
- [ ] Implement log aggregation
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Database backups

## Development

### Running Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Code Quality
```bash
# Linting
npm run lint

# Formatting
npm run format
```

### Database Management
```bash
# Create migration
npx prisma migrate dev --name migration-name

# Reset database
npx prisma migrate reset

# View database
npx prisma studio
```

## API Response Patterns

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/auth/login"
}
```

## Monitoring

The service includes comprehensive logging for:
- Successful/failed login attempts
- Password reset requests
- Email verification events
- Token refresh operations
- Security violations
- Account lockouts

Logs are written to `logs/auth-security.log` and console.

## Scalability Considerations

- **Stateless Design:** No server-side sessions
- **Database Connection Pooling:** Efficient database connections
- **Rate Limiting:** Prevents resource exhaustion
- **Token-based Auth:** Scales horizontally
- **Async Operations:** Non-blocking email sending
- **Configurable Limits:** Adjustable security thresholds

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure security best practices
5. Run full test suite before submitting

## License

This project is licensed under the UNLICENSED license.
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
