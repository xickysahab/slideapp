import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Request shapes for the auth endpoints.
 *
 * The global ValidationPipe runs with `whitelist` and `forbidNonWhitelisted`, so anything not
 * declared here is rejected with a 400 rather than silently dropped — which is what surfaces
 * client/server drift while both halves are still being written.
 *
 * Note on password policy: the full spec also checks new passwords against a breach list at signup.
 * That isn't in Demo Security Baseline §1's keep-list, so it isn't implemented here — a length
 * floor is the whole policy for this build.
 */

export class SignupDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254)
  email!: string;

  // 8 is the floor, 72 the ceiling: bcrypt truncates past 72 bytes, and while Argon2id doesn't,
  // capping here keeps the door open to swapping the hasher without changing what's accepted.
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72)
  password!: string;

  @IsIn(['candidate', 'recruiter'], { message: 'Role must be candidate or recruiter' })
  role!: 'candidate' | 'recruiter';
}

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(72)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
