export interface User {
  id: string
  name: string
  email: string
  profilePicture: string
  timezone?: string
  preferredCurrency?: string
}
export interface UpdateUserResponse {
  data: User
}
