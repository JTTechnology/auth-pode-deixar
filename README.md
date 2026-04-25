# Auth Service

A robust and secure authentication service built with NestJS, providing JWT-based authentication, user registration, password management, email verification, and role-based access control.

## Features

- **User Registration** - Register new users with email verification
- **Authentication** - JWT-based login with access and refresh tokens
- **Email Verification** - Send verification emails to confirm user accounts
- **Password Management** - Forgot password and reset password functionality
- **Change Password** - Allow users to change their passwords securely
- **Refresh Token Support** - Maintain user sessions with refresh tokens
- **Role-Based Access Control** - Support for different user roles (CLIENT, PROVIDER)
- **Security Features**:
  - Bcrypt password hashing (12 rounds)
  - Account lockout after multiple failed login attempts
  - Rate limiting with Throttler
  - Security headers with Helmet
  - CORS protection
  - Failed login attempt tracking
  - Secure JWT token management
  - Security event logging
- **API Documentation** - Swagger/OpenAPI documentation
- **Database** - PostgreSQL with Prisma ORM
- **Logging** - Structured logging with Winston
- **Email Service** - Nodemailer integration for transactional emails

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Docker and Docker Compose (for running PostgreSQL)
- PostgreSQL (if not using Docker)

## Installation

1. **Clone the repository** and navigate to the service directory:
```bash
cd services/auth
```

2. **Install dependencies**:
```bash
npm install
```

3. **Setup environment variables**:
```bash
cp .env.example .env
```

Edit `.env` with your configuration values (see [Configuration](#configuration) section).

4. **Setup the database** (Docker):
```bash
docker-compose up -d
```

This will start PostgreSQL and pgAdmin. The database will be initialized with the schema from `init.sql`.

5. **Run Prisma migrations**:
```bash
npm run prisma:migrate
```

Alternatively, if needed to reset the database:
```bash
npm run prisma:reset
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:root@localhost:5432/auth_db"

# JWT Secrets (generate strong random strings)
JWT_ACCESS_SECRET="your-super-secure-access-secret-key-here"
JWT_REFRESH_SECRET="your-super-secure-refresh-secret-key-here"

# Email Configuration (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@yourapp.com"

# Frontend URL (for email links)
FRONTEND_URL="http://localhost:3000"

# Security Settings
MAX_LOGIN_ATTEMPTS=5                    # Number of failed attempts before lockout
LOCKOUT_DURATION_MINUTES=15             # Duration of account lockout

# CORS Configuration
ALLOWED_ORIGINS="http://localhost:3000,https://yourapp.com"

# Application Settings
NODE_ENV="development"                  # development, testing, production
PORT=3001
```

### Email Configuration

For Gmail:
1. Enable **2-Step Verification** in your Google Account
2. Generate an **App Password** (not your regular password)
3. Use the App Password in `SMTP_PASS`

For other email providers, update `SMTP_HOST` and `SMTP_PORT` accordingly.

## Running the Service

### Development Mode
```bash
npm run start:dev
```
The service will start with hot-reload enabled on `http://localhost:3001`.

### Debug Mode
```bash
npm run start:debug
```

### Production Mode
```bash
npm run build
npm run start:prod
```

## API Documentation

Once the service is running, access the interactive API documentation at:
```
http://localhost:3001/api
```

### Authentication Endpoints

#### Register User
```
POST /auth/register
Content-Type: application/json

{
  "complete_name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "role": "CLIENT",
  "phone": "+1234567890",
  "postal_code": "12345-678"
}

Response (201):
{
  "message": "User registered successfully. Please check your email to verify your account.",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "complete_name": "John Doe",
    "email": "john@example.com",
    "role": "CLIENT",
    "phone": "+1234567890",
    "postal_code": "12345-678",
    "email_verified": false,
    "created_at": "2026-04-12T12:00:00Z"
  }
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}

Response (200):
{
  "message": "Login successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 900,
  "token_type": "Bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "complete_name": "John Doe",
    "email": "john@example.com",
    "role": "CLIENT"
  }
}
```

#### Verify Email
```
POST /auth/verify-email
Content-Type: application/json

{
  "token": "email-verification-token-from-email"
}

Response (200):
{
  "message": "Email verified successfully"
}
```

#### Refresh Token
```
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response (200):
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer"
}
```

#### Forgot Password
```
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}

Response (200):
{
  "message": "Password reset instructions sent to your email"
}
```

#### Reset Password
```
POST /auth/reset-password
Content-Type: application/json

{
  "token": "password-reset-token-from-email",
  "new_password": "NewSecurePassword123!"
}

Response (200):
{
  "message": "Password reset successfully"
}
```

#### Change Password (Requires Authentication)
```
PUT /auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "current_password": "SecurePassword123!",
  "new_password": "NewSecurePassword123!"
}

Response (200):
{
  "message": "Password changed successfully"
}
```

## Using Tokens

Include JWT tokens in API requests using the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Expiration
- **Access Token**: 15 minutes (configurable)
- **Refresh Token**: 7 days (configurable)

When the access token expires, use the refresh token to get a new one without re-authenticating.

## Database

### Schema

The application uses a `User` model with the following fields:

```prisma
model User {
  id                      String    @id @default(uuid())
  completeName            String
  email                   String    @unique
  password                String
  role                    String
  phone                   String
  postalCode              String
  emailVerified           Boolean   @default(false)
  emailVerificationToken  String?
  passwordResetToken      String?
  passwordResetExpires    DateTime?
  refreshToken            String?
  failedLoginAttempts     Int       @default(0)
  lockoutUntil            DateTime?
  lastLoginAt             DateTime?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
}
```

### Database Management

Access pgAdmin at `http://localhost:5050`:
- Email: `admin@admin.com`
- Password: `admin`

Add PostgreSQL connection:
- Host: `postgres_db`
- Username: `postgres`
- Password: `root`
- Database: `auth_db`

### Prisma Commands

- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Create and apply migrations
- `npm run prisma:reset` - Reset database (development only)
- `npm run prisma:studio` - Open Prisma Studio GUI

## Security Features

### Password Security
- **Bcrypt Hashing**: Passwords are hashed with 12 salt rounds
- **No Password Logging**: Passwords are never logged
- **Secure Comparison**: Safe password comparison to prevent timing attacks

### Account Protection
- **Failed Login Tracking**: Track failed login attempts
- **Account Lockout**: Automatically lock accounts after multiple failed attempts
  - Default: 5 attempts lock for 15 minutes
  - Configurable via `MAX_LOGIN_ATTEMPTS` and `LOCKOUT_DURATION_MINUTES`
- **Email Verification**: New accounts must verify their email

### Security Headers
- **Helmet.js**: Sets security HTTP headers (CSP, HSTS, etc.)
- **CORS**: Restrict cross-origin requests
- **Rate Limiting**: Throttle requests to prevent abuse

### Token Security
- **JWT**: Secure token-based authentication
- **Refresh Tokens**: Separate tokens for session refresh
- **Token Expiration**: Tokens expire automatically
- **Secret Management**: Use strong, environment-based secrets

### Logging
- **Security Events**: Log important security events
- **Failed Attempts**: Track and log login failures
- **Registration**: Log all user registrations
- **No Sensitive Data**: Sensitive data (passwords, tokens) are not logged

## Testing

### Run Unit Tests
```bash
npm run test
```

### Run Tests with Coverage
```bash
npm run test:cov
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

## Common Issues
### Port Already in Use
If port 3001 is already in use:
```bash
# Change PORT in .env
PORT=3002
npm run start:dev
```

### Database Connection Failed
1. Ensure PostgreSQL is running:
```bash
docker-compose ps
```

2. Check database credentials in `.env`

3. Verify DATABASE_URL format:
```
postgresql://user:password@localhost:5432/database_name
```

### Email Not Sending
1. Enable **Less secure apps** or use **App Password** (Gmail)
2. Check SMTP credentials in `.env`
3. Verify `FRONTEND_URL` is correctly set
4. Check service logs for email service errors

### Migrations Failed
Reset the database (development only):
```bash
npm run prisma:reset
```

## Development Workflow

1. Start the database and dependencies:
```bash
docker-compose up -d
```

2. Run migrations:
```bash
npm run prisma:migrate
```

3. Start development server:
```bash
npm run start:dev
```

4. Access API documentation:
```
http://localhost:3001/api
```

5. Run tests:
```bash
npm run test:watch
```

## Deployment

1. Build the application:
```bash
npm run build
```

2. Set production environment variables:
```env
NODE_ENV=production
JWT_ACCESS_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>
DATABASE_URL=<production-database-url>
SMTP_HOST=<production-smtp-host>
ALLOWED_ORIGINS=<production-domains>
```

3. Start the service:
```bash
npm run start:prod
```

4. Use a process manager (PM2, Docker, K8s) to keep the service running.

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Application environment |
| `PORT` | 3001 | Service port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | - | Secret for access tokens |
| `JWT_REFRESH_SECRET` | - | Secret for refresh tokens |
| `SMTP_HOST` | - | SMTP server host |
| `SMTP_PORT` | 587 | SMTP server port |
| `SMTP_USER` | - | SMTP authentication user |
| `SMTP_PASS` | - | SMTP authentication password |
| `SMTP_FROM` | - | Default sender email |
| `FRONTEND_URL` | - | Frontend URL for email links |
| `MAX_LOGIN_ATTEMPTS` | 5 | Failed attempts before lockout |
| `LOCKOUT_DURATION_MINUTES` | 15 | Account lockout duration |
| `ALLOWED_ORIGINS` | http://localhost:3000 | CORS allowed origins |

## Code Quality

- **Linting**:
```bash
npm run lint
```

- **Formatting**:
```bash
npm run format
```

- **Build**:
```bash
npm run build
```

## Technologies

- **NestJS** - Progressive Node.js framework
- **PostgreSQL** - Relational database
- **Prisma** - Database ORM
- **JWT** - JSON Web Tokens
- **Bcrypt** - Password hashing
- **Passport.js** - Authentication middleware
- **Helmet** - Security headers
- **Swagger/OpenAPI** - API documentation
- **Winston** - Logging
- **Jest** - Testing framework
- **Nodemailer** - Email service

## Support

For issues, questions, or contributions, please refer to the project documentation or create an issue in the repository.

## License

Private - All rights reserved

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