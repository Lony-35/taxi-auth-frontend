export type RegistrationType = 'e-mail' | 'phone'

export enum UserRole {
  Client = 1,
  Driver = 2,
  Administrator = 3,
  Agent = 4,
}

export enum UserCheckState {
  Required = 1,
  Active = 2,
  Rejected = 3,
  Blocked = 4,
}

export interface TaxiTokens { token: string; u_hash: string }

export interface TaxiUser {
  u_id: string
  u_name: string
  u_email: string
  u_phone?: string
  u_role: UserRole
  u_family?: string
  u_middle?: string
  u_check_state?: UserCheckState
  u_photo?: string
  u_city?: string
  u_lang?: string
  u_currency?: string
  u_lang_skills?: string
  u_description?: string
  u_birthday?: string
  u_gps_software?: string
  u_active?: boolean
  u_phone_checked?: boolean
  ref_code?: string
  u_details?: Record<string, unknown>
  [key: string]: unknown
}

export interface LoginRequest { login: string; password?: string; type: RegistrationType }
export interface RegistrationUpload {
  name: 'passport_photo' | 'driver_license_photo' | 'license_photo'
  file: Blob
}
export interface DriverCarRequest {
  cm_id: string
  seats: number
  registration_plate: string
  color: string
  cc_id: string
  photo?: string
  details?: Record<string, unknown>
}
export interface DriverCar extends DriverCarRequest {
  c_id: string
  u_id?: string
  [key: string]: unknown
}
export interface ProfileDocumentChange { existingIds?: Array<string | number>; files?: Blob[] }
export interface UpdateProfileRequest {
  values: Record<string, unknown>
  avatar?: Blob
  documents?: Partial<Record<'passport_photo' | 'driver_license_photo', ProfileDocumentChange>>
  car?: DriverCar
}
export interface ProfileUpdateResult {
  user: TaxiUser
  car: DriverCar | null
  uploadedFileIds: Partial<Record<'passport_photo' | 'driver_license_photo', string[]>>
}
export interface RegisterRequest {
  u_name: string
  u_email?: string
  u_phone?: string
  u_role?: UserRole
  u_city?: string
  ref_code?: string
  u_details?: Record<string, unknown>
  uploads?: RegistrationUpload[]
  u_car?: DriverCarRequest
  country?: string
  defaultLocationClassId?: string
  [key: string]: unknown
}
export interface RegisterResult {
  userId: string | null
  emailStatus: boolean
  generatedPassword: string | null
  tokens: TaxiTokens | null
  user: TaxiUser | null
  uploadedFileIds: Partial<Record<RegistrationUpload['name'], string[]>>
  carId: string | null
}
export interface ReferralCodeResult { exists: boolean }
export interface TaxiAuthSession { user: TaxiUser; tokens: TaxiTokens }

/** Direct contract between the Taxi adapter and the Taxi backend client. */
export interface TaxiApi {
  login(data: LoginRequest): Promise<TaxiAuthSession>
  register(data: RegisterRequest): Promise<RegisterResult>
  remindPassword(email: string): Promise<void>
  checkReferralCode(code: string): Promise<ReferralCodeResult>
  updateProfile(currentUser: TaxiUser, data: UpdateProfileRequest, tokens: TaxiTokens): Promise<ProfileUpdateResult>
  getAuthorizedCars(tokens: TaxiTokens): Promise<DriverCar[]>
  getAuthorizedUser(tokens: TaxiTokens): Promise<TaxiUser>
  logout(tokens: TaxiTokens | null): Promise<void>
}
